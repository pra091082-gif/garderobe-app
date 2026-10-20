import type { Item, Season } from './db'

export function formatPrice(price: number): string {
  return price.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function currentSeason(date = new Date()): Season {
  const m = date.getMonth()
  if (m >= 2 && m <= 4) return 'Lente'
  if (m >= 5 && m <= 7) return 'Zomer'
  if (m >= 8 && m <= 10) return 'Herfst'
  return 'Winter'
}

/**
 * Identifies one season period, e.g. "Herfst 2026" or "Winter 2026/27"
 * (winter runs from December into the next year).
 */
export function seasonPeriod(date = new Date()): string {
  const season = currentSeason(date)
  const m = date.getMonth()
  const y = date.getFullYear()
  if (season !== 'Winter') return `${season} ${y}`
  const start = m === 11 ? y : y - 1
  return `Winter ${start}/${String(start + 1).slice(2)}`
}

/** First day of the next season (1 March, 1 June, 1 September or 1 December). */
export function nextSeasonStart(date = new Date()): Date {
  const starts = [2, 5, 8, 11]
  const m = date.getMonth()
  const next = starts.find((s) => s > m)
  return next === undefined ? new Date(date.getFullYear() + 1, 2, 1) : new Date(date.getFullYear(), next, 1)
}

function pick<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)]
}

/** Random but sensible combination: a dress, or top + bottom; plus shoes and (in cold seasons) a layer. */
export function suggestOutfit(items: Item[], season: Season): string[] {
  // Items without a season are treated as all-season.
  const fits = items.filter((i) => i.seasons.length === 0 || i.seasons.includes(season))
  const of = (...cats: string[]) => fits.filter((i) => cats.includes(i.category))
  const tops = of('Tops', 'Overhemden & blouses')
  const bottoms = of('Broeken', 'Rokken')
  const dresses = of('Jurken')

  const result: (Item | undefined)[] = []
  const canSeparates = tops.length > 0 && bottoms.length > 0
  if (dresses.length > 0 && (!canSeparates || Math.random() < 0.3)) result.push(pick(dresses))
  else if (canSeparates) result.push(pick(tops), pick(bottoms))
  else return []

  const cold = season === 'Herfst' || season === 'Winter'
  if (cold) {
    result.push(pick(of('Jassen')))
    if (Math.random() < 0.5) result.push(pick(of('Truien & vesten', 'Blazers & colberts')))
  }
  result.push(pick(of('Schoenen')))
  if (Math.random() < 0.4) result.push(pick(of('Accessoires')))
  return result.filter((i): i is Item => !!i).map((i) => i.id)
}
