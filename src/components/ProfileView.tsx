import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { exportBackup, importBackup } from '../backup'
import { categoriesFor, db, deleteProfile, saveMeasurements } from '../db'
import { disconnect } from '../gmail'
import { newSignals, quizDue } from '../learn'
import { useFeedback, useProfile, useProfileItems } from '../profile'
import { saveSettings, useSettings } from '../settings'
import { hasMeasurements, remeasureDue } from '../sizes'
import { currentSeason, nextSeasonStart } from '../util'
import { Icon } from './icons'
import { MeasurementsForm } from './MeasurementsForm'
import { ProfileForm } from './ProfileForm'
import { MeasurementsSummary } from './SizeAdvisor'
import { StyleCard, StyleQuiz } from './StyleQuiz'
import { Loading, Photo, Sheet } from './ui'

export function ProfileView() {
  const profile = useProfile()
  const items = useProfileItems(profile.id) ?? []
  const feedback = useFeedback(profile.id)
  const outfitCount = useLiveQuery(() => db.outfits.where('profileId').equals(profile.id).count(), [profile.id]) ?? 0
  const settings = useSettings()
  const [editing, setEditing] = useState(false)
  const [measuring, setMeasuring] = useState(false)
  const [quiz, setQuiz] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<string>()

  const neverWorn = items.filter((i) => i.wornCount === 0)
  const mostWorn = [...items].sort((a, b) => b.wornCount - a.wornCount).filter((i) => i.wornCount > 0).slice(0, 5)
  const count = (k: string) => feedback.filter((f) => f.kind === k).length
  const fresh = newSignals(profile, feedback)
  const due = quizDue(profile)
  const done = profile.quizzes ?? []

  async function updateStyle() {
    setUpdating(true)
    setMessage(undefined)
    try {
      const { analyzeStyle } = await import('../ai')
      const style = await analyzeStyle(profile, feedback, items)
      await db.profiles.update(profile.id, { style })
      setMessage('Je stijlprofiel is bijgewerkt met wat de stylist heeft geleerd.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setUpdating(false)
    }
  }

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
      setMessage(`Teruggezet: ${r.profiles} profielen, ${r.items} kledingstukken en ${r.outfits} outfits.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Terugzetten mislukt.')
    }
  }

  async function onDeleteProfile() {
    if (!confirm(`Profiel van ${profile.name} verwijderen, met de hele kast en alle outfits? Dit kan niet ongedaan worden.`))
      return
    await deleteProfile(profile.id)
    location.hash = 'kast'
  }

  if (quiz)
    return (
      <StyleQuiz
        profile={profile}
        onDone={() => {
          setQuiz(false)
          setMessage('Je nieuwe stijlprofiel staat klaar.')
        }}
      />
    )

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{profile.department}</span>
          <h1>{profile.name}</h1>
          <p>
            {profile.department === 'Kinderen' && profile.age ? `${profile.age} jaar` : ''}
            {profile.job
              ? `${profile.job.title}${profile.job.company ? ` bij ${profile.job.company}` : ''} · ${profile.job.dresscode}`
              : ''}
          </p>
        </div>
        <button className="btn btn-small" onClick={() => setEditing(true)}>
          Gegevens wijzigen
        </button>
      </div>

      {message && <p className="message">{message}</p>}

      {profile.style ? (
        <StyleCard profile={profile} />
      ) : (
        <div className="panel">
          <p>
            <strong>Nog geen stijlprofiel.</strong> Doe de stijltest, dan weet de stylist wat bij {profile.name} past.
          </p>
        </div>
      )}
      <div className="form-actions start">
        <button className="btn" disabled={!due} onClick={() => setQuiz(true)}>
          {due ? `Stijltest ${currentSeason().toLowerCase()} doen` : `Stijltest ${currentSeason().toLowerCase()} gedaan`}
        </button>
        {settings.anthropicKey && profile.style && (
          <button className="btn btn-primary" disabled={updating || fresh === 0} onClick={updateStyle}>
            <Icon name="sparkle" size={18} /> Bijwerken met {fresh} nieuwe {fresh === 1 ? 'keuze' : 'keuzes'}
          </button>
        )}
      </div>
      <p className="small muted">
        De stijltest doe je één keer per seizoen, dus maximaal vier keer per jaar.{' '}
        {due
          ? 'Die van dit seizoen staat nog open.'
          : `De volgende kan vanaf ${nextSeasonStart().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.`}
        {done.length > 0 && ` Gedaan: ${done.map((q) => q.period).join(', ')}.`}
      </p>
      {updating && <Loading>Stijlprofiel bijwerken…</Loading>}

      <h2 className="section-title" id="maten">
        Maten en afmetingen
      </h2>
      {remeasureDue(profile) && (
        <p className="message">Deze afmetingen zijn ouder dan een half jaar. Kinderen groeien snel: meet opnieuw.</p>
      )}
      {hasMeasurements(profile.measurements) ? (
        <MeasurementsSummary items={items} />
      ) : (
        <p className="muted">
          Nog geen afmetingen. Met je afmetingen geeft de app per merk het juiste maatadvies, want elk merk valt anders.
        </p>
      )}
      <div className="form-actions start">
        <button className="btn" onClick={() => setMeasuring(true)}>
          <Icon name="ruler" size={18} /> {hasMeasurements(profile.measurements) ? 'Afmetingen bijwerken' : 'Afmetingen invullen'}
        </button>
        <a className="btn" href="#aankopen">
          Maatadvies per merk
        </a>
      </div>

      <h2 className="section-title">Wat de stylist heeft geleerd</h2>
      <div className="stats">
        <div>
          <strong>{count('like') + count('saved')}</strong>
          <span>keer goed bevonden</span>
        </div>
        <div>
          <strong>{count('dislike')}</strong>
          <span>keer afgewezen</span>
        </div>
        <div>
          <strong>{count('worn')}</strong>
          <span>keer gedragen</span>
        </div>
      </div>

      <h2 className="section-title">Kast</h2>
      <div className="stats">
        <div>
          <strong>{items.length}</strong>
          <span>artikelen</span>
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
        {categoriesFor(profile.department).map((c) => {
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
          <h3 className="eyebrow">Meest gedragen</h3>
          <ul className="list">
            {mostWorn.map((i) => (
              <li key={i.id}>
                <Photo item={i} className="thumb" />
                <span className="grow">
                  <span className="card-brand block">{i.brand || i.category}</span>
                  {i.name}
                </span>
                <span className="muted">{i.wornCount}×</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section-title">Koppelingen</h2>
      <p className="muted small">
        Deze gegevens blijven op dit apparaat. De API-sleutel gaat alleen naar Claude, de Client-ID alleen naar Google.
      </p>
      <label className="field">
        <span>Claude API-sleutel</span>
        <input
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
          value={settings.anthropicKey}
          onChange={(e) => saveSettings({ anthropicKey: e.target.value.trim() })}
        />
        <small className="muted">
          Voor de stijltest, stylist, inspiratie en het lezen van bestelmails. Maak er een aan op{' '}
          <a href="https://platform.claude.com/settings/keys" target="_blank" rel="noopener noreferrer">
            platform.claude.com
          </a>
          ; gebruik wordt per verzoek afgerekend.
        </small>
      </label>
      <label className="field">
        <span>Google Client-ID</span>
        <input
          autoComplete="off"
          placeholder="…apps.googleusercontent.com"
          value={settings.googleClientId}
          onChange={(e) => {
            disconnect()
            saveSettings({ googleClientId: e.target.value.trim() })
          }}
        />
        <small className="muted">Voor de Gmail-koppeling. Zie de README voor het eenmalig aanmaken.</small>
      </label>

      <h2 className="section-title">Backup</h2>
      <p className="muted small">
        Alle profielen, kasten en foto’s staan alleen op dit apparaat. Maak af en toe een backup.
      </p>
      <div className="form-actions start">
        <button className="btn btn-primary" onClick={onExport}>
          Backup downloaden
        </button>
        <label className="btn">
          Backup terugzetten
          <input type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </label>
      </div>

      <h2 className="section-title">Profiel verwijderen</h2>
      <div className="form-actions start">
        <button className="btn btn-danger" onClick={onDeleteProfile}>
          Profiel van {profile.name} verwijderen
        </button>
      </div>

      {measuring && (
        <Sheet title="Maten en afmetingen" onClose={() => setMeasuring(false)}>
          <MeasurementsForm
            department={profile.department}
            value={profile.measurements}
            submitLabel="Opslaan"
            onSubmit={async (m) => {
              await saveMeasurements(profile.id, m)
              setMeasuring(false)
            }}
          />
        </Sheet>
      )}
      {editing && (
        <Sheet title="Gegevens wijzigen" onClose={() => setEditing(false)}>
          <ProfileForm
            profile={profile}
            submitLabel="Opslaan"
            onCancel={() => setEditing(false)}
            onSubmit={async (input) => {
              await db.profiles.update(profile.id, { ...input, age: input.age, job: input.job })
              setEditing(false)
            }}
          />
        </Sheet>
      )}
    </section>
  )
}
