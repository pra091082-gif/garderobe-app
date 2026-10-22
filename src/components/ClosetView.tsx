import { useMemo, useState } from 'react'
import { COLORS, SEASONS, boughtOnline, categoriesFor, type Category, type Season } from '../db'
import { useProfile, useProfileItems } from '../profile'
import { Icon } from './icons'
import { ItemDetail } from './ItemDetail'
import { ItemForm } from './ItemForm'
import { PhotoBatch } from './PhotoBatch'
import { Chip, ColorDot, ProductCard, Sheet } from './ui'

type Panel = { kind: 'new' } | { kind: 'batch' } | { kind: 'detail'; id: string } | { kind: 'edit'; id: string }
type Sort = 'new' | 'worn' | 'least'

export function ClosetView() {
  const profile = useProfile()
  const items = useProfileItems(profile.id)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category>()
  const [season, setSeason] = useState<Season>()
  const [color, setColor] = useState<string>()
  const [favorites, setFavorites] = useState(false)
  const [online, setOnline] = useState(false)
  const [sort, setSort] = useState<Sort>('new')
  const [panel, setPanel] = useState<Panel>()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = (items ?? []).filter(
      (i) =>
        (!category || i.category === category) &&
        (!season || i.seasons.includes(season)) &&
        (!color || i.colors.includes(color)) &&
        (!favorites || i.favorite) &&
        (!online || boughtOnline(i)) &&
        (!q || `${i.name} ${i.brand} ${i.notes} ${i.shop ?? ''}`.toLowerCase().includes(q)),
    )
    const by: Record<Sort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      new: (a, b) => b.createdAt - a.createdAt,
      worn: (a, b) => b.wornCount - a.wornCount,
      least: (a, b) => a.wornCount - b.wornCount,
    }
    return list.sort(by[sort])
  }, [items, query, category, season, color, favorites, online, sort])

  const current = panel && 'id' in panel ? items?.find((i) => i.id === panel.id) : undefined
  const hasFilters = !!(category || season || color || favorites || online || query)
  const usedCategories = categoriesFor(profile.department).filter((c) => items?.some((i) => i.category === c))

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{profile.department}</span>
          <h1>Kast van {profile.name}</h1>
        </div>
        {items && items.length > 0 && (
          <label className="field" style={{ minWidth: 170 }}>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sorteren">
              <option value="new">Nieuwste eerst</option>
              <option value="worn">Meest gedragen</option>
              <option value="least">Minst gedragen</option>
            </select>
          </label>
        )}
      </div>

      {items && items.length === 0 ? (
        <div className="empty">
          <Icon name="closet" size={40} />
          <h2>De kast is nog leeg</h2>
          <p>Voeg kleding en schoenen toe met een foto, of haal je online aankopen binnen.</p>
          <div className="form-actions" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setPanel({ kind: 'new' })}>
              <Icon name="camera" size={18} /> Kledingstuk toevoegen
            </button>
            <button className="btn" onClick={() => setPanel({ kind: 'batch' })}>
              <Icon name="image" size={18} /> Meerdere foto's
            </button>
            <a className="btn" href="#aankopen">
              <Icon name="bag" size={18} /> Online aankopen
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="search-wrap">
            <Icon name="search" size={18} />
            <input
              className="search"
              type="search"
              placeholder="Zoek op naam, merk of winkel"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="chips scroll-x">
            <Chip active={favorites} onClick={() => setFavorites(!favorites)}>
              <Icon name="heart" size={14} /> Favorieten
            </Chip>
            <Chip active={online} onClick={() => setOnline(!online)}>
              <Icon name="bag" size={14} /> Online gekocht
            </Chip>
            {usedCategories.map((c) => (
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
                <ColorDot color={c} size={12} /> {c}
              </Chip>
            ))}
          </div>
          <p className="count">
            {filtered.length} {filtered.length === 1 ? 'artikel' : 'artikelen'}
            {hasFilters && items && ` van ${items.length}`}
          </p>
          <ul className="grid">
            {filtered.map((i) => (
              <li key={i.id}>
                <ProductCard item={i} onClick={() => setPanel({ kind: 'detail', id: i.id })} />
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="fab" onClick={() => setPanel({ kind: 'new' })}>
        <Icon name="plus" size={20} /> Toevoegen
      </button>

      {panel?.kind === 'new' && (
        <Sheet title="Nieuw kledingstuk" onClose={() => setPanel(undefined)}>
          <button type="button" className="link-btn batch-link" onClick={() => setPanel({ kind: 'batch' })}>
            <Icon name="image" size={16} /> Meerdere stukken tegelijk toevoegen
          </button>
          <ItemForm onDone={(saved) => setPanel(saved ? { kind: 'detail', id: saved.id } : undefined)} />
        </Sheet>
      )}
      {panel?.kind === 'batch' && (
        <Sheet title="Foto's toevoegen" onClose={() => setPanel(undefined)}>
          <PhotoBatch onOpen={(id) => setPanel({ kind: 'detail', id })} onDone={() => setPanel(undefined)} />
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
