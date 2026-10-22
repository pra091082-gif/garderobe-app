import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, deleteItem, markWorn, type Item } from '../db'
import { formatPrice } from '../util'
import { Icon } from './icons'
import { Inspiration } from './Inspiration'
import { ShopPhoto } from './ShopPhoto'
import { ColorDot, Photo } from './ui'

export function ItemDetail({ item, onEdit, onClose }: { item: Item; onEdit: () => void; onClose: () => void }) {
  const outfits = useLiveQuery(() => db.outfits.where('itemIds').equals(item.id).toArray(), [item.id]) ?? []
  const [worn, setWorn] = useState(false)

  async function onDelete() {
    if (!confirm(`"${item.name}" verwijderen?`)) return
    await deleteItem(item.id)
    onClose()
  }

  return (
    <div className="detail">
      <Photo item={item} className="detail-photo" />
      <div className="detail-head">
        <div>
          <span className="card-brand">{item.brand || item.category}</span>
          <h3>{item.name}</h3>
        </div>
        <button
          className="icon-btn"
          aria-label={item.favorite ? 'Niet meer favoriet' : 'Favoriet maken'}
          aria-pressed={item.favorite}
          onClick={() => db.items.update(item.id, { favorite: !item.favorite })}
        >
          <Icon name="heart" style={item.favorite ? { fill: 'currentColor' } : undefined} />
        </button>
      </div>

      <div className="form-actions start">
        <button
          className="btn btn-primary"
          disabled={worn}
          onClick={async () => {
            await markWorn([item.id])
            setWorn(true)
          }}
        >
          <Icon name="check" size={18} /> {worn ? 'Genoteerd' : 'Vandaag gedragen'}
        </button>
        <button className="btn" onClick={onEdit}>
          Bewerken
        </button>
      </div>

      <ShopPhoto item={item} />

      <dl className="facts">
        <dt>Categorie</dt>
        <dd>{item.category}</dd>
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
        {item.size && (
          <>
            <dt>Maat</dt>
            <dd>
              {item.size}
              {item.fit && <span className="muted"> · {item.fit.toLowerCase()}</span>}
            </dd>
          </>
        )}
        {item.seasons.length > 0 && (
          <>
            <dt>Seizoen</dt>
            <dd>{item.seasons.join(', ')}</dd>
          </>
        )}
        {item.shop && (
          <>
            <dt>Gekocht</dt>
            <dd>
              {[
                item.shop,
                item.purchasedAt && new Date(item.purchasedAt).toLocaleDateString('nl-NL'),
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

      <button className="link-btn" onClick={onDelete}>
        Dit stuk verwijderen
      </button>
    </div>
  )
}
