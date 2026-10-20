import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { exportBackup, importBackup } from '../backup'
import { CATEGORIES, db } from '../db'
import { Photo } from './ui'

export function SettingsView() {
  const items = useLiveQuery(() => db.items.toArray()) ?? []
  const outfitCount = useLiveQuery(() => db.outfits.count()) ?? 0
  const [message, setMessage] = useState<string>()

  const neverWorn = items.filter((i) => i.wornCount === 0)
  const mostWorn = [...items].sort((a, b) => b.wornCount - a.wornCount).filter((i) => i.wornCount > 0).slice(0, 5)

  async function onExport() {
    const blob = await exportBackup()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `garderobe-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function onImport(file?: File) {
    if (!file) return
    try {
      const r = await importBackup(file)
      setMessage(`Geïmporteerd: ${r.items} kledingstukken en ${r.outfits} outfits.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Importeren mislukt.')
    }
  }

  async function onClear() {
    if (!confirm('Weet je zeker dat je ALLE kleding en outfits wilt wissen? Dit kan niet ongedaan worden.')) return
    await db.transaction('rw', db.items, db.outfits, async () => {
      await db.items.clear()
      await db.outfits.clear()
    })
    setMessage('Alles is gewist.')
  }

  return (
    <section className="settings">
      <h2>Overzicht</h2>
      <div className="stats">
        <div>
          <strong>{items.length}</strong>
          <span>kledingstukken</span>
        </div>
        <div>
          <strong>{outfitCount}</strong>
          <span>outfits</span>
        </div>
        <div>
          <strong>{neverWorn.length}</strong>
          <span>nooit gedragen</span>
        </div>
      </div>

      <ul className="bars">
        {CATEGORIES.map((c) => {
          const n = items.filter((i) => i.category === c).length
          if (n === 0) return null
          return (
            <li key={c}>
              <span>{c}</span>
              <span className="bar" style={{ width: `${(n / items.length) * 100}%` }} />
              <span>{n}</span>
            </li>
          )
        })}
      </ul>

      {mostWorn.length > 0 && (
        <>
          <h3>Meest gedragen</h3>
          <ul className="list">
            {mostWorn.map((i) => (
              <li key={i.id}>
                <Photo item={i} className="thumb" />
                <span>{i.name}</span>
                <span className="muted">{i.wornCount}×</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Backup</h2>
      <p className="muted">
        Je gegevens staan alleen op dit apparaat. Maak af en toe een backup, zodat je niets kwijtraakt als je de
        browsergegevens wist.
      </p>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={onExport}>
          Backup downloaden
        </button>
        <label className="btn">
          Backup terugzetten
          <input type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </label>
      </div>
      {message && <p className="message">{message}</p>}

      <h2>Gevarenzone</h2>
      <button className="btn btn-danger" onClick={onClear}>
        Alles wissen
      </button>
    </section>
  )
}
