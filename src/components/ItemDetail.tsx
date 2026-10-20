import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteItem, markWorn, type Item } from '../db'
import { formatPrice } from '../util'
import { Inspiration } from './Inspiration'
import { ColorDot, Photo } from './ui'

export function ItemDetail({ item, onEdit, onClose }: { item: Item; onEdit: () => void; onClose: () => void }) {
  const outfits = useLiveQuery(() => db.outfits.where('itemIds').equals(item.id).toArray(), [item.id]) ?? []

  async function onDelete() {
    if (!confirm(`"${item.name}" verwijderen?`)) return
    await deleteItem(item.id)
    onClose()
  }

  return (
    <div className="detail">
      <Photo item={item} className="detail-photo" />
      <div className="detail-row">
        <span className="badge">{item.category}</span>
        <button
          className="icon-btn"
          aria-label={item.favorite ? 'Niet meer favoriet' : 'Favoriet maken'}
          onClick={() => db.items.update(item.id, { favorite: !item.favorite })}
        >
          {item.favorite ? '★' : '☆'}
        </button>
      </div>

      <dl className="facts">
        {item.colors.length > 0 && (
          <>
            <dt>Kleur</dt>
            <dd>
              {item.colors.map((c) => (
                <span key={c} className="inline-color">
                  <ColorDot color={c} /> {c}
                </span>
              ))}
            </dd>
          </>
        )}
        {item.seasons.length > 0 && (
          <>
            <dt>Seizoen</dt>
            <dd>{item.seasons.join(', ')}</dd>
          </>
        )}
        {item.brand && (
          <>
            <dt>Merk</dt>
            <dd>{item.brand}</dd>
          </>
        )}
        {item.shop && (
          <>
            <dt>Gekocht</dt>
            <dd>
              {[
                item.shop,
                item.purchasedAt && new Date(item.purchasedAt).toLocaleDateString('nl-NL'),
                item.size && `maat ${item.size}`,
                item.price != null && formatPrice(item.price),
              ]
                .filter(Boolean)
                .join(' · ')}
            </dd>
          </>
        )}
        <dt>Gedragen</dt>
        <dd>
          {item.wornCount}×
          {item.lastWorn && ` · laatst ${new Date(item.lastWorn).toLocaleDateString('nl-NL')}`}
        </dd>
        {outfits.length > 0 && (
          <>
            <dt>In outfits</dt>
            <dd>{outfits.map((o) => o.name).join(', ')}</dd>
          </>
        )}
      </dl>
      {item.notes && <p className="notes">{item.notes}</p>}

      <Inspiration key={item.id} item={item} />

      <div className="form-actions">
        <button className="btn btn-danger" onClick={onDelete}>
          Verwijderen
        </button>
        <button className="btn" onClick={onEdit}>
          Bewerken
        </button>
        <button className="btn btn-primary" onClick={() => markWorn([item.id])}>
          Vandaag gedragen
        </button>
      </div>
    </div>
  )
}
