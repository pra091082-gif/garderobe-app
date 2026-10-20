import { useState, type FormEvent } from 'react'
import type { Department, Measurements } from '../db'
import { fieldsFor } from '../sizes'

type Draft = Record<string, string>

function toDraft(m?: Measurements): Draft {
  const d: Draft = {}
  if (m) for (const [k, v] of Object.entries(m)) if (k !== 'updatedAt' && v !== undefined) d[k] = String(v)
  return d
}

export function MeasurementsForm({
  department,
  value,
  submitLabel,
  onSubmit,
  onSkip,
}: {
  department: Department
  value?: Measurements
  submitLabel: string
  onSubmit: (m: Omit<Measurements, 'updatedAt'>) => void | Promise<void>
  onSkip?: () => void
}) {
  const fields = fieldsFor(department)
  const [draft, setDraft] = useState<Draft>(() => toDraft(value))

  function submit(e: FormEvent) {
    e.preventDefault()
    const m: Omit<Measurements, 'updatedAt'> = {}
    for (const f of fields) {
      const raw = (draft[f.key] ?? '').trim()
      if (!raw) continue
      if (f.numeric) {
        const n = Number(raw.replace(',', '.'))
        if (Number.isFinite(n) && n > 0) (m as unknown as Record<string, number>)[f.key] = n
      } else {
        ;(m as unknown as Record<string, string>)[f.key] = raw
      }
    }
    onSubmit(m)
  }

  return (
    <form className="form" onSubmit={submit}>
      <p className="muted small">
        Vul in wat je weet; alles is optioneel. Meet met een zacht meetlint over dunne kleding, niet te strak. Hoe meer je
        invult, hoe beter het maatadvies.
      </p>
      <div className="measure-grid">
        {fields.map((f) => (
          <label key={f.key} className="field">
            <span>
              {f.label}
              {f.unit && <em className="unit"> ({f.unit})</em>}
            </span>
            <input
              id={`m-${f.key}`}
              inputMode={f.numeric ? 'decimal' : 'text'}
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
            <small className="muted">{f.hint}</small>
          </label>
        ))}
      </div>
      <div className="form-actions">
        {onSkip && (
          <button type="button" className="btn" onClick={onSkip}>
            Later invullen
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
