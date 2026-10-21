import type { Category, Department, Item, Occasion, Profile, Season } from './db'
import { currentSeason } from './util'
import type { DayWeather } from './weather'

/** What today's weather and day ask for. */
export interface Needs {
  /** The season the weather feels like (a warm October day dresses like spring). */
  feelsSeason: Season
  jacket: boolean
  /** A sweater, cardigan or blazer on top. */
  layer: boolean
  rain: boolean
  occasion: Occasion
  tips: string[]
}

export interface Suggestion {
  items: Item[]
  score: number
}

export interface Missing {
  reason: string
  query: string
}

const NEUTRALS = ['Zwart', 'Wit', 'Grijs', 'Beige', 'Bruin', 'Navy']
const RAINPROOF = /regen|water|rain|parka|trench|softshell|gore|anorak/i
const DAY = 86_400_000

export function defaultOccasion(profile: Profile, date = new Date()): Occasion {
  const weekend = date.getDay() === 0 || date.getDay() === 6
  if (weekend) return 'Vrije tijd'
  if (profile.job) return 'Werk'
  return profile.department === 'Kinderen' ? 'School' : 'Vrije tijd'
}

export function needsFor(w: DayWeather, occasion: Occasion): Needs {
  const t = w.feelsLike
  const feelsSeason: Season = t >= 20 ? 'Zomer' : t >= 11 ? (currentSeason() === 'Lente' ? 'Lente' : 'Herfst') : 'Winter'
  const rain = w.rainChance >= 50
  const tips: string[] = []
  if (rain) tips.push('Grote kans op regen: kies een waterdichte jas of neem een paraplu mee.')
  if (w.windMax >= 40) tips.push('Het waait flink, een jas die goed sluit is fijn.')
  if (w.tempMax - w.tempMin >= 8) tips.push("Groot verschil tussen ochtend en middag: kleed je in laagjes.")
  if (t >= 25) tips.push('Warm: kies luchtige stoffen en lichte kleuren.')
  if (t < 3) tips.push('Koud: denk aan sjaal, muts en handschoenen.')
  return { feelsSeason, jacket: t < 17 || rain || w.windMax >= 40, layer: t < 14, rain, occasion, tips }
}

function score(item: Item, n: Needs): number {
  let s = 0
  if (item.seasons.length === 0 || item.seasons.includes(n.feelsSeason)) s += 3
  else if (n.feelsSeason === 'Zomer' ? item.seasons.includes('Winter') : item.seasons.includes('Zomer')) s -= 4
  if (n.rain && item.category === 'Jassen') s += RAINPROOF.test(`${item.name} ${item.notes}`) ? 4 : -1
  if (item.favorite) s += 1
  // Prefer what has not been worn lately (up to a week).
  s += Math.min(item.lastWorn ? (Date.now() - item.lastWorn) / DAY : 7, 7) / 2
  return s
}

function colorScore(items: Item[]): number {
  const bold = new Set(items.flatMap((i) => i.colors).filter((c) => !NEUTRALS.includes(c)))
  return bold.size <= 1 ? 2 : -(bold.size - 1) * 2
}

/** Up to `count` outfits for today, best first, each with a different top or dress. */
export function suggestToday(wardrobe: Item[], n: Needs, count = 3): Suggestion[] {
  const ranked = (cats: Category[], k = 4) =>
    wardrobe
      .filter((i) => cats.includes(i.category))
      .map((item) => ({ item, s: score(item, n) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)

  const sport = n.occasion === 'Sport'
  const tops = ranked(sport ? ['Sportkleding'] : ['Tops', 'Overhemden & blouses'])
  const bottoms = ranked(sport ? ['Sportkleding'] : ['Broeken', 'Rokken'])
  const dresses = sport ? [] : ranked(['Jurken'])
  const layers = n.layer && !sport ? ranked(['Truien & vesten', 'Blazers & colberts'], 2) : []
  const jackets = n.jacket ? ranked(['Jassen'], 2) : []
  const shoes = ranked(['Schoenen'], 1)

  const bases: { item: Item; s: number }[][] = []
  for (const t of tops) for (const b of bottoms) if (t.item.id !== b.item.id) bases.push([t, b])
  for (const d of dresses) bases.push([d])

  const all = bases.map((base, idx) => {
    const parts = [...base]
    if (layers.length) parts.push(layers[idx % layers.length])
    if (jackets.length) parts.push(jackets[idx % jackets.length])
    parts.push(...shoes)
    const items = parts.map((p) => p.item)
    return { items, score: parts.reduce((sum, p) => sum + p.s, 0) / parts.length + colorScore(items) }
  })
  all.sort((a, b) => b.score - a.score)

  const picked: Suggestion[] = []
  const usedTops = new Set<string>()
  for (const o of all) {
    if (usedTops.has(o.items[0].id)) continue
    usedTops.add(o.items[0].id)
    picked.push(o)
    if (picked.length === count) break
  }
  return picked
}

const WHO: Record<Department, string> = { Dames: 'dames', Heren: 'heren', Kinderen: 'kinderen' }

/** Pieces today's weather asks for that the closet does not have, with a search term for web shops. */
export function findMissing(wardrobe: Item[], n: Needs, department: Department): Missing[] {
  const has = (cats: Category[], extra: (i: Item) => boolean = () => true) =>
    wardrobe.some((i) => cats.includes(i.category) && extra(i))
  const fits = (i: Item) => i.seasons.length === 0 || i.seasons.includes(n.feelsSeason)
  const who = WHO[department]
  const out: Missing[] = []

  if (!has(['Tops', 'Overhemden & blouses', 'Jurken'], fits))
    out.push({
      reason: `Geen bovenstuk voor ${n.feelsSeason.toLowerCase()}sweer in de kast.`,
      query: `${n.feelsSeason === 'Zomer' ? 'luchtig shirt' : 'longsleeve'} ${who}`,
    })
  if (!has(['Broeken', 'Rokken', 'Jurken']))
    out.push({ reason: 'Nog geen broek of rok in de kast.', query: `${n.occasion === 'Werk' ? 'pantalon' : 'broek'} ${who}` })
  if (n.layer && !has(['Truien & vesten', 'Blazers & colberts'], fits))
    out.push({ reason: 'Het is fris en er is geen trui of vest voor dit weer.', query: `${n.feelsSeason === 'Winter' ? 'wollen trui' : 'vest'} ${who}` })
  if (n.rain && !has(['Jassen'], (i) => RAINPROOF.test(`${i.name} ${i.notes}`)))
    out.push({ reason: 'Het gaat regenen en er is geen regenjas.', query: `waterdichte regenjas ${who}` })
  else if (n.jacket && !has(['Jassen'], fits))
    out.push({ reason: 'Het is weer voor een jas, maar er is er geen voor dit seizoen.', query: `${n.feelsSeason === 'Winter' ? 'winterjas' : 'tussenjas'} ${who}` })
  if (!has(['Schoenen']))
    out.push({ reason: 'Nog geen schoenen in de kast.', query: `${n.rain ? 'waterdichte schoenen' : 'sneakers'} ${who}` })
  return out
}

export const SHOPS: { name: string; url: (q: string) => string }[] = [
  { name: 'Zalando', url: (q) => `https://www.zalando.nl/catalogus/?q=${encodeURIComponent(q)}` },
  { name: 'bol.com', url: (q) => `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(q)}` },
  { name: 'Google Shopping', url: (q) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}` },
]
