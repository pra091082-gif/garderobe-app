import { db, type Feedback, type Item, type Outfit, type Profile } from './db'
import { blobToDataUrl, dataUrlToBlob } from './media'

interface BackupFile {
  app: 'garderobe'
  version: 1 | 2
  exportedAt: string
  items: (Omit<Item, 'photo' | 'ownPhoto'> & { photo?: string; ownPhoto?: string })[]
  outfits: Outfit[]
  profiles?: Profile[]
  feedback?: Feedback[]
}

export async function exportBackup(): Promise<Blob> {
  const items = await db.items.toArray()
  const data: BackupFile = {
    app: 'garderobe',
    version: 2,
    exportedAt: new Date().toISOString(),
    items: await Promise.all(
      items.map(async ({ photo, ownPhoto, ...rest }) => ({
        ...rest,
        photo: photo ? await blobToDataUrl(photo) : undefined,
        ownPhoto: ownPhoto ? await blobToDataUrl(ownPhoto) : undefined,
      })),
    ),
    outfits: await db.outfits.toArray(),
    profiles: await db.profiles.toArray(),
    feedback: await db.feedback.toArray(),
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

/**
 * Merges a backup into the database; existing entries with the same id are overwritten.
 * Entries from a backup made before profiles existed go to the first profile on this device.
 */
export async function importBackup(file: File): Promise<{ profiles: number; items: number; outfits: number }> {
  const data = JSON.parse(await file.text()) as BackupFile
  if (data.app !== 'garderobe' || !Array.isArray(data.items)) {
    throw new Error('Dit is geen geldig garderobe-backupbestand.')
  }
  const profiles = data.profiles ?? []
  const fallback = profiles[0]?.id ?? (await db.profiles.orderBy('createdAt').first())?.id ?? ''
  const items: Item[] = await Promise.all(
    data.items.map(async ({ photo, ownPhoto, ...rest }) => ({
      ...rest,
      profileId: rest.profileId || fallback,
      source: rest.source ?? 'manual',
      photo: photo ? await dataUrlToBlob(photo) : undefined,
      ownPhoto: ownPhoto ? await dataUrlToBlob(ownPhoto) : undefined,
    })),
  )
  const outfits = (data.outfits ?? []).map((o) => ({ ...o, profileId: o.profileId || fallback }))
  await db.transaction('rw', [db.items, db.outfits, db.profiles, db.feedback], async () => {
    await db.profiles.bulkPut(profiles)
    await db.items.bulkPut(items)
    await db.outfits.bulkPut(outfits)
    await db.feedback.bulkPut(data.feedback ?? [])
  })
  return { profiles: profiles.length, items: items.length, outfits: outfits.length }
}
