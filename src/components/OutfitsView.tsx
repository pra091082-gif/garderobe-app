import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { CATEGORIES, SEASONS, db, markWorn, newId, type Item, type Outfit, type Season } from '../db'
import { currentSeason, suggestOutfit, toggle } from '../util'
import { Chip, Photo, Sheet } from './ui'

type Panel = { kind: 'new'; preset?: string[] } | { kind: 'detail'; id: string } | { kind: 'edit'; id: string }

export function OutfitsView() {
  const outfits = useLiveQuery(() => db.outfits.orderBy('createdAt').reverse().toArray())
  const items = useLiveQuery(() => db.items.toArray()) ?? []
  const byId = new Map(items.map((i) => [i.id, i]))
  const [panel, setPanel] = useState<Panel>()
  const [season, setSeason] = useState<Season>(currentSeason())

  const current = panel && panel.kind !== 'new' ? outfits?.find((o) => o.id === panel.id) : undefined

  function surprise() {
    const ids = suggestOutfit(items, season)
    if (ids.length === 0) alert('Voeg eerst wat meer kleding toe (bijv. een top en een broek).')
    else setPanel({ kind: 'new', preset: ids })
  }

  return (
    <section>
      <div className="suggest-box">
        <p>
          <strong>Wat trek ik aan?</strong> Laat de app een combinatie voorstellen.
        </p>
        <div className="chips">
          {SEASONS.map((s) => (
            <Chip key={s} active={season === s} onClick={() => setSeason(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <button className="btn btn-primary" onClick={surprise}>
          🎲 Verras me
        </button>
      </div>

      {outfits && outfits.length === 0 ? (
        <div className="empty">
          <p className="empty-icon">✨</p>
          <p>Nog geen outfits opgeslagen.</p>
        </div>
      ) : (
        <ul className="grid">
          {outfits?.map((o) => (
            <li key={o.id}>
              <button className="card" onClick={() => setPanel({ kind: 'detail', id: o.id })}>
                <Collage items={o.itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i)} />
                <span className="card-name">{o.name}</span>
                <span className="card-sub">{o.itemIds.length} stuks</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="fab" onClick={() => setPanel({ kind: 'new' })} aria-label="Outfit samenstellen">
        +
      </button>

      {panel?.kind === 'new' && (
        <Sheet title="Outfit samenstellen" onClose={() => setPanel(undefined)}>
          <OutfitForm
            items={items}
            preset={panel.preset}
            onDone={(saved) => setPanel(saved ? { kind: 'detail', id: saved.id } : undefined)}
          />
        </Sheet>
      )}
      {panel?.kind === 'detail' && current && (
        <Sheet title={current.name} onClose={() => setPanel(undefined)}>
          <OutfitDetail
            outfit={current}
            items={current.itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i)}
            onEdit={() => setPanel({ kind: 'edit', id: current.id })}
            onClose={() => setPanel(undefined)}
          />
        </Sheet>
      )}
      {panel?.kind === 'edit' && current && (
        <Sheet title="Outfit bewerken" onClose={() => setPanel({ kind: 'detail', id: current.id })}>
          <OutfitForm items={items} outfit={current} onDone={() => setPanel({ kind: 'detail', id: current.id })} />
        </Sheet>
      )}
    </section>
  )
}

function Collage({ items }: { items: Item[] }) {
  const shown = items.slice(0, 4)
  return (
    <div className={`collage collage-${Math.max(shown.length, 1)}`}>
      {shown.length === 0 ? <Photo /> : shown.map((i) => <Photo key={i.id} item={i} />)}
    </div>
  )
}

function OutfitDetail({
  outfit,
  items,
  onEdit,
  onClose,
}: {
  outfit: Outfit
  items: Item[]
  onEdit: () => void
  onClose: () => void
}) {
  const [worn, setWorn] = useState(false)

  async function onDelete() {
    if (!confirm(`Outfit "${outfit.name}" verwijderen? De kledingstukken blijven bewaard.`)) return
    await db.outfits.delete(outfit.id)
    onClose()
  }

  return (
    <div className="detail">
      <ul className="grid grid-small">
        {items.map((i) => (
          <li key={i.id} className="card card-static">
            <Photo item={i} />
            <span className="card-name">{i.name}</span>
          </li>
        ))}
      </ul>
      {outfit.notes && <p className="notes">{outfit.notes}</p>}
      <div className="form-actions">
        <button className="btn btn-danger" onClick={onDelete}>
          Verwijderen
        </button>
        <button className="btn" onClick={onEdit}>
          Bewerken
        </button>
        <button
          className="btn btn-primary"
          disabled={worn}
          onClick={async () => {
            await markWorn(outfit.itemIds)
            setWorn(true)
          }}
        >
          {worn ? 'Genoteerd ✓' : 'Vandaag gedragen'}
        </button>
      </div>
    </div>
  )
}

function OutfitForm({
  items,
  outfit,
  preset,
  onDone,
}: {
  items: Item[]
  outfit?: Outfit
  preset?: string[]
  onDone: (saved?: Outfit) => void
}) {
  const [name, setName] = useState(outfit?.name ?? '')
  const [notes, setNotes] = useState(outfit?.notes ?? '')
  const [selected, setSelected] = useState<string[]>(outfit?.itemIds ?? preset ?? [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const saved: Outfit = {
      id: outfit?.id ?? newId(),
      name: name.trim() || `Outfit ${new Date().toLocaleDateString('nl-NL')}`,
      itemIds: selected,
      notes: notes.trim(),
      createdAt: outfit?.createdAt ?? Date.now(),
    }
    await db.outfits.put(saved)
    onDone(saved)
  }

  if (items.length === 0) return <p>Voeg eerst kleding toe aan je kast.</p>

  return (
    <form className="form" onSubmit={onSubmit}>
      <label className="field">
        <span>Naam</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. kantoor maandag" />
      </label>

      {CATEGORIES.map((c) => {
        const inCat = items.filter((i) => i.category === c)
        if (inCat.length === 0) return null
        return (
          <fieldset key={c} className="field">
            <legend>{c}</legend>
            <ul className="grid grid-small">
              {inCat.map((i) => {
                const on = selected.includes(i.id)
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      className={`card ${on ? 'card-selected' : ''}`}
                      aria-pressed={on}
                      onClick={() => setSelected(toggle(selected, i.id))}
                    >
                      <Photo item={i} />
                      <span className="card-name">{i.name}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </fieldset>
        )
      })}

      <label className="field">
        <span>Notities</span>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="form-actions sticky-actions">
        <button type="button" className="btn" onClick={() => onDone()}>
          Annuleren
        </button>
        <button type="submit" className="btn btn-primary" disabled={selected.length === 0}>
          Opslaan ({selected.length})
        </button>
      </div>
    </form>
  )
}
