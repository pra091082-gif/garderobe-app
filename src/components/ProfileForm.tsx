import { useState, type FormEvent } from 'react'
import { DEPARTMENTS, DRESSCODES, type Department, type Dresscode, type Job, type Profile } from '../db'

export type ProfileInput = Pick<Profile, 'name' | 'department' | 'age' | 'job'>

const DEPT_HINT: Record<Department, string> = { Dames: 'Vrouw', Heren: 'Man', Kinderen: 'Kind' }

export function ProfileForm({
  profile,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  profile?: Profile
  submitLabel: string
  onSubmit: (p: ProfileInput) => void | Promise<void>
  onCancel?: () => void
}) {
  const [name, setName] = useState(profile?.name ?? '')
  const [department, setDepartment] = useState<Department>(profile?.department ?? 'Dames')
  const [age, setAge] = useState(profile?.age ? String(profile.age) : '')
  const [works, setWorks] = useState(!!profile?.job)
  const [job, setJob] = useState<Job>(
    profile?.job ?? { title: '', company: '', industry: '', dresscode: 'Smart casual' },
  )
  const isChild = department === 'Kinderen'

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      name: name.trim() || DEPT_HINT[department],
      department,
      age: isChild && age ? Number(age) : undefined,
      job: !isChild && works && job.title.trim() ? { ...job, title: job.title.trim() } : undefined,
    })
  }

  return (
    <form className="form" onSubmit={submit}>
      <fieldset className="field">
        <legend>Voor wie is deze kast?</legend>
        <div className="dept-picker">
          {DEPARTMENTS.map((d) => (
            <button
              key={d}
              type="button"
              className={department === d ? 'active' : ''}
              aria-pressed={department === d}
              onClick={() => setDepartment(d)}
            >
              {d}
              <span>{DEPT_HINT[d]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className={isChild ? 'row-2' : ''}>
        <label className="field">
          <span>Naam</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Voornaam" autoComplete="given-name" />
        </label>
        {isChild && (
          <label className="field">
            <span>Leeftijd</span>
            <input type="number" min={0} max={18} inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
          </label>
        )}
      </div>

      {!isChild && (
        <fieldset className="field">
          <legend>Werk</legend>
          <label className="check">
            <input type="checkbox" checked={works} onChange={(e) => setWorks(e.target.checked)} />
            Ik wil ook outfits voor mijn werk
          </label>
          {works && (
            <div className="form" style={{ gap: 14, marginTop: 8 }}>
              <label className="field">
                <span>Functie</span>
                <input
                  required
                  value={job.title}
                  onChange={(e) => setJob({ ...job, title: e.target.value })}
                  placeholder="Bijv. accountmanager, verpleegkundige, advocaat"
                />
              </label>
              <div className="row-2">
                <label className="field">
                  <span>Bedrijf</span>
                  <input value={job.company} onChange={(e) => setJob({ ...job, company: e.target.value })} />
                </label>
                <label className="field">
                  <span>Branche</span>
                  <input
                    value={job.industry}
                    onChange={(e) => setJob({ ...job, industry: e.target.value })}
                    placeholder="Bijv. bank, IT, zorg"
                  />
                </label>
              </div>
              <label className="field">
                <span>Dresscode</span>
                <select value={job.dresscode} onChange={(e) => setJob({ ...job, dresscode: e.target.value as Dresscode })}>
                  {DRESSCODES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </fieldset>
      )}

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Annuleren
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
