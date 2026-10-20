import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import {
  SEASONS,
  addFeedback,
  categoriesFor,
  db,
  markWorn,
  newId,
  occasionsFor,
  type Item,
  type Occasion,
  type Outfit,
  type Season,
} from '../db'
import { useProfile, useProfileItems } from '../profile'
import { currentSeason, suggestOutfit, toggle } from '../util'
import { Icon } from './icons'
import { Chip, Photo, ProductCard, Sheet } from './ui'

type Panel = { kind: 'new'; preset?: string[] } | { kind: 'detail'; id: string } | { kind: 'edit'; id: string }

export function OutfitsView() {
  const profile = useProfile()
  const outfits = useLiveQuery(
    () => db.outfits.where('profileId').equals(profile.id).reverse().sortBy('createdAt'),
    [profile.id],
  )
  const items = useProfileItems(profile.id) ?? []
  const byId = new Map(items.map((i) => [i.id, i]))
  const [panel, setPanel] = useState<Panel>()
  const [season, setSeason] = useState<Season>(currentSeason())
  const [filter, setFilter] = useState<Occasion>()

  const current = panel && panel.kind !== 'new' ? outfits?.find((o) => o.id === panel.id) : undefined
  const shown = (outfits ?? []).filter((o) => !filter || o.occasion === filter)
  const usedOccasions = occasionsFor(profile).filter((oc) => outfits?.some((o) => o.occasion === oc))

  function surprise() {
    const ids = suggestOutfit(items, season)
    if (ids.length === 0) alert('Voeg eerst wat meer kleding toe (bijv. een top en een broek).')
    else setPanel({ kind: 'new', preset: ids })
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{profile.department}</span>
          <h1>Outfits</h1>
        </div>
      </div>

      <div className="panel">
        <p>
          <strong>Snel een idee?</strong> De app kiest een combinatie uit de kast van {profile.name}. Voor advies op
          maat: ga naar de <a href="#stylist">Stylist</a>.
        </p>
        <div className="chips">
          {SEASONS.map((s) => (
            <Chip key={s} active={season === s} onClick={() => setSeason(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="form-actions start">
          <button className="btn btn-primary" onClick={surprise}>
            <Icon name="dice" size={18} /> Verras me
          </button>
        </div>
      </div>

      {usedOccasions.length > 0 && (
        <div className="chips scroll-x">
          <Chip active={!filter} onClick={() => setFilter(undefined)}>
            Alle
          </Chip>
          {usedOccasions.map((o) => (
            <Chip key={o} active={filter === o} onClick={() => setFilter(filter === o ? undefined : o)}>
              {o}
            </Chip>
          ))}
        </div>
      )}

      {outfits && outfits.length === 0 ? (
        <div className="empty">
          <Icon name="outfit" size={40} />
          <h2>Nog geen outfits</h2>
          <p>Stel er zelf een samen, laat je verrassen of vraag de stylist.</p>
        </div>
      ) : (
        <ul className="grid">
          {shown.map((o) => (
            <li key={o.id}>
              <button className="card" onClick={() => setPanel({ kind: 'detail', id: o.id })}>
                <Collage items={o.itemIds.map((id) => byId.get(id)).filter((i): i is Item => !!i)} />
                <span className="card-brand">{o.occasion ?? 'Outfit'}</span>
                <span className="card-name">{o.name}</span>
                <span className="card-sub">{o.itemIds.length} stuks</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="fab" onClick={() => setPanel({ kind: 'new' })}>
        <Icon name="plus" size={20} /> Samenstellen
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
      {outfit.occasion && <span className="badge" style={{ alignSelf: 'flex-start' }}>{outfit.occasion}</span>}
      <ul className="grid grid-small">
        {items.map((i) => (
          <li key={i.id}>
            <ProductCard item={i} />
          </li>
        ))}
      </ul>
      {outfit.notes && <p className="notes">{outfit.notes}</p>}
      <div className="form-actions start">
        <button
          className="btn btn-primary"
          disabled={worn}
          onClick={async () => {
            await markWorn(outfit.itemIds, `Outfit "${outfit.name}"${outfit.occasion ? ` (${outfit.occasion})` : ''}`)
            setWorn(true)
          }}
        >
          <Icon name="check" size={18} /> {worn ? 'Genoteerd' : 'Vandaag gedragen'}
        </button>
        <button className="btn" onClick={onEdit}>
          Bewerken
        </button>
      </div>
      <button className="link-btn" onClick={onDelete}>
        Outfit verwijderen
      </button>
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
  const profile = useProfile()
  const [name, setName] = useState(outfit?.name ?? '')
  const [notes, setNotes] = useState(outfit?.notes ?? '')
  const [occasion, setOccasion] = useState<Occasion | undefined>(outfit?.occasion)
  const [selected, setSelected] = useState<string[]>(outfit?.itemIds ?? preset ?? [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const saved: Outfit = {
      id: outfit?.id ?? newId(),
      profileId: outfit?.profileId ?? profile.id,
      name: name.trim() || `Outfit ${new Date().toLocaleDateString('nl-NL')}`,
      itemIds: selected,
      occasion,
      notes: notes.trim(),
      createdAt: outfit?.createdAt ?? Date.now(),
    }
    await db.outfits.put(saved)
    if (!outfit) {
      // A self-made outfit is a strong signal of taste.
      const names = selected.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean)
      await addFeedback({ profileId: profile.id, kind: 'saved', text: `Zelf samengesteld "${saved.name}": ${names.join(' + ')}`, itemIds: selected, occasion })
    }
    onDone(saved)
  }

  if (items.length === 0) return <p>Voeg eerst kleding toe aan de kast.</p>

  return (
    <form className="form" onSubmit={onSubmit}>
      <label className="field">
        <span>Naam</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. klantafspraak maandag" />
      </label>

      <fieldset className="field">
        <legend>Gelegenheid</legend>
        <div className="chips">
          {occasionsFor(profile).map((o) => (
            <Chip key={o} active={occasion === o} onClick={() => setOccasion(occasion === o ? undefined : o)}>
              {o}
            </Chip>
          ))}
        </div>
      </fieldset>

      {categoriesFor(profile.department).map((c) => {
        const inCat = items.filter((i) => i.category === c)
        if (inCat.length === 0) return null
        return (
          <fieldset key={c} className="field">
            <legend>{c}</legend>
            <ul className="grid grid-small">
              {inCat.map((i) => (
                <li key={i.id}>
                  <ProductCard item={i} selected={selected.includes(i.id)} onClick={() => setSelected(toggle(selected, i.id))} />
                </li>
              ))}
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
