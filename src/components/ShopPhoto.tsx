import { useState } from 'react'
import type { ShopPhoto as Match } from '../ai'
import { db, type Item } from '../db'
import { downloadImage } from '../media'
import { useSettings } from '../settings'
import { Icon } from './icons'
import { Loading } from './ui'

/** Finds the shop's own product photo of a piece and uses it instead of the person's photo. */
export function ShopPhoto({ item }: { item: Item }) {
  const { anthropicKey } = useSettings()
  const [matches, setMatches] = useState<Match[]>()
  const [broken, setBroken] = useState<string[]>([])
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  if (!anthropicKey) return null

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label)
    setError(undefined)
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  const search = () =>
    run('Winkelfoto zoeken…', async () => {
      const { findShopPhotos } = await import('../ai')
      setBroken([])
      setMatches(await findShopPhotos(item))
    })

  const use = (m: Match) =>
    run('Foto overnemen…', async () => {
      // Shops that block downloads are shown from their own URL instead.
      const photo = await downloadImage(m.imageUrl)
      await db.items.update(item.id, {
        photo,
        photoUrl: photo ? undefined : m.imageUrl,
        ownPhoto: item.ownPhoto ?? item.photo,
      })
      setMatches(undefined)
    })

  const restore = () =>
    run('Eigen foto terugzetten…', async () => {
      await db.items.update(item.id, { photo: item.ownPhoto, photoUrl: undefined, ownPhoto: undefined })
    })

  const shown = matches?.filter((m) => !broken.includes(m.imageUrl))

  return (
    <div className="shop-photo">
      <div className="form-actions start">
        <button className="btn" disabled={!!busy} onClick={search}>
          <Icon name="image" size={18} /> {matches ? 'Opnieuw zoeken' : 'Winkelfoto zoeken'}
        </button>
        {item.ownPhoto && (
          <button className="link-btn" disabled={!!busy} onClick={restore}>
            Eigen foto terugzetten
          </button>
        )}
      </div>
      {busy && <Loading>{busy}</Loading>}
      {error && <p className="error">{error}</p>}
      {shown && shown.length === 0 && (
        <p className="muted small">
          Geen winkelfoto gevonden. Vul het merk en de precieze naam in (bijv. van het label) en zoek opnieuw.
        </p>
      )}
      {shown && shown.length > 0 && (
        <>
          <p className="muted small">Kies de foto van jouw stuk. Je eigen foto blijft bewaard.</p>
          <ul className="grid grid-small">
            {shown.map((m) => (
              <li key={m.imageUrl}>
                <button type="button" className="card" disabled={!!busy} onClick={() => use(m)}>
                  <img
                    className="photo"
                    src={m.imageUrl}
                    alt={m.name}
                    referrerPolicy="no-referrer"
                    onError={() => setBroken((b) => [...b, m.imageUrl])}
                  />
                  <span className="card-brand">{m.shop}</span>
                  <span className="card-name">{m.name}</span>
                  <span className="card-sub">{m.match}</span>
                </button>
                <a className="link-btn small" href={m.url} target="_blank" rel="noopener noreferrer">
                  Bekijk in winkel
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
