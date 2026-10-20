import { useState } from 'react'
import type { Inspiration as Result } from '../ai'
import { addFeedback, addOutfit, type Item } from '../db'
import { useFeedback, useProfile, useProfileItems } from '../profile'
import { useSettings } from '../settings'
import { Icon } from './icons'
import { Photo } from './ui'

/** Web-sourced outfit ideas for one item, matched to the rest of the closet. */
export function Inspiration({ item }: { item: Item }) {
  const { anthropicKey } = useSettings()
  const profile = useProfile()
  const wardrobe = useProfileItems(profile.id) ?? []
  useFeedback(profile.id)
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
      setResult(await findInspiration(profile, item, wardrobe))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function save(i: number) {
    const idea = result!.ideas[i]
    const ids = [item.id, ...idea.matchingItemIds]
    await addOutfit(profile.id, idea.title, ids, [idea.description, idea.sourceUrl].filter(Boolean).join('\n'))
    await addFeedback({ profileId: profile.id, kind: 'saved', text: `Inspiratie "${idea.title}": ${idea.description}`, itemIds: ids })
    setSaved((s) => [...s, i])
  }

  if (!result)
    return (
      <>
        <button className="btn" disabled={busy} onClick={search}>
          <Icon name="globe" size={18} /> {busy ? 'Internet doorzoeken…' : 'Inspiratie van internet'}
        </button>
        {error && <p className="error">{error}</p>}
      </>
    )

  return (
    <div className="page" style={{ gap: 12 }}>
      <h3 className="section-title">Zo draag je het</h3>
      {result.ideas.length === 0 && <p className="muted">Niets gevonden voor dit stuk.</p>}
      {result.ideas.map((idea, i) => (
        <div key={i} className="result">
          <h3>{idea.title}</h3>
          <p className="muted">{idea.description}</p>
          {idea.matchingItemIds.length > 0 && (
            <>
              <span className="eyebrow">Uit je eigen kast</span>
              <ul className="grid grid-tiny">
                {idea.matchingItemIds.map((id) => (
                  <li key={id} className="card card-static" title={byId.get(id)?.name}>
                    <Photo item={byId.get(id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="form-actions start">
            <button className="btn btn-primary btn-small" disabled={saved.includes(i)} onClick={() => save(i)}>
              {saved.includes(i) ? 'Opgeslagen' : 'Als outfit opslaan'}
            </button>
            {idea.sourceUrl && (
              <a className="btn btn-small" href={idea.sourceUrl} target="_blank" rel="noopener noreferrer">
                Bekijk bron <Icon name="arrowRight" size={16} />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
