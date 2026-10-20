import type { Item, Season } from './db'

export function categoryIcon(category: string): string {
  return (
    {
      Tops: '👕',
      Broeken: '👖',
      Rokken: '🩱',
      Jurken: '👗',
      'Truien & vesten': '🧶',
      Jassen: '🧥',
      Schoenen: '👟',
      Accessoires: '👜',
    }[category] ?? '🏷️'
  )
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function currentSeason(): Season {
  const m = new Date().getMonth()
  if (m >= 2 && m <= 4) return 'Lente'
  if (m >= 5 && m <= 7) return 'Zomer'
  if (m >= 8 && m <= 10) return 'Herfst'
  return 'Winter'
}

function pick<T>(list: T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)]
}

/** Random but sensible combination: a dress, or top + bottom; plus shoes and (in cold seasons) a layer. */
export function suggestOutfit(items: Item[], season: Season): string[] {
  // Items without a season are treated as all-season.
  const fits = items.filter((i) => i.seasons.length === 0 || i.seasons.includes(season))
  const of = (...cats: string[]) => fits.filter((i) => cats.includes(i.category))
  const tops = of('Tops')
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
    if (Math.random() < 0.5) result.push(pick(of('Truien & vesten')))
  }
  result.push(pick(of('Schoenen')))
  if (Math.random() < 0.4) result.push(pick(of('Accessoires')))
  return result.filter((i): i is Item => !!i).map((i) => i.id)
}
