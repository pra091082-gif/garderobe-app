import { useState } from 'react'
import type { SizeAdvice } from '../ai'
import { categoriesFor, type Category, type Item } from '../db'
import { useProfile, useProfileItems } from '../profile'
import { useSettings } from '../settings'
import { fieldsFor, formatKnownSizes, formatMeasurements, hasMeasurements, knownSizes, remeasureDue } from '../sizes'
import { Icon } from './icons'
import { Chip, Loading } from './ui'

const FIT_WISHES = ['Nauwsluitend', 'Normaal', 'Ruim'] as const

/** "Which size should I order?" — per brand, from measurements and what already fits. */
export function SizeAdvisor() {
  const profile = useProfile()
  const items = useProfileItems(profile.id) ?? []
  const { anthropicKey } = useSettings()
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState<Category>(profile.department === 'Heren' ? 'Overhemden & blouses' : 'Tops')
  const [productUrl, setProductUrl] = useState('')
  const [fitWish, setFitWish] = useState<(typeof FIT_WISHES)[number]>('Normaal')
  const [advice, setAdvice] = useState<SizeAdvice>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const known = knownSizes(items)
  const brands = [...new Set(known.map((k) => k.brand))]
  const sameBrand = known.filter((k) => brand && k.brand.toLowerCase() === brand.trim().toLowerCase())
  const measured = hasMeasurements(profile.measurements)

  async function ask() {
    setBusy(true)
    setError(undefined)
    setAdvice(undefined)
    try {
      const { sizeAdvice } = await import('../ai')
      setAdvice(
        await sizeAdvice(profile, formatKnownSizes(known), formatMeasurements(profile), {
          brand: brand.trim(),
          category,
          productUrl: productUrl.trim(),
          fitWish,
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Voor je bestelt</span>
          <h2 className="section-title" style={{ marginTop: 0, fontSize: '1.4rem' }}>
            Welke maat bij welk merk?
          </h2>
          <p>Elk merk valt anders. De app vergelijkt de maattabel van het merk met je afmetingen en met wat je al hebt.</p>
        </div>
      </div>

      {!measured ? (
        <p className="message">
          Vul eerst de afmetingen van {profile.name} in onder <a href="#profiel">Profiel → Maten</a>.
        </p>
      ) : (
        remeasureDue(profile) && (
          <p className="message">
            De afmetingen van {profile.name} zijn ouder dan een half jaar. Kinderen groeien snel: meet opnieuw onder{' '}
            <a href="#profiel">Profiel → Maten</a>.
          </p>
        )
      )}

      <div className="panel">
        <div className="row-2">
          <label className="field">
            <span>Merk</span>
            <input
              id="size-brand"
              list="size-brands"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Bijv. Levi's, Zara, Nike"
            />
            <datalist id="size-brands">
              {brands.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Soort</span>
            <select id="size-category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {categoriesFor(profile.department).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          <span>Productlink (optioneel)</span>
          <input
            id="size-url"
            type="url"
            inputMode="url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="Plak de link van Zalando, BestSecret, Otrium of een andere winkel"
          />
        </label>
        <div>
          <span className="eyebrow">Hoe wil je het dragen?</span>
          <div className="chips" style={{ marginTop: 8 }}>
            {FIT_WISHES.map((f) => (
              <Chip key={f} active={fitWish === f} onClick={() => setFitWish(f)}>
                {f}
              </Chip>
            ))}
          </div>
        </div>

        {sameBrand.length > 0 && (
          <div>
            <span className="eyebrow">Wat je al hebt van {sameBrand[0].brand}</span>
            <ul className="list" style={{ marginTop: 8 }}>
              {sameBrand.map((k, i) => (
                <li key={i}>
                  <span className="grow">
                    {k.name} <span className="muted small">· {k.category}</span>
                  </span>
                  <span>
                    <strong>{k.size}</strong>
                    {k.fit && <span className="muted small"> · {k.fit.toLowerCase()}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {anthropicKey ? (
          <button className="btn btn-primary" disabled={busy || (!brand.trim() && !productUrl.trim())} onClick={ask}>
            <Icon name="ruler" size={18} /> Maatadvies
          </button>
        ) : (
          <p className="small muted">
            Met een Claude API-sleutel (Profiel → Koppelingen) zoekt de app de maattabel van het merk op en geeft een
            maatadvies.
          </p>
        )}
      </div>

      {busy && <Loading>Maattabel van {brand || 'het merk'} zoeken en vergelijken…</Loading>}
      {error && <p className="error">{error}</p>}

      {advice && (
        <div className="result">
          <span className="eyebrow">
            Maatadvies {brand && `· ${brand}`} · {category}
          </span>
          <div className="size-answer">
            <strong>{advice.size}</strong>
            <span className="badge">zekerheid {advice.confidence}</span>
          </div>
          <p>{advice.explanation}</p>
          {advice.brandFit && (
            <p className="small">
              <strong>Pasvorm van het merk:</strong> {advice.brandFit}
            </p>
          )}
          {advice.alternative && <p className="small muted">{advice.alternative}</p>}
          {advice.comparison.length > 0 && (
            <div className="table-wrap">
              <table className="size-table">
                <thead>
                  <tr>
                    <th>Afmeting</th>
                    <th>Jij</th>
                    <th>Maat {advice.size}</th>
                  </tr>
                </thead>
                <tbody>
                  {advice.comparison.map((c, i) => (
                    <tr key={i}>
                      <td>{c.measure}</td>
                      <td>{c.yours}</td>
                      <td>{c.chart}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {advice.missing.length > 0 && (
            <p className="small muted">Zekerder advies met: {advice.missing.join(', ')}.</p>
          )}
          {advice.sizeChartUrl && (
            <a className="btn btn-small" style={{ alignSelf: 'flex-start' }} href={advice.sizeChartUrl} target="_blank" rel="noopener noreferrer">
              Maattabel bekijken <Icon name="arrowRight" size={16} />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

/** Compact overview of someone's measurements, handy next to any web shop's size chart. */
export function MeasurementsSummary({ items }: { items: Item[] }) {
  const profile = useProfile()
  const m = profile.measurements
  if (!hasMeasurements(m)) return null
  const fields = fieldsFor(profile.department).filter((f) => m![f.key] !== undefined && m![f.key] !== '')
  const known = knownSizes(items).filter((k) => k.fit === 'Past goed')
  return (
    <div className="page" style={{ gap: 12 }}>
      <div className="table-wrap">
        <table className="size-table">
          <tbody>
            {fields.map((f) => (
              <tr key={f.key}>
                <th scope="row">{f.label}</th>
                <td>
                  {m![f.key]}
                  {f.unit && ` ${f.unit}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted">Gemeten op {new Date(m!.updatedAt).toLocaleDateString('nl-NL')}.</p>
      {known.length > 0 && (
        <>
          <span className="eyebrow">Past goed per merk</span>
          <div className="tags">
            {known.map((k, i) => (
              <span key={i} className="tag-pill">
                {k.brand} {k.category.toLowerCase()}: <strong>{k.size}</strong>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
