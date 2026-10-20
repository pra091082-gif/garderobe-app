import { useEffect, type ReactNode } from 'react'
import { COLORS, type Item } from '../db'
import { useObjectUrl } from '../media'
import { Icon } from './icons'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Sluiten">
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Photo({ item, className = '' }: { item?: Item; className?: string }) {
  const url = useObjectUrl(item?.photo) ?? item?.photoUrl
  if (url)
    return (
      <img className={`photo ${className}`} src={url} alt={item?.name ?? ''} loading="lazy" referrerPolicy="no-referrer" />
    )
  return (
    <div className={`photo photo-empty ${className}`} aria-hidden>
      <Icon name="closet" />
    </div>
  )
}

/** A product tile in web-shop style: photo, brand, name and a small meta line. */
export function ProductCard({
  item,
  onClick,
  selected,
  meta,
}: {
  item: Item
  onClick?: () => void
  selected?: boolean
  meta?: ReactNode
}) {
  const content = (
    <>
      <Photo item={item} />
      {item.source === 'gmail' && <span className="tag">{item.shop ?? 'Online'}</span>}
      {item.favorite && (
        <span className="card-fav on" aria-label="Favoriet">
          <Icon name="heart" size={18} />
        </span>
      )}
      <span className="card-brand">{item.brand || item.category}</span>
      <span className="card-name">{item.name}</span>
      <span className="card-sub">
        {meta ??
          item.colors.map((c) => (
            <ColorDot key={c} color={c} size={10} />
          ))}
      </span>
    </>
  )
  if (!onClick) return <div className="card card-static">{content}</div>
  return (
    <button
      type="button"
      className={`card ${selected ? 'card-selected' : ''}`}
      aria-pressed={selected}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

export function ColorDot({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <span
      className="color-dot"
      title={color}
      aria-hidden
      style={{ width: size, height: size, background: COLORS[color] ?? color }}
    />
  )
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className={`chip ${active ? 'chip-active' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  )
}

export function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" />
      {children}
    </div>
  )
}
