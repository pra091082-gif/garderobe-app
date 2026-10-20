import { useEffect, type ReactNode } from 'react'
import { COLORS, type Item } from '../db'
import { useObjectUrl } from '../media'
import { categoryIcon } from '../util'

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
            ✕
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Photo({ item, className = '' }: { item?: Item; className?: string }) {
  const url = useObjectUrl(item?.photo) ?? item?.photoUrl
  if (url) return <img className={`photo ${className}`} src={url} alt={item?.name ?? ''} loading="lazy" referrerPolicy="no-referrer" />
  return (
    <div className={`photo photo-empty ${className}`} aria-hidden>
      {item ? categoryIcon(item.category) : '👕'}
    </div>
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
