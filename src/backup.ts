import { db, type Item, type Outfit } from './db'
import { blobToDataUrl, dataUrlToBlob } from './media'

interface BackupFile {
  app: 'garderobe'
  version: 1
  exportedAt: string
  items: (Omit<Item, 'photo'> & { photo?: string })[]
  outfits: Outfit[]
}

export async function exportBackup(): Promise<Blob> {
  const items = await db.items.toArray()
  const data: BackupFile = {
    app: 'garderobe',
    version: 1,
    exportedAt: new Date().toISOString(),
    items: await Promise.all(
      items.map(async ({ photo, ...rest }) => ({
        ...rest,
        photo: photo ? await blobToDataUrl(photo) : undefined,
      })),
    ),
    outfits: await db.outfits.toArray(),
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

/** Merges a backup into the database; existing entries with the same id are overwritten. */
export async function importBackup(file: File): Promise<{ items: number; outfits: number }> {
  const data = JSON.parse(await file.text()) as BackupFile
  if (data.app !== 'garderobe' || !Array.isArray(data.items)) {
    throw new Error('Dit is geen geldig garderobe-backupbestand.')
  }
  const items: Item[] = await Promise.all(
    data.items.map(async ({ photo, ...rest }) => ({
      ...rest,
      photo: photo ? await dataUrlToBlob(photo) : undefined,
    })),
  )
  const outfits = data.outfits ?? []
  await db.transaction('rw', db.items, db.outfits, async () => {
    await db.items.bulkPut(items)
    await db.outfits.bulkPut(outfits)
  })
  return { items: items.length, outfits: outfits.length }
}
