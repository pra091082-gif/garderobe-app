import { useState } from 'react'
import { db, newId, type Item } from '../db'
import { resizeImage } from '../media'
import { useProfile, useProfileItems } from '../profile'
import { useSettings } from '../settings'
import { currentSeason } from '../util'
import { Icon } from './icons'
import { Loading, PhotoButtons, ProductCard } from './ui'

/** Many photos at once: each photo becomes a piece, filled in by the AI when a key is set. */
export function PhotoBatch({ onOpen, onDone }: { onOpen: (id: string) => void; onDone: () => void }) {
  const profile = useProfile()
  const { anthropicKey } = useSettings()
  const items = useProfileItems(profile.id)
  const [ids, setIds] = useState<string[]>([])
  // Live from the database, so pieces corrected in between show up to date.
  const added = items?.filter((i) => ids.includes(i.id)) ?? []
  const [status, setStatus] = useState<string>()
  const [errors, setErrors] = useState<string[]>([])

  async function onFiles(files: File[]) {
    setErrors([])
    const recognizeItem = anthropicKey ? (await import('../ai')).recognizeItem : undefined
    for (const [n, file] of files.entries()) {
      setStatus(`Foto ${n + 1} van ${files.length}${recognizeItem ? ' herkennen' : ' opslaan'}…`)
      let photo: Blob
      try {
        photo = await resizeImage(file)
      } catch {
        setErrors((e) => [...e, `${file.name || `Foto ${n + 1}`} kon niet worden geladen.`])
        continue
      }
      const item: Item = {
        id: newId(),
        profileId: profile.id,
        name: 'Nieuw kledingstuk',
        category: 'Overig',
        colors: [],
        seasons: [],
        brand: '',
        notes: '',
        favorite: false,
        photo,
        source: 'manual',
        wornCount: 0,
        createdAt: Date.now(),
      }
      if (recognizeItem) {
        try {
          const guess = await recognizeItem(photo, profile.department)
          Object.assign(item, { ...guess, seasons: guess.seasons.length ? guess.seasons : [currentSeason()] })
        } catch (e) {
          setErrors((all) => [...all, e instanceof Error ? e.message : String(e)])
        }
      }
      await db.items.add(item)
      setIds((a) => [...a, item.id])
    }
    setStatus(undefined)
  }

  return (
    <div className="form">
      <p>
        Leg je kleding één voor één neer en maak een foto, of kies meerdere foto's tegelijk uit je galerij. Elk stuk
        komt direct in de kast van {profile.name}.
        {anthropicKey
          ? ' De AI vult naam, soort, kleur en seizoen in; controleren kan daarna.'
          : ' Zonder Claude API-sleutel vul je naam en soort daarna zelf in.'}
      </p>
      <PhotoButtons multiple galleryLabel="Foto's kiezen" disabled={!!status} onFiles={onFiles} />
      {status && <Loading>{status}</Loading>}
      {errors.map((e, i) => (
        <p key={i} className="error">
          {e}
        </p>
      ))}
      {added.length > 0 && (
        <>
          <p className="count">
            <Icon name="check" size={16} /> {added.length} {added.length === 1 ? 'stuk' : 'stukken'} toegevoegd. Tik
            erop om te controleren.
          </p>
          <ul className="grid">
            {added.map((i) => (
              <li key={i.id}>
                <ProductCard item={i} onClick={() => onOpen(i.id)} />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="form-actions">
        <button type="button" className="btn btn-primary" disabled={!!status} onClick={onDone}>
          Klaar
        </button>
      </div>
    </div>
  )
}
