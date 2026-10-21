import { useState } from 'react'
import type { Product } from '../ai'
import { formatPrice } from '../util'
import { Icon } from './icons'

/** A real product from a web shop: photo, brand, name, price, and a link to the shop. */
export function ProductTile({ product }: { product: Product }) {
  const [broken, setBroken] = useState(false)
  return (
    <a className="card product-tile" href={product.url} target="_blank" rel="noopener noreferrer">
      {product.imageUrl && !broken ? (
        <img
          className="photo"
          src={product.imageUrl}
          alt={product.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="photo photo-empty" aria-hidden>
          <Icon name="bag" />
        </div>
      )}
      <span className="card-brand">{product.brand}</span>
      <span className="card-name">{product.name}</span>
      <span className="card-sub">
        {product.price != null && <strong>{formatPrice(product.price)}</strong>} {product.shop}
        <Icon name="arrowRight" size={12} />
      </span>
    </a>
  )
}
