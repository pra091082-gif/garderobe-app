import { useState, type FormEvent } from 'react'
import { CATEGORIES, COLORS, SEASONS, db, newId, type Category, type Item, type Season } from '../db'
import { resizeImage, useObjectUrl } from '../media'
import { toggle } from '../util'
import { Chip, ColorDot } from './ui'

export function ItemForm({ item, onDone }: { item?: Item; onDone: (saved?: Item) => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<Category>(item?.category ?? 'Tops')
  const [colors, setColors] = useState<string[]>(item?.colors ?? [])
  const [seasons, setSeasons] = useState<Season[]>(item?.seasons ?? [])
  const [brand, setBrand] = useState(item?.brand ?? '')
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [photo, setPhoto] = useState<Blob | undefined>(item?.photo)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const photoUrl = useObjectUrl(photo)

  async function onPhoto(file?: File) {
    if (!file) return
    setBusy(true)
    setError(undefined)
    try {
      setPhoto(await resizeImage(file))
    } catch {
      setError('Deze foto kon niet worden geladen.')
    } finally {
      setBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const saved: Item = {
      id: item?.id ?? newId(),
      name: name.trim() || category,
      category,
      colors,
      seasons,
      brand: brand.trim(),
      notes: notes.trim(),
      favorite: item?.favorite ?? false,
      photo,
      wornCount: item?.wornCount ?? 0,
      lastWorn: item?.lastWorn,
      createdAt: item?.createdAt ?? Date.now(),
    }
    await db.items.put(saved)
    onDone(saved)
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label className="photo-picker">
        {photoUrl ? <img src={photoUrl} alt="" /> : <span>{busy ? 'Bezig…' : '📷 Foto maken of kiezen'}</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      </label>
      {photo && (
        <button type="button" className="link-btn" onClick={() => setPhoto(undefined)}>
          Foto verwijderen
        </button>
      )}
      {error && <p className="error">{error}</p>}

      <label className="field">
        <span>Naam</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. witte linnen blouse" />
      </label>

      <fieldset className="field">
        <legend>Categorie</legend>
        <div className="chips">
          {CATEGORIES.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Kleur(en)</legend>
        <div className="chips">
          {Object.keys(COLORS).map((c) => (
            <Chip key={c} active={colors.includes(c)} onClick={() => setColors(toggle(colors, c))}>
              <ColorDot color={c} /> {c}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Seizoen</legend>
        <div className="chips">
          {SEASONS.map((s) => (
            <Chip key={s} active={seasons.includes(s)} onClick={() => setSeasons(toggle(seasons, s))}>
              {s}
            </Chip>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>Merk</span>
        <input value={brand} onChange={(e) => setBrand(e.target.value)} />
      </label>

      <label className="field">
        <span>Notities</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Maat, materiaal, waswijze…" />
      </label>

      <div className="form-actions">
        <button type="button" className="btn" onClick={() => onDone()}>
          Annuleren
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Opslaan
        </button>
      </div>
    </form>
  )
}
