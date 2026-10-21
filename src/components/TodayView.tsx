import { useState, type FormEvent } from 'react'
import { addFeedback, addOutfit, markWorn, occasionsFor, type Occasion } from '../db'
import { useProfile, useProfileItems } from '../profile'
import { useSettings } from '../settings'
import { SHOPS, defaultOccasion, findMissing, needsFor, suggestToday } from '../today'
import { findPlace, useWeather, weatherLabel } from '../weather'
import { Icon } from './icons'
import { useRealProducts } from '../products'
import { ProductTile } from './RealProducts'
import { Chip, Loading, ProductCard } from './ui'

export function TodayView() {
  const profile = useProfile()
  const items = useProfileItems(profile.id)
  const { weather, error, needsPlace, setPlace } = useWeather()
  const [occasion, setOccasion] = useState<Occasion>(() => defaultOccasion(profile))
  const [worn, setWorn] = useState<number>()
  const [saved, setSaved] = useState<number[]>([])
  const [changingPlace, setChangingPlace] = useState(false)
  const { anthropicKey } = useSettings()
  const [showReal, setShowReal] = useState(false)

  const [date] = useState(() => new Date().toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }))
  const needs = weather && needsFor(weather, occasion)
  const suggestions = needs && items ? suggestToday(items, needs) : []
  const missing = needs && items ? findMissing(items, needs, profile.department) : []
  const real = useRealProducts(profile, missing.map((m) => m.query), showReal)

  function pickOccasion(o: Occasion) {
    setOccasion(o)
    setWorn(undefined)
    setSaved([])
  }

  async function wear(i: number) {
    const ids = suggestions[i].items.map((it) => it.id)
    await markWorn(ids, `Vandaag (${occasion}, ${weather!.feelsLike}°)`)
    setWorn(i)
  }

  async function save(i: number) {
    const s = suggestions[i]
    const name = `${occasion} bij ${weather!.feelsLike}°`
    await addOutfit(profile.id, name, s.items.map((it) => it.id), `Voorstel voor ${weatherLabel(weather!.code).toLowerCase()} weer.`, occasion)
    await addFeedback({
      profileId: profile.id,
      kind: 'saved',
      text: `Weervoorstel "${name}": ${s.items.map((it) => it.name).join(' + ')}`,
      itemIds: s.items.map((it) => it.id),
      occasion,
    })
    setSaved((all) => [...all, i])
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{date}</span>
          <h1>Wat trekt {profile.name} vandaag aan?</h1>
        </div>
      </div>

      <div className="panel weather">
        {weather && !changingPlace ? (
          <>
            <div className="weather-now">
              <span className="weather-temp">{weather.feelsLike}°</span>
              <div>
                <strong>{weatherLabel(weather.code)}</strong>
                <p className="small muted">
                  {weather.tempMin}° tot {weather.tempMax}° · {weather.rainChance}% kans op regen · wind {weather.windMax} km/u
                </p>
                <button className="link-btn" onClick={() => setChangingPlace(true)}>
                  {weather.place} · andere plaats
                </button>
              </div>
            </div>
            {needs!.tips.length > 0 && (
              <ul className="weather-tips">
                {needs!.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </>
        ) : needsPlace || changingPlace ? (
          <PlaceForm
            onPlace={async (name) => {
              const place = await findPlace(name)
              if (!place) return `"${name}" niet gevonden. Probeer een grotere plaats in de buurt.`
              await setPlace(place)
              setChangingPlace(false)
            }}
            onCancel={weather ? () => setChangingPlace(false) : undefined}
          />
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <Loading>Weer ophalen…</Loading>
        )}
      </div>

      <div className="chips scroll-x">
        {occasionsFor(profile).map((o) => (
          <Chip key={o} active={occasion === o} onClick={() => pickOccasion(o)}>
            {o === 'Werk' && <Icon name="briefcase" size={14} />} {o}
          </Chip>
        ))}
      </div>

      {items && items.length === 0 && (
        <div className="empty">
          <Icon name="closet" size={40} />
          <h2>De kast is nog leeg</h2>
          <p>
            Voeg eerst kleding toe onder <a href="#kast">Kast</a>, dan krijg je hier elke dag voorstellen.
          </p>
        </div>
      )}

      {needs && items && items.length > 0 && suggestions.length === 0 && (
        <p className="message">Nog geen complete outfit mogelijk. Voeg minstens een bovenstuk en een broek of rok toe.</p>
      )}

      {suggestions.length > 0 && (
        <div className="results">
          {suggestions.map((s, i) => (
            <div key={s.items.map((it) => it.id).join()} className="result">
              <header>
                <h3>Voorstel {i + 1}</h3>
                <span className="badge">{occasion}</span>
              </header>
              <ul className="grid grid-small grid-today">
                {s.items.map((it) => (
                  <li key={it.id}>
                    <ProductCard item={it} />
                  </li>
                ))}
              </ul>
              <div className="feedback-row">
                <button className="btn btn-small" disabled={saved.includes(i)} onClick={() => save(i)}>
                  {saved.includes(i) ? 'Opgeslagen' : 'Bewaren'}
                </button>
                <span className="spacer" />
                <button className="btn btn-primary btn-small" disabled={worn !== undefined} onClick={() => wear(i)}>
                  <Icon name="check" size={16} /> {worn === i ? 'Genoteerd' : 'Dit trek ik aan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <div className="panel">
          <h2 className="section-title" style={{ marginTop: 0 }}>
            Wat er nog ontbreekt
          </h2>
          {missing.map((m, i) => (
            <div key={m.query} className="missing">
              <p>{m.reason}</p>
              {real.products && real.products[i].length > 0 && (
                <ul className="grid grid-small grid-today">
                  {real.products[i].map((p) => (
                    <li key={p.url}>
                      <ProductTile product={p} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="chips">
                {SHOPS.map((shop) => (
                  <a key={shop.name} className="chip" href={shop.url(m.query)} target="_blank" rel="noopener noreferrer">
                    {shop.name} <Icon name="arrowRight" size={14} />
                  </a>
                ))}
              </div>
            </div>
          ))}
          {anthropicKey && !showReal && (
            <button className="btn" onClick={() => setShowReal(true)}>
              <Icon name="search" size={18} /> Echte stukken uit webwinkels tonen
            </button>
          )}
          {showReal && !real.products && !real.error && <Loading>Echte stukken zoeken in webwinkels…</Loading>}
          {real.error && <p className="error">{real.error}</p>}
        </div>
      )}

      {suggestions.length > 0 && (
        <p className="small muted">
          Liever persoonlijk advies? De <a href="#stylist">Stylist</a> houdt ook rekening met het weer van vandaag.
        </p>
      )}
    </section>
  )
}

function PlaceForm({
  onPlace,
  onCancel,
}: {
  onPlace: (name: string) => Promise<string | void>
  onCancel?: () => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError(undefined)
    try {
      const problem = await onPlace(name.trim())
      if (problem) setError(problem)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label className="field">
        <span>Voor welke plaats wil je het weer?</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Utrecht" autoFocus />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="form-actions start">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          Weer ophalen
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Annuleren
          </button>
        )}
      </div>
    </form>
  )
}
