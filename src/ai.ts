import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { CATEGORIES, COLORS, DEPARTMENTS, SEASONS, type Department, type Feedback, type Item, type Occasion, type Profile, type Season, type StyleProfile } from './db'
import { personContext, preferenceContext } from './learn'
import { blobToDataUrl, imageSize, resizeImage, type Box } from './media'
import type { QuizAnswer, QuizRound } from './quiz'
import { getSettings } from './settings'

const MODEL = 'claude-opus-5-5'
// On a safety decline the API retries on a fallback model inside the same call.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

export class AiError extends Error {}

function client(): Anthropic {
  const { anthropicKey } = getSettings()
  if (!anthropicKey) throw new AiError('Vul eerst je Claude API-sleutel in onder Profiel → Koppelingen.')
  // The key belongs to the user and lives only on their device, so calling the API from the browser is intended.
  return new Anthropic({ apiKey: anthropicKey, dangerouslyAllowBrowser: true })
}

function explain(e: unknown): never {
  if (e instanceof AiError) throw e
  if (e instanceof Anthropic.AuthenticationError) throw new AiError('De Claude API-sleutel is ongeldig.')
  if (e instanceof Anthropic.RateLimitError) throw new AiError('Even te veel verzoeken. Probeer het zo opnieuw.')
  if (e instanceof Anthropic.APIConnectionError) throw new AiError('Geen verbinding met Claude. Ben je online?')
  if (e instanceof Anthropic.APIError) throw new AiError(`Claude gaf een fout (${e.status}): ${e.message}`)
  throw e
}

function checkStop(msg: { stop_reason: string | null }) {
  if (msg.stop_reason === 'refusal') throw new AiError('Claude kon dit verzoek niet uitvoeren.')
  if (msg.stop_reason === 'max_tokens') throw new AiError('Het antwoord werd te lang. Probeer het met minder stukken.')
}

function parsed<T>(msg: { stop_reason: string | null; parsed_output: T | null }): T {
  checkStop(msg)
  if (!msg.parsed_output) throw new AiError('Claude gaf geen bruikbaar antwoord.')
  return msg.parsed_output
}

const Category = z.enum(CATEGORIES)
const Color = z.enum(Object.keys(COLORS) as [string, ...string[]])

// ---------- Purchases from order-confirmation emails ----------

const PurchaseSchema = z.object({
  isOrderConfirmation: z.boolean(),
  orderDate: z.string().nullable().describe('YYYY-MM-DD'),
  items: z.array(
    z.object({
      name: z.string().describe('Korte Nederlandse omschrijving, bijv. "Witte leren sneakers"'),
      brand: z.string(),
      category: Category,
      department: z.enum(DEPARTMENTS).nullable().describe('Dames, Heren of Kinderen als dat uit de mail blijkt'),
      colors: z.array(Color),
      size: z.string().nullable(),
      price: z.number().nullable().describe('Prijs in euro'),
      imageUrl: z.string().nullable().describe('Exact een van de gegeven afbeeldings-URLs, of null'),
      isClothing: z.boolean().describe('false voor cadeaubonnen, verzendkosten, cosmetica enz.'),
    }),
  ),
})
export type PurchaseExtraction = z.infer<typeof PurchaseSchema>

export async function extractPurchases(email: {
  shop: string
  subject: string
  text: string
  imageUrls: string[]
}): Promise<PurchaseExtraction> {
  try {
    const msg = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: 'low', format: betaZodOutputFormat(PurchaseSchema) },
      system:
        'Je leest bestelbevestigingen van webwinkels en haalt de gekochte kleding, schoenen en accessoires eruit. ' +
        'Is de mail geen bestelbevestiging (bijv. verzending, retour, nieuwsbrief), zet dan isOrderConfirmation op false en geef geen items. ' +
        'Kies per item de productfoto uit de lijst met afbeeldings-URLs; logo’s, iconen en banners zijn geen productfoto.',
      messages: [
        {
          role: 'user',
          content:
            `Winkel: ${email.shop}\nOnderwerp: ${email.subject}\n\n` +
            `Afbeeldings-URLs in de mail:\n${email.imageUrls.map((u) => `- ${u}`).join('\n') || '(geen)'}\n\n` +
            `Tekst van de mail:\n${email.text}`,
        },
      ],
    })
    const out = parsed(msg)
    // Only accept image URLs that really occur in the mail.
    for (const item of out.items) {
      if (item.imageUrl && !email.imageUrls.includes(item.imageUrl)) item.imageUrl = null
    }
    return out
  } catch (e) {
    explain(e)
  }
}

// ---------- Recognising a piece from a photo ----------

const ItemGuessSchema = z.object({
  name: z.string().describe('Korte Nederlandse omschrijving, bijv. "Navy wollen colbert"'),
  brand: z.string().describe('Alleen als het merk zichtbaar is (label, logo), anders leeg'),
  category: Category,
  colors: z.array(Color),
  seasons: z.array(z.enum(SEASONS)).describe('Seizoenen waarin je dit stuk draagt'),
})
export type ItemGuess = z.infer<typeof ItemGuessSchema>

async function imageBlock(photo: Blob, max: number): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const small = await resizeImage(photo, max)
  const data = (await blobToDataUrl(small)).split(',')[1]
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }
}

/** Name, category, colours and seasons of the piece in a photo. */
export async function recognizeItem(photo: Blob, department: Department): Promise<ItemGuess> {
  try {
    const msg = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      ...FALLBACK,
      output_config: { effort: 'low', format: betaZodOutputFormat(ItemGuessSchema) },
      system:
        'Je herkent het kledingstuk, de schoenen of het accessoire op een foto voor een digitale kledingkast. ' +
        'Beschrijf het hoofdstuk op de foto, niet de achtergrond. Verzin geen merk. Antwoord in het Nederlands.',
      messages: [
        {
          role: 'user',
          content: [await imageBlock(photo, 640), { type: 'text', text: `Afdeling: ${department}` }],
        },
      ],
    })
    return parsed(msg)
  } catch (e) {
    explain(e)
  }
}

// ---------- Orders from screenshots and product links ----------

const ShopItem = z.object({
  name: z.string().describe('Korte Nederlandse omschrijving, bijv. "Witte leren sneakers"'),
  brand: z.string(),
  category: Category,
  department: z.enum(DEPARTMENTS).nullable().describe('Dames, Heren of Kinderen als dat blijkt'),
  colors: z.array(Color),
  size: z.string().nullable(),
  price: z.number().nullable().describe('Prijs in euro'),
  isClothing: z.boolean().describe('false voor cadeaubonnen, verzendkosten, cosmetica enz.'),
})

const ScreenshotSchema = z.object({
  shop: z.string().nullable().describe('Naam van de winkel, bijv. Zalando of BestSecret'),
  orderDate: z.string().nullable().describe('YYYY-MM-DD'),
  items: z.array(
    ShopItem.extend({
      returned: z.boolean().describe('true als het stuk geretourneerd of geannuleerd is'),
      photo: z
        .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
        .nullable()
        .describe('Kader om de productfoto van dit stuk, in pixels van de screenshot'),
    }),
  ),
})

export interface ShopPurchase extends z.infer<typeof ShopItem> {
  /** Product photo cut out of the screenshot. */
  photo?: Blob
  imageUrl?: string
}

export interface ShopOrder {
  shop: string | null
  orderDate: string | null
  items: ShopPurchase[]
}

/** Sends the screenshot at most this size; boxes come back in these pixels. */
const SHOT_MAX = 1500

/** Reads a screenshot of an order or the "my orders" page of a shop app and cuts out the product photos. */
export async function extractFromScreenshot(shot: Blob): Promise<ShopOrder> {
  try {
    const small = await resizeImage(shot, SHOT_MAX)
    const { width, height } = await imageSize(small)
    const data = (await blobToDataUrl(small)).split(',')[1]
    const msg = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: 'medium', format: betaZodOutputFormat(ScreenshotSchema) },
      system:
        'Je leest een screenshot van een webwinkel of winkel-app (bijv. "Mijn bestellingen" bij Zalando of BestSecret, ' +
        'een bestelling of een bestelbevestiging) en haalt de gekochte kleding, schoenen en accessoires eruit. ' +
        'Neem alleen stukken op die echt op de screenshot staan, ook als ze maar half zichtbaar zijn. ' +
        'Geef per stuk het kader om de productfoto, zo strak mogelijk om de foto zelf, zonder tekst eromheen.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } },
            { type: 'text', text: `De screenshot is ${width} × ${height} pixels.` },
          ],
        },
      ],
    })
    const out = parsed(msg)
    const items: ShopPurchase[] = []
    for (const { photo: box, returned, ...item } of out.items) {
      if (returned) continue
      items.push({ ...item, photo: box ? await cropPhoto(small, box, width, height) : undefined })
    }
    return { shop: out.shop, orderDate: out.orderDate, items }
  } catch (e) {
    explain(e)
  }
}

async function cropPhoto(shot: Blob, box: Box, width: number, height: number): Promise<Blob | undefined> {
  const x = Math.max(0, Math.round(box.x))
  const y = Math.max(0, Math.round(box.y))
  const w = Math.min(width - x, Math.round(box.width))
  const h = Math.min(height - y, Math.round(box.height))
  // A box this small is not a product photo.
  if (w < 24 || h < 24) return undefined
  try {
    return await resizeImage(shot, 900, { x, y, width: w, height: h })
  } catch {
    return undefined
  }
}

const LinkSchema = z.object({
  found: z.boolean().describe('false als de pagina niet te lezen was of geen product toont'),
  shop: z.string().nullable(),
  item: ShopItem.extend({
    imageUrl: z.string().nullable().describe('URL van de productfoto zoals op de pagina gezien'),
  }).nullable(),
})

/** Reads a product page (e.g. a Zalando link) and returns the piece with its shop photo. */
export async function extractFromLink(url: string): Promise<ShopOrder> {
  try {
    const ai = client()
    const params = {
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: 'low' as const, format: betaZodOutputFormat(LinkSchema) },
      tools: [{ type: 'web_fetch_20260209' as const, name: 'web_fetch' as const, max_uses: 2 }],
      system:
        'Je opent een productpagina van een webwinkel en beschrijft het kledingstuk voor een digitale kledingkast: ' +
        'naam, merk, soort, kleur en prijs, en de URL van de hoofdproductfoto. Verzin niets; kun je de pagina niet ' +
        'lezen, zet found op false. Antwoord in het Nederlands.',
      messages: [{ role: 'user', content: `Productpagina: ${url}` }] as Anthropic.Beta.BetaMessageParam[],
    }
    let msg = await ai.beta.messages.parse(params)
    for (let i = 0; i < 3 && msg.stop_reason === 'pause_turn'; i++) {
      params.messages.push({ role: 'assistant', content: msg.content })
      msg = await ai.beta.messages.parse(params)
    }
    const out = parsed(msg)
    if (!out.found || !out.item)
      throw new AiError('Deze pagina kon niet worden gelezen. Bij BestSecret moet je ingelogd zijn: maak dan een screenshot.')
    const { imageUrl, ...item } = out.item
    return {
      shop: out.shop,
      orderDate: null,
      items: [{ ...item, imageUrl: imageUrl && /^https?:\/\//.test(imageUrl) ? imageUrl : undefined }],
    }
  } catch (e) {
    explain(e)
  }
}

// ---------- Shop photo of a piece ----------

const ShopPhotoSchema = z.object({
  matches: z.array(
    z.object({
      name: z.string().describe('Productnaam zoals de winkel hem noemt'),
      shop: z.string().describe('Naam van de webwinkel of het merk'),
      url: z.string().describe('Exacte URL van de productpagina die je zelf hebt gezien'),
      imageUrl: z.string().describe('Exacte URL van de productfoto (packshot), zoals op de pagina gezien'),
      match: z.enum(['zelfde stuk', 'lijkt erop']).describe('"zelfde stuk" alleen als merk, model en kleur kloppen'),
    }),
  ),
})
export type ShopPhoto = z.infer<typeof ShopPhotoSchema>['matches'][number]

/** Looks up the shop's own product photo of a piece (same brand, model and colour), best match first. */
export async function findShopPhotos(item: Item): Promise<ShopPhoto[]> {
  try {
    const img = await thumbnail(item)
    const ai = client()
    const params = {
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: 'medium' as const, format: betaZodOutputFormat(ShopPhotoSchema) },
      tools: [
        { type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 },
        { type: 'web_fetch_20260209' as const, name: 'web_fetch' as const, max_uses: 6 },
      ],
      system:
        'Je zoekt de officiële productfoto van een kledingstuk dat iemand al heeft, voor een digitale kledingkast: ' +
        'een nette packshot of foto op een model van de webwinkel of het merk (bijv. Zalando, BestSecret, de site van het ' +
        'merk). Zoek op merk, model en kleur, open de productpagina met web_fetch en neem de URL van de hoofdfoto over. ' +
        'Gebruik alleen URLs die je echt hebt gezien en verzin niets. Geef maximaal 4 resultaten, het beste eerst; ' +
        'vind je niets betrouwbaars, geef dan een lege lijst.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                `Stuk: ${item.name}`,
                item.brand && `Merk: ${item.brand}`,
                `Soort: ${item.category}`,
                item.colors.length > 0 && `Kleur: ${item.colors.join('/')}`,
                item.shop && `Gekocht bij: ${item.shop}`,
                item.notes && `Notities: ${item.notes}`,
              ]
                .filter(Boolean)
                .join('\n'),
            },
            ...(img ? [img] : []),
          ],
        },
      ] as Anthropic.Beta.BetaMessageParam[],
    }
    let msg = await ai.beta.messages.parse(params)
    // A long search/fetch turn can pause; resume it by sending the partial turn back.
    for (let i = 0; i < 3 && msg.stop_reason === 'pause_turn'; i++) {
      params.messages.push({ role: 'assistant', content: msg.content })
      msg = await ai.beta.messages.parse(params)
    }
    return parsed(msg).matches.filter((m) => /^https:\/\//.test(m.imageUrl) && /^https:\/\//.test(m.url))
  } catch (e) {
    explain(e)
  }
}

// ---------- Style test ----------

const Hex = z.string().describe('Hex-kleur, bijv. #1f2f55')

const QuizSchema = z.object({
  rounds: z.array(
    z.object({
      question: z.string(),
      options: z.array(
        z.object({
          title: z.string().describe('2-3 woorden'),
          description: z.string().describe('Eén korte zin'),
          palette: z.array(Hex).describe('3-5 kleuren die de look vangen'),
          pieces: z.array(z.string()).describe('3-4 concrete kledingstukken'),
        }),
      ),
    }),
  ),
})

/** A style test tailored to the person: department, age and work. */
export async function generateQuiz(p: Profile, season: Season, feedback: Feedback[], items: Item[]): Promise<QuizRound[]> {
  const earlier = (p.quizzes ?? []).length > 0
  try {
    const msg = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: 'medium', format: betaZodOutputFormat(QuizSchema) },
      system:
        'Je bent een ervaren personal shopper. Je maakt een korte, visuele stijltest om iemands smaak te leren kennen. ' +
        'Elke ronde heeft 3 of 4 duidelijk verschillende opties, zodat de keuze echt iets zegt. Dek samen af: algemene stijl, ' +
        'kleuren, pasvorm, vrije tijd, schoenen, en, als er werk is, wat past bij die functie, dat bedrijf en die dresscode. ' +
        'Stem alles af op de persoon: afdeling, leeftijd en werk, en op het seizoen: de test gaat over kleding voor dat ' +
        'seizoen (stoffen, laagjes, kleuren, schoenen). Heeft de persoon de test al eerder gedaan, vraag dan vooral naar ' +
        'wat nog onduidelijk is of kan veranderen. Schrijf in het Nederlands, kort en uitnodigend.',
      messages: [
        {
          role: 'user',
          content: [
            personContext(p),
            `Seizoen: ${season}.`,
            earlier && `Wat we al weten:\n${preferenceContext(p, feedback, items)}`,
            'Maak een stijltest van 7 rondes.',
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    })
    const out = parsed(msg)
    for (const r of out.rounds) {
      for (const o of r.options) o.palette = o.palette.filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 5)
    }
    return out.rounds.filter((r) => r.options.length >= 2)
  } catch (e) {
    explain(e)
  }
}

const StyleSchema = z.object({
  summary: z.string().describe('2-3 zinnen in de je-vorm over iemands stijl'),
  styles: z.array(z.string()).describe('2-4 stijlwoorden'),
  colors: z.array(z.string()).describe('Kleuren die het best passen'),
  avoid: z.array(z.string()).describe('Wat beter vermeden kan worden'),
  fit: z.string().describe('Voorkeur voor pasvorm'),
})

/** Derives (or refreshes) the style profile from the quiz and everything learned since. */
export async function analyzeStyle(
  p: Profile,
  feedback: Feedback[],
  items: Item[],
  answers: QuizAnswer[] = [],
): Promise<StyleProfile> {
  const quiz = answers
    .map((a) =>
      a.choice
        ? `- ${a.question} → ${a.choice.title}: ${a.choice.description} (${a.choice.pieces.join(', ')})`
        : `- ${a.question} → niets sprak aan`,
    )
    .join('\n')
  try {
    const msg = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      ...FALLBACK,
      output_config: { effort: 'medium', format: betaZodOutputFormat(StyleSchema) },
      system:
        'Je bent een personal stylist. Vat iemands stijl samen op basis van de stijltest en wat diegene daarna koos, ' +
        'afwees en echt droeg. Recente keuzes en wat echt gedragen wordt wegen zwaarder dan de test. Schrijf in het Nederlands.',
      messages: [
        {
          role: 'user',
          content: [
            personContext(p),
            quiz && `Antwoorden in de stijltest:\n${quiz}`,
            `Wat we al weten:\n${preferenceContext(p, feedback, items)}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ],
    })
    return { ...parsed(msg), updatedAt: Date.now(), feedbackCount: feedback.length }
  } catch (e) {
    explain(e)
  }
}

// ---------- AI stylist ----------

const MAX_IMAGES = 40

async function thumbnail(item: Item): Promise<Anthropic.Beta.BetaImageBlockParam | undefined> {
  if (item.photo) return imageBlock(item.photo, 320)
  if (item.photoUrl) return { type: 'image', source: { type: 'url', url: item.photoUrl } }
  return undefined
}

function describe(item: Item): string {
  return [
    `id=${item.id}`,
    item.category,
    item.name,
    item.brand && `merk ${item.brand}`,
    item.colors.length && `kleur ${item.colors.join('/')}`,
    item.seasons.length && `seizoen ${item.seasons.join('/')}`,
    `${item.wornCount}× gedragen`,
  ]
    .filter(Boolean)
    .join(' | ')
}

/** Text + photo per item, photos for at most MAX_IMAGES items (favourites and least-worn first). */
async function wardrobeContent(items: Item[]): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const withPhoto = new Set(
    [...items]
      .filter((i) => i.photo || i.photoUrl)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.wornCount - b.wornCount)
      .slice(0, MAX_IMAGES)
      .map((i) => i.id),
  )
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = []
  for (const item of items) {
    blocks.push({ type: 'text', text: describe(item) })
    if (withPhoto.has(item.id)) {
      const img = await thumbnail(item)
      if (img) blocks.push(img)
    }
  }
  return blocks
}

/** The place of a piece in a look, top to bottom. */
export const LOOK_ROLES = ['Jas', 'Bovenstuk', 'Jurk', 'Onderstuk', 'Schoenen', 'Accessoire'] as const
export type LookRole = (typeof LOOK_ROLES)[number]

const StylistSchema = z.object({
  outfits: z.array(
    z.object({
      name: z.string(),
      pieces: z.array(z.object({ id: z.string(), role: z.enum(LOOK_ROLES) })),
      why: z.string().describe('1-2 zinnen waarom dit werkt, en waarom het bij deze persoon past'),
    }),
  ),
  missing: z.string().nullable().describe('Optioneel: één stuk dat de garderobe veel veelzijdiger zou maken'),
})
type StylistOutput = z.infer<typeof StylistSchema>
export interface StylistResult extends Omit<StylistOutput, 'outfits'> {
  /** `pieces` (and `itemIds`) run top to bottom: jacket, top or dress, bottom, shoes, accessories. */
  outfits: (StylistOutput['outfits'][number] & { itemIds: string[] })[]
}

export async function styleOutfits(
  p: Profile,
  items: Item[],
  feedback: Feedback[],
  opts: { season: Season; occasion: Occasion; wish: string; weather?: string },
): Promise<StylistResult> {
  if (items.length < 2) throw new AiError('Voeg eerst minstens twee kledingstukken toe.')
  const work =
    opts.occasion === 'Werk' && p.job
      ? `Het is voor het werk: houd je aan dresscode "${p.job.dresscode}" en wat gebruikelijk is voor een ${p.job.title}${p.job.industry ? ` in de branche ${p.job.industry}` : ''}.`
      : ''
  try {
    const msg = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: 'medium', format: betaZodOutputFormat(StylistSchema) },
      system:
        'Je bent een persoonlijke stylist. Je stelt outfits samen uitsluitend met stukken uit de garderobe hieronder en ' +
        'verwijst naar stukken met hun id. Je kent de persoon: volg het stijlprofiel en leer van wat diegene eerder goed ' +
        'vond, afwees en echt droeg. Herhaal afgewezen combinaties niet. Let op kleur, stijl, seizoen en gelegenheid, en geef ' +
        'stukken die weinig gedragen worden een kans. Elke look is compleet: een bovenstuk met een onderstuk (of een jurk), ' +
        'altijd een paar schoenen uit de garderobe, en een jas of accessoire als dat past bij weer en gelegenheid. Geef ' +
        'bij elk stuk zijn rol in de look. Antwoord in het Nederlands.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${personContext(p)}\n\n${preferenceContext(p, feedback, items)}` },
            { type: 'text', text: 'Garderobe:' },
            ...(await wardrobeContent(items)),
            {
              type: 'text',
              text: [
                `Stel 3 outfits voor. Seizoen: ${opts.season}. Gelegenheid: ${opts.occasion}.`,
                opts.weather && `Het weer vandaag: ${opts.weather}. Kleed de persoon daarop (jas, laagjes, regen).`,
                work,
                opts.wish && `Extra wens: ${opts.wish}`,
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        },
      ],
    })
    const out = parsed(msg)
    const byId = new Map(items.map((i) => [i.id, i]))
    const shoes = items.filter((i) => i.category === 'Schoenen').sort((a, b) => a.wornCount - b.wornCount)
    const outfits = out.outfits
      .map((o) => {
        const pieces = o.pieces.filter((x, n) => byId.has(x.id) && o.pieces.findIndex((y) => y.id === x.id) === n)
        // A look always gets shoes when there are any: fall back to the pair worn least, preferably for this season.
        if (shoes.length > 0 && !pieces.some((x) => byId.get(x.id)!.category === 'Schoenen')) {
          const pair = shoes.find((s) => s.seasons.length === 0 || s.seasons.includes(opts.season)) ?? shoes[0]
          pieces.push({ id: pair.id, role: 'Schoenen' })
        }
        pieces.sort((a, b) => LOOK_ROLES.indexOf(a.role) - LOOK_ROLES.indexOf(b.role))
        return { ...o, pieces, itemIds: pieces.map((x) => x.id) }
      })
      .filter((o) => o.pieces.length > 0)
    return { ...out, outfits }
  } catch (e) {
    explain(e)
  }
}

// ---------- Inspiration from the web for one item ----------

const InspirationSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      description: z.string().describe('Hoe het stuk in deze look gedragen wordt'),
      sourceUrl: z.string().nullable().describe('URL van een gevonden pagina met deze look'),
      matchingItemIds: z.array(z.string()).describe('Stukken uit de garderobe die bij deze look passen'),
    }),
  ),
})
export type Inspiration = z.infer<typeof InspirationSchema>

export async function findInspiration(p: Profile, item: Item, wardrobe: Item[]): Promise<Inspiration> {
  const others = wardrobe.filter((i) => i.id !== item.id)
  try {
    const img = await thumbnail(item)
    const ai = client()
    const params = {
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: 'medium' as const, format: betaZodOutputFormat(InspirationSchema) },
      tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }],
      system:
        'Je zoekt op internet naar outfit-inspiratie (stylingartikelen, lookbooks, winkels met "shop the look") met precies ' +
        'dit kledingstuk of een stuk dat er sterk op lijkt, passend bij de persoon en diens stijl. Geef alleen URLs die je ' +
        'echt in de zoekresultaten hebt gezien. Koppel elke look aan stukken uit de garderobe (via id) waarmee de look na te ' +
        'maken is. Antwoord in het Nederlands.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${personContext(p)}${p.style ? `\nStijl: ${p.style.summary}` : ''}` },
            { type: 'text', text: `Dit stuk: ${describe(item)}` },
            ...(img ? [img] : []),
            { type: 'text', text: `De rest van de garderobe:\n${others.map(describe).join('\n') || '(nog leeg)'}` },
            { type: 'text', text: 'Zoek 3 tot 5 looks met dit stuk.' },
          ],
        },
      ] as Anthropic.Beta.BetaMessageParam[],
    }
    let msg = await ai.beta.messages.parse(params)
    // A long web-search turn can pause; resume it by sending the partial turn back.
    for (let i = 0; i < 3 && msg.stop_reason === 'pause_turn'; i++) {
      params.messages.push({ role: 'assistant', content: msg.content })
      msg = await ai.beta.messages.parse(params)
    }
    const out = parsed(msg)
    const known = new Set(others.map((i) => i.id))
    for (const idea of out.ideas) {
      idea.matchingItemIds = idea.matchingItemIds.filter((id) => known.has(id))
      if (idea.sourceUrl && !/^https?:\/\//.test(idea.sourceUrl)) idea.sourceUrl = null
    }
    return out
  } catch (e) {
    explain(e)
  }
}

// ---------- Size advice for a brand or product ----------

const SizeSchema = z.object({
  size: z.string().describe('Geadviseerde maat precies zoals het merk hem noemt, bijv. "M", "40", "W32 L32", "128"'),
  confidence: z.enum(['hoog', 'middel', 'laag']),
  explanation: z.string().describe('2-4 zinnen: waarom deze maat, met de maten uit de maattabel die je vergeleek'),
  alternative: z.string().nullable().describe('Wanneer een andere maat beter is, bijv. "Neem L als je het ruim wilt dragen"'),
  brandFit: z.string().nullable().describe('Hoe het merk valt, bijv. "valt een halve maat klein"'),
  missing: z.array(z.string()).describe('Afmetingen die het advies zekerder zouden maken'),
  sizeChartUrl: z.string().nullable().describe('URL van de gebruikte maattabel, alleen als je die echt hebt gezien'),
  comparison: z
    .array(z.object({ measure: z.string(), yours: z.string(), chart: z.string() }))
    .describe('Per afmeting: jouw waarde naast die van de geadviseerde maat in de tabel'),
})
export type SizeAdvice = z.infer<typeof SizeSchema>

export async function sizeAdvice(
  p: Profile,
  ownSizes: string,
  measurements: string,
  ask: { brand: string; category: string; productUrl: string; fitWish: string },
): Promise<SizeAdvice> {
  try {
    const ai = client()
    const params = {
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: 'medium' as const, format: betaZodOutputFormat(SizeSchema) },
      tools: [
        { type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 4 },
        { type: 'web_fetch_20260209' as const, name: 'web_fetch' as const, max_uses: 3 },
      ],
      system:
        'Je bent een pasvormspecialist. Je adviseert de juiste maat bij een specifiek merk. Zoek de officiële maattabel ' +
        'van het merk (of de productpagina als die gegeven is, inclusief pasvorm-opmerkingen en reviews over of het ' +
        'klein of groot valt) en vergelijk die met de afmetingen van de persoon. De maten die de persoon al heeft bij ' +
        'merken en hoe die vallen, zijn sterk bewijs: gebruik ze. Bij twijfel tussen twee maten: kies op basis van de ' +
        'pasvormwens en noem de andere maat als alternatief. Verzin geen maattabellen; zeg het als je er geen vond en ' +
        'verlaag dan de zekerheid. Antwoord in het Nederlands.',
      messages: [
        {
          role: 'user',
          content: [
            personContext(p),
            `Afmetingen:\n${measurements}`,
            `Maten die al in de kast hangen:\n${ownSizes}`,
            `Gevraagd: ${ask.category} van ${ask.brand || 'het merk op de productpagina'}.`,
            ask.productUrl && `Productpagina: ${ask.productUrl}`,
            ask.fitWish && `Pasvormwens: ${ask.fitWish}`,
          ]
            .filter(Boolean)
            .join('\n\n'),
        },
      ] as Anthropic.Beta.BetaMessageParam[],
    }
    let msg = await ai.beta.messages.parse(params)
    // A long search/fetch turn can pause; resume it by sending the partial turn back.
    for (let i = 0; i < 3 && msg.stop_reason === 'pause_turn'; i++) {
      params.messages.push({ role: 'assistant', content: msg.content })
      msg = await ai.beta.messages.parse(params)
    }
    const out = parsed(msg)
    if (out.sizeChartUrl && !/^https?:\/\//.test(out.sizeChartUrl)) out.sizeChartUrl = null
    return out
  } catch (e) {
    explain(e)
  }
}
