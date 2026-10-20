import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { StylistResult } from '../ai'
import { SEASONS, addOutfit, db, type Season } from '../db'
import { useSettings } from '../settings'
import { currentSeason } from '../util'
import { Chip, Photo } from './ui'

const OCCASIONS = ['Dagelijks', 'Werk', 'Avondje uit', 'Weekend', 'Sportief', 'Feest']

export function StylistView() {
  const { anthropicKey } = useSettings()
  const items = useLiveQuery(() => db.items.toArray()) ?? []
  const byId = new Map(items.map((i) => [i.id, i]))
  const [season, setSeason] = useState<Season>(currentSeason())
  const [occasion, setOccasion] = useState('Dagelijks')
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [result, setResult] = useState<StylistResult>()
  const [saved, setSaved] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const onlineCount = items.filter((i) => i.source === 'gmail').length

  async function ask() {
    setBusy(true)
    setError(undefined)
    setResult(undefined)
    setSaved([])
    try {
      // "Only online purchases" still lets the stylist add shoes/accessories from the rest of the closet.
      const pool = onlyOnline
        ? items.filter((i) => i.source === 'gmail' || i.category === 'Schoenen' || i.category === 'Accessoires')
        : items
      const { styleOutfits } = await import('../ai')
      setResult(await styleOutfits(pool, { season, occasion }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function save(i: number) {
    const o = result!.outfits[i]
    await addOutfit(o.name, o.itemIds, o.why)
    setSaved((s) => [...s, i])
  }

  return (
    <section className="settings">
      <h2>AI-stylist</h2>
      <p className="muted">Claude bekijkt de foto’s in je kast en stelt outfits samen met jouw eigen stukken.</p>

      {!anthropicKey ? (
        <p className="message">
          Vul eerst je Claude API-sleutel in onder <a href="#meer">Meer → Koppelingen</a>.
        </p>
      ) : (
        <div className="suggest-box">
          <div className="chips">
            {SEASONS.map((s) => (
              <Chip key={s} active={season === s} onClick={() => setSeason(s)}>
                {s}
              </Chip>
            ))}
          </div>
          <div className="chips">
            {OCCASIONS.map((o) => (
              <Chip key={o} active={occasion === o} onClick={() => setOccasion(o)}>
                {o}
              </Chip>
            ))}
          </div>
          {onlineCount > 0 && (
            <label className="check">
              <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} />
              Vooral mijn online aankopen gebruiken ({onlineCount})
            </label>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={ask}>
            {busy ? 'Stylist denkt na…' : '✨ Stel outfits voor'}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {result?.outfits.map((o, i) => (
        <div key={i} className="order">
          <header>
            <strong>{o.name}</strong>
          </header>
          <ul className="grid grid-small">
            {o.itemIds.map((id) => (
              <li key={id} className="card card-static">
                <Photo item={byId.get(id)} />
                <span className="card-name">{byId.get(id)?.name}</span>
              </li>
            ))}
          </ul>
          <p className="muted">{o.why}</p>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={saved.includes(i)} onClick={() => save(i)}>
              {saved.includes(i) ? 'Opgeslagen ✓' : 'Opslaan als outfit'}
            </button>
          </div>
        </div>
      ))}
      {result?.missing && (
        <p className="message">
          💡 <strong>Tip:</strong> {result.missing}
        </p>
      )}
    </section>
  )
}
