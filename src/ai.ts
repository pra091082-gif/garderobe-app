import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { CATEGORIES, COLORS, type Item, type Season } from './db'
import { blobToDataUrl, resizeImage } from './media'
import { getSettings } from './settings'

const MODEL = 'claude-opus-5-5'
// On a safety decline the API retries on a fallback model inside the same call.
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }

export class AiError extends Error {}

function client(): Anthropic {
  const { anthropicKey } = getSettings()
  if (!anthropicKey) throw new AiError('Vul eerst je Claude API-sleutel in onder Meer → Koppelingen.')
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

const Category = z.enum(CATEGORIES)
const Color = z.enum(Object.keys(COLORS) as [string, ...string[]])

// ---------- 1. Purchases from order-confirmation emails ----------

const PurchaseSchema = z.object({
  isOrderConfirmation: z.boolean(),
  orderDate: z.string().nullable().describe('YYYY-MM-DD'),
  items: z.array(
    z.object({
      name: z.string().describe('Korte Nederlandse omschrijving, bijv. "Witte leren sneakers"'),
      brand: z.string(),
      category: Category,
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
    checkStop(msg)
    const out = msg.parsed_output
    if (!out) throw new AiError('Claude gaf geen bruikbaar antwoord.')
    // Only accept image URLs that really occur in the mail.
    for (const item of out.items) {
      if (item.imageUrl && !email.imageUrls.includes(item.imageUrl)) item.imageUrl = null
    }
    return out
  } catch (e) {
    explain(e)
  }
}

// ---------- 2. AI stylist ----------

const MAX_IMAGES = 40

async function thumbnail(item: Item): Promise<Anthropic.Beta.BetaImageBlockParam | undefined> {
  if (item.photo) {
    const small = await resizeImage(item.photo, 320)
    const data = (await blobToDataUrl(small)).split(',')[1]
    return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }
  }
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

const StylistSchema = z.object({
  outfits: z.array(
    z.object({
      name: z.string(),
      itemIds: z.array(z.string()),
      why: z.string().describe('1-2 zinnen waarom dit werkt'),
    }),
  ),
  missing: z.string().nullable().describe('Optioneel: één stuk dat de garderobe veel veelzijdiger zou maken'),
})
export type StylistResult = z.infer<typeof StylistSchema>

export async function styleOutfits(items: Item[], opts: { season: Season; occasion: string }): Promise<StylistResult> {
  if (items.length < 2) throw new AiError('Voeg eerst minstens twee kledingstukken toe.')
  try {
    const msg = await client().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: 'medium', format: betaZodOutputFormat(StylistSchema) },
      system:
        'Je bent een persoonlijke stylist. Je stelt outfits samen uitsluitend met stukken uit de garderobe hieronder en ' +
        'verwijst naar stukken met hun id. Let op kleurcombinaties, stijl, seizoen en gelegenheid, en geef stukken die ' +
        'weinig gedragen worden een kans. Antwoord in het Nederlands.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Mijn garderobe:' },
            ...(await wardrobeContent(items)),
            {
              type: 'text',
              text: `Stel 3 outfits voor. Seizoen: ${opts.season}. Gelegenheid: ${opts.occasion || 'dagelijks'}.`,
            },
          ],
        },
      ],
    })
    checkStop(msg)
    const out = msg.parsed_output
    if (!out) throw new AiError('Claude gaf geen bruikbaar antwoord.')
    const known = new Set(items.map((i) => i.id))
    out.outfits = out.outfits
      .map((o) => ({ ...o, itemIds: o.itemIds.filter((id) => known.has(id)) }))
      .filter((o) => o.itemIds.length > 0)
    return out
  } catch (e) {
    explain(e)
  }
}

// ---------- 3. Inspiration from the web for one item ----------

const InspirationSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      description: z.string().describe('Hoe het stuk in deze look gedragen wordt'),
      sourceUrl: z.string().nullable().describe('URL van een gevonden pagina met deze look'),
      matchingItemIds: z.array(z.string()).describe('Stukken uit mijn garderobe die bij deze look passen'),
    }),
  ),
})
export type Inspiration = z.infer<typeof InspirationSchema>

export async function findInspiration(item: Item, wardrobe: Item[]): Promise<Inspiration> {
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
        'dit kledingstuk of een stuk dat er sterk op lijkt. Geef alleen URLs die je echt in de zoekresultaten hebt gezien. ' +
        'Koppel elke look aan stukken uit de garderobe van de gebruiker (via id) waarmee de look na te maken is. Antwoord in het Nederlands.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `Dit stuk: ${describe(item)}` },
            ...(img ? [img] : []),
            { type: 'text', text: `De rest van mijn garderobe:\n${others.map(describe).join('\n') || '(nog leeg)'}` },
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
    checkStop(msg)
    const out = msg.parsed_output
    if (!out) throw new AiError('Claude gaf geen bruikbaar antwoord.')
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
