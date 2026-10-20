import Dexie, { type EntityTable } from 'dexie'

export const CATEGORIES = [
  'Tops',
  'Broeken',
  'Rokken',
  'Jurken',
  'Truien & vesten',
  'Jassen',
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

export interface Item {
  id: string
  name: string
  category: Category
  colors: string[]
  seasons: Season[]
  brand: string
  notes: string
  favorite: boolean
  photo?: Blob
  wornCount: number
  lastWorn?: number
  createdAt: number
}

export interface Outfit {
  id: string
  name: string
  itemIds: string[]
  notes: string
  createdAt: number
}

export const db = new Dexie('garderobe') as Dexie & {
  items: EntityTable<Item, 'id'>
  outfits: EntityTable<Outfit, 'id'>
}

db.version(1).stores({
  items: 'id, category, createdAt, favorite',
  outfits: 'id, createdAt, *itemIds',
})

export function newId(): string {
  return crypto.randomUUID()
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

/** Registers that an outfit (or single item) was worn today. */
export async function markWorn(itemIds: string[]): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.items, async () => {
    for (const id of itemIds) {
      const item = await db.items.get(id)
      if (item) await db.items.update(id, { wornCount: item.wornCount + 1, lastWorn: now })
    }
  })
}
