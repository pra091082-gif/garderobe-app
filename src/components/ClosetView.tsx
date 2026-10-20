import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { CATEGORIES, COLORS, SEASONS, db, type Category, type Season } from '../db'
import { ItemDetail } from './ItemDetail'
import { ItemForm } from './ItemForm'
import { Chip, ColorDot, Photo, Sheet } from './ui'

type Panel = { kind: 'new' } | { kind: 'detail'; id: string } | { kind: 'edit'; id: string }

export function ClosetView() {
  const items = useLiveQuery(() => db.items.orderBy('createdAt').reverse().toArray())
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>()
  const [season, setSeason] = useState<Season>()
  const [color, setColor] = useState<string>()
  const [favorites, setFavorites] = useState(false)
  const [panel, setPanel] = useState<Panel>()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (items ?? []).filter(
      (i) =>
        (!category || i.category === category) &&
        (!season || i.seasons.includes(season)) &&
        (!color || i.colors.includes(color)) &&
        (!favorites || i.favorite) &&
        (!q || `${i.name} ${i.brand} ${i.notes}`.toLowerCase().includes(q)),
    )
  }, [items, query, category, season, color, favorites])

  const current = panel && panel.kind !== 'new' ? items?.find((i) => i.id === panel.id) : undefined
  const hasFilters = !!(category || season || color || favorites || query)

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Zoeken…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="chips scroll-x">
        <Chip active={favorites} onClick={() => setFavorites(!favorites)}>
          ★ Favorieten
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(category === c ? undefined : c)}>
            {c}
          </Chip>
        ))}
      </div>
      <div className="chips scroll-x">
        {SEASONS.map((s) => (
          <Chip key={s} active={season === s} onClick={() => setSeason(season === s ? undefined : s)}>
            {s}
          </Chip>
        ))}
        {Object.keys(COLORS).map((c) => (
          <Chip key={c} active={color === c} onClick={() => setColor(color === c ? undefined : c)}>
            <ColorDot color={c} /> {c}
          </Chip>
        ))}
      </div>

      {items && items.length === 0 ? (
        <div className="empty">
          <p className="empty-icon">👗</p>
          <p>Je kast is nog leeg.</p>
          <button className="btn btn-primary" onClick={() => setPanel({ kind: 'new' })}>
            Eerste kledingstuk toevoegen
          </button>
        </div>
      ) : (
        <>
          <p className="count">
            {filtered.length} {filtered.length === 1 ? 'kledingstuk' : 'kledingstukken'}
            {hasFilters && items && ` van ${items.length}`}
          </p>
          <ul className="grid">
            {filtered.map((i) => (
              <li key={i.id}>
                <button className="card" onClick={() => setPanel({ kind: 'detail', id: i.id })}>
                  <Photo item={i} />
                  <span className="card-name">
                    {i.favorite && <span className="star">★ </span>}
                    {i.name}
                  </span>
                  <span className="card-colors">
                    {i.colors.map((c) => (
                      <ColorDot key={c} color={c} size={10} />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="fab" onClick={() => setPanel({ kind: 'new' })} aria-label="Kledingstuk toevoegen">
        +
      </button>

      {panel?.kind === 'new' && (
        <Sheet title="Nieuw kledingstuk" onClose={() => setPanel(undefined)}>
          <ItemForm onDone={(saved) => setPanel(saved ? { kind: 'detail', id: saved.id } : undefined)} />
        </Sheet>
      )}
      {panel?.kind === 'detail' && current && (
        <Sheet title={current.name} onClose={() => setPanel(undefined)}>
          <ItemDetail
            item={current}
            onEdit={() => setPanel({ kind: 'edit', id: current.id })}
            onClose={() => setPanel(undefined)}
          />
        </Sheet>
      )}
      {panel?.kind === 'edit' && current && (
        <Sheet title="Bewerken" onClose={() => setPanel({ kind: 'detail', id: current.id })}>
          <ItemForm item={current} onDone={() => setPanel({ kind: 'detail', id: current.id })} />
        </Sheet>
      )}
    </section>
  )
}
