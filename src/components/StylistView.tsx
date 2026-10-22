import { useState } from 'react'
import type { StylistResult } from '../ai'
import { SEASONS, addFeedback, boughtOnline, addOutfit, occasionsFor, type Occasion, type Season } from '../db'
import { newSignals } from '../learn'
import { useFeedback, useProfile, useProfileItems } from '../profile'
import { useSettings } from '../settings'
import { defaultOccasion } from '../today'
import { currentSeason } from '../util'
import { describeWeather, useWeather } from '../weather'
import { Icon } from './icons'
import { Chip, Loading, ProductCard } from './ui'

type Vote = 'like' | 'dislike'

export function StylistView() {
  const { anthropicKey } = useSettings()
  const profile = useProfile()
  const items = useProfileItems(profile.id) ?? []
  const feedback = useFeedback(profile.id)
  const byId = new Map(items.map((i) => [i.id, i]))
  const occasions = occasionsFor(profile)
  const [season, setSeason] = useState<Season>(currentSeason())
  const { weather } = useWeather()
  const [useToday, setUseToday] = useState(true)
  const [occasion, setOccasion] = useState<Occasion>(() => {
    const o = defaultOccasion(profile)
    return occasions.includes(o) ? o : 'Vrije tijd'
  })
  const [wish, setWish] = useState('')
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [result, setResult] = useState<StylistResult>()
  const [saved, setSaved] = useState<number[]>([])
  const [votes, setVotes] = useState<Record<number, Vote>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const onlineCount = items.filter((i) => boughtOnline(i)).length
  const learned = feedback.filter((f) => f.kind !== 'quiz').length
  const hasShoes = items.some((i) => i.category === 'Schoenen')

  async function ask() {
    setBusy(true)
    setError(undefined)
    setResult(undefined)
    setSaved([])
    setVotes({})
    try {
      // "Mostly online purchases" still lets the stylist add shoes/accessories from the rest of the closet.
      const pool = onlyOnline
        ? items.filter((i) => boughtOnline(i) || i.category === 'Schoenen' || i.category === 'Accessoires')
        : items
      const { styleOutfits } = await import('../ai')
      setResult(
        await styleOutfits(profile, pool, feedback, {
          season,
          occasion,
          wish: wish.trim(),
          weather: useToday && weather ? describeWeather(weather) : undefined,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function describe(i: number): string {
    const o = result!.outfits[i]
    return `"${o.name}": ${o.itemIds
      .map((id) => byId.get(id)?.name)
      .filter(Boolean)
      .join(' + ')}`
  }

  async function vote(i: number, v: Vote) {
    if (votes[i]) return
    setVotes((all) => ({ ...all, [i]: v }))
    await addFeedback({
      profileId: profile.id,
      kind: v,
      text: describe(i),
      itemIds: result!.outfits[i].itemIds,
      occasion,
    })
  }

  async function save(i: number) {
    const o = result!.outfits[i]
    await addOutfit(profile.id, o.name, o.itemIds, o.why, occasion)
    await addFeedback({ profileId: profile.id, kind: 'saved', text: describe(i), itemIds: o.itemIds, occasion })
    setSaved((s) => [...s, i])
  }

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Persoonlijke stylist</span>
          <h1>Wat trekt {profile.name} aan?</h1>
          <p>
            {profile.style ? profile.style.summary : 'Doe eerst de stijltest onder Profiel voor betere adviezen.'}
            {learned > 0 && ` De stylist leerde al van ${learned} keuzes.`}
          </p>
        </div>
      </div>

      {!anthropicKey ? (
        <p className="message">
          Vul eerst je Claude API-sleutel in onder <a href="#profiel">Profiel → Koppelingen</a>.
        </p>
      ) : (
        <div className="panel">
          <button className="btn btn-primary btn-block btn-large" disabled={busy} onClick={ask}>
            <Icon name="sparkle" size={20} /> Stel mijn look samen
          </button>
          <p className="small muted">
            Een complete look uit de kast van {profile.name}, met schoenen: {occasion.toLowerCase()},{' '}
            {season.toLowerCase()}
            {useToday && weather ? `, ${weather.feelsLike}° vandaag` : ''}.
          </p>
          {!hasShoes && (
            <p className="message">
              Er staan nog geen schoenen in de kast. <a href="#kast">Voeg ze toe</a> voor complete looks.
            </p>
          )}
          <details className="more">
            <summary>Zelf kiezen: gelegenheid, seizoen, wens</summary>
            <div>
              <span className="eyebrow">Gelegenheid</span>
              <div className="chips" style={{ marginTop: 8 }}>
                {occasions.map((o) => (
                  <Chip key={o} active={occasion === o} onClick={() => setOccasion(o)}>
                    {o === 'Werk' && <Icon name="briefcase" size={14} />} {o}
                  </Chip>
                ))}
              </div>
              {occasion === 'Werk' && profile.job && (
                <p className="small muted" style={{ marginTop: 8 }}>
                  {profile.job.title}
                  {profile.job.company && ` bij ${profile.job.company}`} · dresscode {profile.job.dresscode}
                </p>
              )}
            </div>
            <div>
              <span className="eyebrow">Seizoen</span>
              <div className="chips" style={{ marginTop: 8 }}>
                {SEASONS.map((s) => (
                  <Chip key={s} active={season === s} onClick={() => setSeason(s)}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Wens (optioneel)</span>
              <input
                value={wish}
                onChange={(e) => setWish(e.target.value)}
                placeholder="Bijv. presentatie voor een klant, iets met mijn nieuwe sneakers"
              />
            </label>
            {weather && (
              <label className="check">
                <input type="checkbox" checked={useToday} onChange={(e) => setUseToday(e.target.checked)} />
                Rekening houden met het weer van vandaag ({weather.feelsLike}°, {weather.rainChance}% kans op regen)
              </label>
            )}
            {onlineCount > 0 && (
              <label className="check">
                <input type="checkbox" checked={onlyOnline} onChange={(e) => setOnlyOnline(e.target.checked)} />
                Vooral mijn online aankopen gebruiken ({onlineCount})
              </label>
            )}
            <button className="btn" disabled={busy} onClick={ask}>
              <Icon name="sparkle" size={18} /> Stel looks voor
            </button>
          </details>
          {profile.style && newSignals(profile, feedback) >= 10 && (
            <p className="small muted">
              Er zijn veel nieuwe keuzes bijgekomen. Werk je stijlprofiel bij onder <a href="#profiel">Profiel</a>.
            </p>
          )}
        </div>
      )}

      {busy && <Loading>De stylist stelt je look samen…</Loading>}
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="results">
          {result.outfits.map((o, i) => (
            <div key={i} className="result">
              <header>
                <h3>{o.name}</h3>
                <span className="badge">{occasion}</span>
              </header>
              <ul className="grid grid-small look">
                {o.pieces.map(({ id, role }) => {
                  const item = byId.get(id)
                  return item ? (
                    <li key={id}>
                      <ProductCard item={item} meta={role} />
                    </li>
                  ) : null
                })}
              </ul>
              <p className="muted">{o.why}</p>
              <div className="feedback-row">
                <button
                  className={`vote ${votes[i] === 'like' ? 'on' : ''}`}
                  aria-label="Goed advies"
                  aria-pressed={votes[i] === 'like'}
                  disabled={!!votes[i]}
                  onClick={() => vote(i, 'like')}
                >
                  <Icon name="thumbUp" size={20} />
                </button>
                <button
                  className={`vote ${votes[i] === 'dislike' ? 'on' : ''}`}
                  aria-label="Niet mijn stijl"
                  aria-pressed={votes[i] === 'dislike'}
                  disabled={!!votes[i]}
                  onClick={() => vote(i, 'dislike')}
                >
                  <Icon name="thumbDown" size={20} />
                </button>
                <span className="spacer" />
                <button className="btn btn-primary btn-small" disabled={saved.includes(i)} onClick={() => save(i)}>
                  {saved.includes(i) ? 'Opgeslagen' : 'Opslaan'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {result?.missing && (
        <p className="message">
          <strong>Tip van de stylist:</strong> {result.missing}
        </p>
      )}
    </section>
  )
}
