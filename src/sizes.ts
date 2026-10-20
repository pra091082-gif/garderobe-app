import type { Department, Item, Measurements, Profile } from './db'

type NumericKey = Exclude<
  { [K in keyof Measurements]: Measurements[K] extends number | undefined ? K : never }[keyof Measurements],
  'updatedAt' | undefined
>
type TextKey = 'shoeEu' | 'braSize' | 'usualTop' | 'usualBottom'

export interface MeasureField {
  key: NumericKey | TextKey
  label: string
  unit?: string
  /** How to measure, shown under the field. */
  hint: string
  numeric: boolean
  /** Departments that get this field. */
  for: Department[]
}

const ALL: Department[] = ['Dames', 'Heren', 'Kinderen']
const ADULTS: Department[] = ['Dames', 'Heren']

export const MEASURE_FIELDS: MeasureField[] = [
  { key: 'heightCm', label: 'Lengte', unit: 'cm', numeric: true, for: ALL, hint: 'Zonder schoenen, rug tegen de muur.' },
  { key: 'weightKg', label: 'Gewicht', unit: 'kg', numeric: true, for: ALL, hint: 'Optioneel; helpt bij twijfel tussen twee maten.' },
  { key: 'chestCm', label: 'Borstomvang', unit: 'cm', numeric: true, for: ALL, hint: 'Rond het breedste deel van de borst, onder de oksels door.' },
  { key: 'underbustCm', label: 'Onderborstomvang', unit: 'cm', numeric: true, for: ['Dames'], hint: 'Strak direct onder de borsten.' },
  { key: 'waistCm', label: 'Taille', unit: 'cm', numeric: true, for: ALL, hint: 'Rond het smalste deel, meestal net boven de navel.' },
  { key: 'hipCm', label: 'Heupomvang', unit: 'cm', numeric: true, for: ALL, hint: 'Rond het breedste deel van billen en heupen, voeten tegen elkaar.' },
  { key: 'inseamCm', label: 'Binnenbeenlengte', unit: 'cm', numeric: true, for: ALL, hint: 'Van het kruis tot de vloer, aan de binnenkant van het been.' },
  { key: 'neckCm', label: 'Halsomvang (boordmaat)', unit: 'cm', numeric: true, for: ['Heren'], hint: 'Rond de hals op de hoogte van de adamsappel, één vinger ruimte.' },
  { key: 'sleeveCm', label: 'Armlengte', unit: 'cm', numeric: true, for: ADULTS, hint: 'Van de schouder over de licht gebogen elleboog tot het polsbot.' },
  { key: 'footCm', label: 'Voetlengte', unit: 'cm', numeric: true, for: ALL, hint: 'Hiel tegen de muur, meet tot de langste teen. ’s Avonds meten.' },
  { key: 'shoeEu', label: 'Schoenmaat (EU)', numeric: false, for: ALL, hint: 'De maat die je meestal draagt, bijv. 39 of 42,5.' },
  { key: 'braSize', label: 'BH-maat', numeric: false, for: ['Dames'], hint: 'Bijv. 75C.' },
  { key: 'usualTop', label: 'Gebruikelijke maat bovenkleding', numeric: false, for: ALL, hint: 'Bijv. M, 38 of 128.' },
  { key: 'usualBottom', label: 'Gebruikelijke maat broeken', numeric: false, for: ALL, hint: 'Bijv. W32 L32, 40 of 128.' },
]

export function fieldsFor(dep: Department): MeasureField[] {
  return MEASURE_FIELDS.filter((f) => f.for.includes(dep))
}

export function hasMeasurements(m?: Measurements): boolean {
  return !!m && MEASURE_FIELDS.some((f) => m[f.key] !== undefined && m[f.key] !== '')
}

/** Children grow: ask to measure again after six months. */
export function remeasureDue(p: Profile, now = Date.now()): boolean {
  if (p.department !== 'Kinderen' || !p.measurements) return false
  return now - p.measurements.updatedAt > 182 * 24 * 3600 * 1000
}

export function formatMeasurements(p: Profile): string {
  const m = p.measurements
  if (!hasMeasurements(m)) return 'Geen afmetingen bekend.'
  const lines = fieldsFor(p.department)
    .filter((f) => m![f.key] !== undefined && m![f.key] !== '')
    .map((f) => `${f.label}: ${m![f.key]}${f.unit ? ` ${f.unit}` : ''}`)
  lines.push(`Gemeten op ${new Date(m!.updatedAt).toLocaleDateString('nl-NL')}.`)
  return lines.join('\n')
}

export interface KnownSize {
  brand: string
  category: string
  size: string
  fit?: string
  name: string
}

/** Sizes this person already owns per brand, with how they fit: the best evidence for how a brand falls. */
export function knownSizes(items: Item[]): KnownSize[] {
  return items
    .filter((i) => i.size && i.brand)
    .map((i) => ({ brand: i.brand, category: i.category, size: i.size!, fit: i.fit, name: i.name }))
    .sort((a, b) => a.brand.localeCompare(b.brand))
}

export function formatKnownSizes(list: KnownSize[]): string {
  if (!list.length) return 'Nog geen maten per merk bekend.'
  return list
    .map((k) => `- ${k.brand}, ${k.category} (${k.name}): maat ${k.size}${k.fit ? `, ${k.fit.toLowerCase()}` : ''}`)
    .join('\n')
}
