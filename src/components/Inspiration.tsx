import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { Inspiration as Result } from '../ai'
import { addOutfit, db, type Item } from '../db'
import { useSettings } from '../settings'
import { Photo } from './ui'

/** Web-sourced outfit ideas for one item, matched to the rest of the closet. */
export function Inspiration({ item }: { item: Item }) {
  const { anthropicKey } = useSettings()
  const wardrobe = useLiveQuery(() => db.items.toArray()) ?? []
  const byId = new Map(wardrobe.map((i) => [i.id, i]))
  const [result, setResult] = useState<Result>()
  const [saved, setSaved] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (!anthropicKey) return null

  async function search() {
    setBusy(true)
    setError(undefined)
    try {
      const { findInspiration } = await import('../ai')
      setResult(await findInspiration(item, wardrobe))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function save(i: number) {
    const idea = result!.ideas[i]
    await addOutfit(
      idea.title,
      [item.id, ...idea.matchingItemIds],
      [idea.description, idea.sourceUrl].filter(Boolean).join('\n'),
    )
    setSaved((s) => [...s, i])
  }

  if (!result)
    return (
      <>
        <button className="btn" disabled={busy} onClick={search}>
          {busy ? 'Internet doorzoeken…' : '🌐 Inspiratie van internet'}
        </button>
        {error && <p className="error">{error}</p>}
      </>
    )

  return (
    <div className="inspiration">
      <h3>Inspiratie van internet</h3>
      {result.ideas.length === 0 && <p className="muted">Niets gevonden voor dit stuk.</p>}
      {result.ideas.map((idea, i) => (
        <div key={i} className="order">
          <strong>{idea.title}</strong>
          <p className="muted">{idea.description}</p>
          {idea.matchingItemIds.length > 0 && (
            <>
              <span className="small">Uit je eigen kast:</span>
              <ul className="grid grid-tiny">
                {idea.matchingItemIds.map((id) => (
                  <li key={id} className="card card-static" title={byId.get(id)?.name}>
                    <Photo item={byId.get(id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="form-actions">
            {idea.sourceUrl && (
              <a className="btn" href={idea.sourceUrl} target="_blank" rel="noopener noreferrer">
                Bekijk bron ↗
              </a>
            )}
            <button className="btn btn-primary" disabled={saved.includes(i)} onClick={() => save(i)}>
              {saved.includes(i) ? 'Opgeslagen ✓' : 'Als outfit opslaan'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
