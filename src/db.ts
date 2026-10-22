import Dexie, { type EntityTable } from 'dexie'

export const CATEGORIES = [
  'Tops',
  'Overhemden & blouses',
  'Broeken',
  'Rokken',
  'Jurken',
  'Truien & vesten',
  'Blazers & colberts',
  'Jassen',
  'Sportkleding',
  'Schoenen',
  'Accessoires',
  'Overig',
] as const
export type Category = (typeof CATEGORIES)[number]

export const SEASONS = ['Lente', 'Zomer', 'Herfst', 'Winter'] as const
export type Season = (typeof SEASONS)[number]

export const COLORS: Record<string, string> = {
  Zwart: '#1f1f1f',
  Wit: '#f7f7f7',
  Grijs: '#9a9a9a',
  Beige: '#d9c7a7',
  Bruin: '#7a5236',
  Rood: '#c8323b',
  Roze: '#ec9bb5',
  Oranje: '#ec8a33',
  Geel: '#f1cf3b',
  Groen: '#4f8a4b',
  Blauw: '#3466b4',
  Navy: '#1f2f55',
  Paars: '#7d4fa3',
  Multi: 'conic-gradient(#c8323b, #f1cf3b, #4f8a4b, #3466b4, #7d4fa3, #c8323b)',
}

/** Department, as in a web shop. */
export const DEPARTMENTS = ['Dames', 'Heren', 'Kinderen'] as const
export type Department = (typeof DEPARTMENTS)[number]

export const DRESSCODES = ['Casual', 'Smart casual', 'Business casual', 'Business', 'Formeel', 'Uniform / werkkleding'] as const
export type Dresscode = (typeof DRESSCODES)[number]

export const OCCASIONS = ['Werk', 'Vrije tijd', 'Avondje uit', 'Sport', 'Feest', 'School'] as const
export type Occasion = (typeof OCCASIONS)[number]

/** Categories that make sense per department (used for pickers and filters). */
export function categoriesFor(dep: Department): Category[] {
  return dep === 'Heren' ? CATEGORIES.filter((c) => c !== 'Rokken' && c !== 'Jurken') : [...CATEGORIES]
}

export function occasionsFor(profile: Profile): Occasion[] {
  return OCCASIONS.filter((o) => (o === 'Werk' ? !!profile.job : o === 'School' ? profile.department === 'Kinderen' : true))
}

export interface Job {
  title: string
  company: string
  industry: string
  dresscode: Dresscode
}

/** What the AI has learned about someone's taste. */
export interface StyleProfile {
  summary: string
  styles: string[]
  colors: string[]
  avoid: string[]
  fit: string
  updatedAt: number
  /** Feedback count when the profile was last derived; used to suggest an update. */
  feedbackCount: number
}

/** One completed style test. The test can be taken once per season, so at most four times a year. */
export interface QuizRecord {
  period: string
  season: Season
  at: number
}

/** Body measurements in cm (shoe size in EU), plus the sizes someone usually wears. All optional. */
export interface Measurements {
  heightCm?: number
  weightKg?: number
  chestCm?: number
  underbustCm?: number
  waistCm?: number
  hipCm?: number
  inseamCm?: number
  neckCm?: number
  sleeveCm?: number
  footCm?: number
  shoeEu?: string
  braSize?: string
  usualTop?: string
  usualBottom?: string
  updatedAt: number
}

/** How a size turned out for this person. */
export const FITS = ['Valt klein', 'Past goed', 'Valt groot'] as const
export type Fit = (typeof FITS)[number]

export interface Profile {
  id: string
  name: string
  department: Department
  age?: number
  job?: Job
  style?: StyleProfile
  quizzes?: QuizRecord[]
  measurements?: Measurements
  createdAt: number
}

export interface Item {
  id: string
  profileId: string
  name: string
  category: Category
  colors: string[]
  seasons: Season[]
  brand: string
  notes: string
  favorite: boolean
  photo?: Blob
  /** Shop image used when the photo could not be downloaded (cross-origin). */
  photoUrl?: string
  /** Where it came from: added by hand, a Gmail order mail, or a shop screenshot or product link. */
  source: 'manual' | 'gmail' | 'shop'
  shop?: string
  size?: string
  price?: number
  purchasedAt?: string
  /** How this size fits; teaches the size advice how each brand falls. */
  fit?: Fit
  wornCount: number
  lastWorn?: number
  createdAt: number
}

/** Bought in an online shop (imported from mail, a screenshot or a product link). */
export function boughtOnline(item: Item): boolean {
  return item.source !== 'manual'
}

export interface Outfit {
  id: string
  profileId: string
  name: string
  itemIds: string[]
  occasion?: Occasion
  notes: string
  createdAt: number
}

/** A Gmail message that has been looked at, so it is not imported twice. */
export interface ImportedMail {
  id: string
  shop: string
  subject: string
  date: number
  itemCount: number
  importedAt: number
}

/** Signals the stylist learns from. */
export interface Feedback {
  id: string
  profileId: string
  kind: 'quiz' | 'like' | 'dislike' | 'saved' | 'worn'
  /** Human-readable description of what was chosen or rejected. */
  text: string
  itemIds: string[]
  occasion?: Occasion
  createdAt: number
}

export const db = new Dexie('garderobe') as Dexie & {
  items: EntityTable<Item, 'id'>
  outfits: EntityTable<Outfit, 'id'>
  mails: EntityTable<ImportedMail, 'id'>
  profiles: EntityTable<Profile, 'id'>
  feedback: EntityTable<Feedback, 'id'>
}

db.version(1).stores({
  items: 'id, category, createdAt, favorite',
  outfits: 'id, createdAt, *itemIds',
})
db.version(2)
  .stores({
    items: 'id, category, createdAt, favorite, source',
    outfits: 'id, createdAt, *itemIds',
    mails: 'id, date',
  })
  .upgrade((tx) =>
    tx
      .table('items')
      .toCollection()
      .modify((i: Item) => {
        i.source ??= 'manual'
      }),
  )
// v3: profiles. Items and outfits from before profiles existed have profileId '' and are
// adopted by the first profile that is created (see createProfile).
db.version(3)
  .stores({
    items: 'id, profileId, category, createdAt, favorite, source',
    outfits: 'id, profileId, createdAt, *itemIds',
    mails: 'id, date',
    profiles: 'id, createdAt',
    feedback: 'id, profileId, createdAt',
  })
  .upgrade(async (tx) => {
    await tx.table('items').toCollection().modify((i: Item) => {
      i.profileId ??= ''
    })
    await tx.table('outfits').toCollection().modify((o: Outfit) => {
      o.profileId ??= ''
    })
  })

export function newId(): string {
  return crypto.randomUUID()
}

export async function createProfile(p: Omit<Profile, 'id' | 'createdAt'>): Promise<Profile> {
  const profile: Profile = { ...p, id: newId(), createdAt: Date.now() }
  await db.transaction('rw', db.profiles, db.items, db.outfits, async () => {
    const first = (await db.profiles.count()) === 0
    await db.profiles.add(profile)
    if (first) {
      await db.items.where('profileId').equals('').modify({ profileId: profile.id })
      await db.outfits.where('profileId').equals('').modify({ profileId: profile.id })
    }
  })
  return profile
}

export async function deleteProfile(id: string): Promise<void> {
  await db.transaction('rw', [db.profiles, db.items, db.outfits, db.feedback], async () => {
    await db.items.where('profileId').equals(id).delete()
    await db.outfits.where('profileId').equals(id).delete()
    await db.feedback.where('profileId').equals(id).delete()
    await db.profiles.delete(id)
  })
}

/** Stores the outcome of a style test and counts it for its season. */
export async function saveQuizResult(profileId: string, style: StyleProfile, period: string, season: Season): Promise<void> {
  await db.transaction('rw', db.profiles, async () => {
    const p = await db.profiles.get(profileId)
    if (!p) return
    await db.profiles.update(profileId, { style, quizzes: [...(p.quizzes ?? []), { period, season, at: Date.now() }] })
  })
}

export async function saveMeasurements(profileId: string, m: Omit<Measurements, 'updatedAt'>): Promise<void> {
  await db.profiles.update(profileId, { measurements: { ...m, updatedAt: Date.now() } })
}

export async function addFeedback(f: Omit<Feedback, 'id' | 'createdAt'>): Promise<void> {
  await db.feedback.add({ ...f, id: newId(), createdAt: Date.now() })
}

export async function addOutfit(
  profileId: string,
  name: string,
  itemIds: string[],
  notes = '',
  occasion?: Occasion,
): Promise<void> {
  await db.outfits.add({ id: newId(), profileId, name, itemIds, notes, occasion, createdAt: Date.now() })
}

export async function deleteItem(id: string): Promise<void> {
  await db.transaction('rw', db.items, db.outfits, async () => {
    await db.items.delete(id)
    const outfits = await db.outfits.where('itemIds').equals(id).toArray()
    for (const o of outfits) {
      await db.outfits.update(o.id, { itemIds: o.itemIds.filter((i) => i !== id) })
    }
  })
}

/** Registers that an outfit (or single item) was worn today; this also teaches the stylist. */
export async function markWorn(itemIds: string[], label?: string): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.items, db.feedback, async () => {
    const names: string[] = []
    let profileId = ''
    for (const id of itemIds) {
      const item = await db.items.get(id)
      if (!item) continue
      await db.items.update(id, { wornCount: item.wornCount + 1, lastWorn: now })
      names.push(item.name)
      profileId = item.profileId
    }
    if (profileId) {
      await db.feedback.add({
        id: newId(),
        profileId,
        kind: 'worn',
        text: `${label ? `${label}: ` : ''}${names.join(' + ')}`,
        itemIds,
        createdAt: now,
      })
    }
  })
}
