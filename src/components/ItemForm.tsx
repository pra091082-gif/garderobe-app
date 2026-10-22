import { useRef, useState, type FormEvent } from 'react'
import type { ItemGuess } from '../ai'
import { COLORS, FITS, SEASONS, categoriesFor, db, newId, type Category, type Fit, type Item, type Season } from '../db'
import { resizeImage, useObjectUrl } from '../media'
import { useProfile } from '../profile'
import { useSettings } from '../settings'
import { toggle } from '../util'
import { Icon } from './icons'
import { Chip, ColorDot, PhotoButtons } from './ui'

export function ItemForm({ item, onDone }: { item?: Item; onDone: (saved?: Item) => void }) {
  const profile = useProfile()
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState<Category>(item?.category ?? 'Tops')
  const [colors, setColors] = useState<string[]>(item?.colors ?? [])
  const [seasons, setSeasons] = useState<Season[]>(item?.seasons ?? [])
  const [brand, setBrand] = useState(item?.brand ?? '')
  const [size, setSize] = useState(item?.size ?? '')
  const [fit, setFit] = useState<Fit | undefined>(item?.fit)
  const [notes, setNotes] = useState(item?.notes ?? '')
  const [photo, setPhoto] = useState<Blob | undefined>(item?.photo)
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const photoUrl = useObjectUrl(photo)
  const { anthropicKey } = useSettings()
  // Fields the person filled in themselves are never overwritten by the AI.
  const touched = useRef(new Set<string>())
  const touch = (field: string) => touched.current.add(field)

  function apply(guess: ItemGuess, all: boolean) {
    const free = (field: string, empty: boolean) => all || (!touched.current.has(field) && empty)
    if (free('name', !name.trim())) setName(guess.name)
    if (free('category', true)) setCategory(guess.category)
    if (free('colors', colors.length === 0)) setColors(guess.colors)
    if (free('seasons', seasons.length === 0)) setSeasons(guess.seasons)
    if (guess.brand && free('brand', !brand.trim())) setBrand(guess.brand)
  }

  async function recognize(blob: Blob, all: boolean) {
    setBusy('De AI bekijkt de foto…')
    try {
      const { recognizeItem } = await import('../ai')
      apply(await recognizeItem(blob, profile.department), all)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(undefined)
    }
  }

  async function onPhoto(file?: File) {
    if (!file) return
    setBusy('Foto laden…')
    setError(undefined)
    let blob: Blob
    try {
      blob = await resizeImage(file)
    } catch {
      setBusy(undefined)
      setError('Deze foto kon niet worden geladen. Probeer een andere foto of maak een screenshot ervan.')
      return
    }
    setPhoto(blob)
    setBusy(undefined)
    // New pieces get filled in from the photo straight away.
    if (anthropicKey && !item) await recognize(blob, false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const saved: Item = {
      id: item?.id ?? newId(),
      profileId: item?.profileId ?? profile.id,
      name: name.trim() || category,
      category,
      colors,
      seasons,
      brand: brand.trim(),
      notes: notes.trim(),
      favorite: item?.favorite ?? false,
      photo,
      photoUrl: photo ? undefined : item?.photoUrl,
      source: item?.source ?? 'manual',
      shop: item?.shop,
      size: size.trim() || undefined,
      fit,
      price: item?.price,
      purchasedAt: item?.purchasedAt,
      wornCount: item?.wornCount ?? 0,
      lastWorn: item?.lastWorn,
      createdAt: item?.createdAt ?? Date.now(),
    }
    await db.items.put(saved)
    onDone(saved)
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <div className="photo-picker">
        {photoUrl ? (
          <img src={photoUrl} alt="" />
        ) : (
          <>
            <Icon name="camera" size={32} />
            <span>{busy ?? 'Maak een foto of kies er een'}</span>
          </>
        )}
      </div>
      <PhotoButtons onFiles={(files) => onPhoto(files[0])} disabled={!!busy} replace={!!photo} />
      {photo && (
        <div className="form-actions start">
          {anthropicKey && (
            <button type="button" className="btn btn-small" disabled={!!busy} onClick={() => recognize(photo, true)}>
              <Icon name="sparkle" size={16} /> Invullen met AI
            </button>
          )}
          <button type="button" className="link-btn" onClick={() => setPhoto(undefined)}>
            Foto verwijderen
          </button>
        </div>
      )}
      {busy && photo && <p className="muted small">{busy}</p>}
      {!anthropicKey && !item && (
        <small className="muted">
          Tip: met een Claude API-sleutel (onder <a href="#profiel">Profiel</a>) vult de app naam, soort en kleur zelf
          in vanaf de foto.
        </small>
      )}
      {error && <p className="error">{error}</p>}

      <label className="field">
        <span>Naam</span>
        <input
          value={name}
          onChange={(e) => {
            touch('name')
            setName(e.target.value)
          }}
          placeholder="Bijv. witte linnen blouse"
        />
      </label>

      <fieldset className="field">
        <legend>Categorie</legend>
        <div className="chips">
          {categoriesFor(profile.department).map((c) => (
            <Chip
              key={c}
              active={category === c}
              onClick={() => {
                touch('category')
                setCategory(c)
              }}
            >
              {c}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Kleur(en)</legend>
        <div className="chips">
          {Object.keys(COLORS).map((c) => (
            <Chip
              key={c}
              active={colors.includes(c)}
              onClick={() => {
                touch('colors')
                setColors(toggle(colors, c))
              }}
            >
              <ColorDot color={c} /> {c}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Seizoen</legend>
        <div className="chips">
          {SEASONS.map((s) => (
            <Chip
              key={s}
              active={seasons.includes(s)}
              onClick={() => {
                touch('seasons')
                setSeasons(toggle(seasons, s))
              }}
            >
              {s}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="row-2">
        <label className="field">
          <span>Merk</span>
          <input
            value={brand}
            onChange={(e) => {
              touch('brand')
              setBrand(e.target.value)
            }}
          />
        </label>
        <label className="field">
          <span>Maat</span>
          <input value={size} onChange={(e) => setSize(e.target.value)} />
        </label>
      </div>

      <fieldset className="field">
        <legend>Hoe valt de maat?</legend>
        <div className="chips">
          {FITS.map((f) => (
            <Chip key={f} active={fit === f} onClick={() => setFit(fit === f ? undefined : f)}>
              {f}
            </Chip>
          ))}
        </div>
        <small className="muted">Zo leert de app hoe elk merk valt, voor beter maatadvies.</small>
      </fieldset>

      <label className="field">
        <span>Notities</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Materiaal, pasvorm, waswijze…"
        />
      </label>

      <div className="form-actions">
        <button type="button" className="btn" onClick={() => onDone()}>
          Annuleren
        </button>
        <button type="submit" className="btn btn-primary" disabled={!!busy}>
          Opslaan
        </button>
      </div>
    </form>
  )
}
