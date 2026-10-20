import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { PurchaseExtraction } from '../ai'
import { db, newId, type Item, type Profile } from '../db'
import { connect, getOrderMail, isConnected, searchOrderMails, type OrderMail } from '../gmail'
import { downloadImage } from '../media'
import { useProfile, useProfiles } from '../profile'
import { useSettings } from '../settings'
import { formatPrice, toggle } from '../util'
import { Icon } from './icons'
import { SizeAdvisor } from './SizeAdvisor'
import { ColorDot, Loading } from './ui'

const BATCH = 10

interface Found {
  mail: OrderMail
  result: PurchaseExtraction
  selected: number[]
  profileId: string
}

/** The person an order is most likely for: a single profile in the department the shop mail names. */
function guessProfile(result: PurchaseExtraction, profiles: Profile[], fallback: string): string {
  const deps = new Set(result.items.map((i) => i.department).filter(Boolean))
  if (deps.size !== 1) return fallback
  const matches = profiles.filter((p) => deps.has(p.department))
  return matches.length === 1 ? matches[0].id : fallback
}

export function PurchasesView() {
  const settings = useSettings()
  const active = useProfile()
  const profiles = useProfiles()?.profiles ?? [active]
  const history = useLiveQuery(() => db.mails.orderBy('date').reverse().toArray()) ?? []
  const [connected, setConnected] = useState(isConnected())
  const [pending, setPending] = useState<string[]>()
  const [found, setFound] = useState<Found[]>([])
  const [status, setStatus] = useState<string>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const ready = !!settings.anthropicKey && !!settings.googleClientId

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError(undefined)
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConnected(isConnected())
    } finally {
      setBusy(false)
      setStatus(undefined)
    }
  }

  const search = () =>
    run(async () => {
      if (!isConnected()) {
        await connect(settings.googleClientId)
        setConnected(true)
      }
      setStatus('Gmail doorzoeken…')
      const ids = await searchOrderMails()
      const seen = new Set((await db.mails.toArray()).map((m) => m.id))
      setPending(ids.filter((id) => !seen.has(id)))
      setFound([])
    })

  const processBatch = () =>
    run(async () => {
      const { extractPurchases } = await import('../ai')
      const batch = pending!.slice(0, BATCH)
      for (const [n, id] of batch.entries()) {
        setStatus(`Mail ${n + 1} van ${batch.length} lezen…`)
        const mail = await getOrderMail(id)
        const result = await extractPurchases(mail)
        const clothing = result.items.filter((i) => i.isClothing)
        if (result.isOrderConfirmation && clothing.length > 0) {
          result.items = clothing
          setFound((f) => [
            ...f,
            { mail, result, selected: clothing.map((_, i) => i), profileId: guessProfile(result, profiles, active.id) },
          ])
        } else {
          // Not an order (or nothing wearable): remember it so it is skipped next time.
          await db.mails.put({
            id,
            shop: mail.shop,
            subject: mail.subject,
            date: mail.date,
            itemCount: 0,
            importedAt: Date.now(),
          })
        }
        setPending((p) => p!.filter((x) => x !== id))
      }
    })

  const save = (f: Found) =>
    run(async () => {
      const chosen = f.selected.map((i) => f.result.items[i])
      for (const [n, p] of chosen.entries()) {
        setStatus(`Foto ${n + 1} van ${chosen.length} ophalen…`)
        const photo = p.imageUrl ? await downloadImage(p.imageUrl) : undefined
        const item: Item = {
          id: newId(),
          profileId: f.profileId,
          name: p.name,
          category: p.category,
          colors: p.colors,
          seasons: [],
          brand: p.brand,
          notes: '',
          favorite: false,
          photo,
          photoUrl: photo ? undefined : (p.imageUrl ?? undefined),
          source: 'gmail',
          shop: f.mail.shop,
          size: p.size ?? undefined,
          price: p.price ?? undefined,
          purchasedAt: f.result.orderDate ?? new Date(f.mail.date).toISOString().slice(0, 10),
          wornCount: 0,
          createdAt: Date.now(),
        }
        await db.items.add(item)
      }
      await db.mails.put({
        id: f.mail.id,
        shop: f.mail.shop,
        subject: f.mail.subject,
        date: f.mail.date,
        itemCount: chosen.length,
        importedAt: Date.now(),
      })
      setFound((all) => all.filter((x) => x !== f))
    })

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">Zalando · BestSecret · Otrium</span>
          <h1>Online kopen</h1>
        </div>
      </div>

      <SizeAdvisor />

      <div className="page-head">
        <div>
          <span className="eyebrow">Uit Gmail</span>
          <h2 className="section-title" style={{ marginTop: 0, fontSize: '1.4rem' }}>
            Online aankopen
          </h2>
          <p>
            De app zoekt in Gmail naar bestelbevestigingen en haalt de gekochte kleding eruit, met foto, merk, maat en
            prijs. Jij kiest wat in welke kast komt. Gmail wordt alleen gelezen, nooit gewijzigd.
          </p>
        </div>
      </div>

      {!ready ? (
        <p className="message">
          Vul eerst je Claude API-sleutel en Google Client-ID in onder <a href="#profiel">Profiel → Koppelingen</a>.
        </p>
      ) : (
        <div className="form-actions start">
          <button className="btn btn-primary" disabled={busy} onClick={search}>
            <Icon name="search" size={18} /> {connected ? 'Opnieuw zoeken' : 'Gmail koppelen en zoeken'}
          </button>
        </div>
      )}

      {status && <Loading>{status}</Loading>}
      {error && <p className="error">{error}</p>}

      {pending && !busy && (pending.length > 0 || found.length === 0) && (
        <div className="panel">
          {pending.length === 0 ? (
            <p>Geen nieuwe bestelmails gevonden.</p>
          ) : (
            <>
              <p>
                <strong>{pending.length}</strong> nieuwe {pending.length === 1 ? 'mail' : 'mails'} gevonden. Claude
                leest ze in porties van {BATCH}. Elke mail kost een paar cent aan API-gebruik.
              </p>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={processBatch}>
                Volgende {Math.min(BATCH, pending.length)} lezen
              </button>
            </>
          )}
        </div>
      )}

      {found.map((f) => (
        <div key={f.mail.id} className="result">
          <header>
            <div>
              <span className="eyebrow">{new Date(f.mail.date).toLocaleDateString('nl-NL')}</span>
              <h3>{f.mail.shop}</h3>
              <div className="muted small">{f.mail.subject}</div>
            </div>
            {profiles.length > 1 && (
              <label className="field" style={{ minWidth: 160 }}>
                <span>Voor wie?</span>
                <select
                  value={f.profileId}
                  onChange={(e) =>
                    setFound((all) => all.map((x) => (x === f ? { ...x, profileId: e.target.value } : x)))
                  }
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.department})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </header>
          <ul className="list">
            {f.result.items.map((p, i) => (
              <li key={i}>
                <input
                  type="checkbox"
                  aria-label={`${p.name} toevoegen`}
                  checked={f.selected.includes(i)}
                  onChange={() =>
                    setFound((all) => all.map((x) => (x === f ? { ...x, selected: toggle(x.selected, i) } : x)))
                  }
                />
                {p.imageUrl ? (
                  <img className="thumb photo" src={p.imageUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  <span className="thumb photo photo-empty">
                    <Icon name="bag" />
                  </span>
                )}
                <span className="grow">
                  <span className="card-brand block">{p.brand}</span>
                  {p.name}
                  <span className="muted small block">
                    {[p.department, p.category, p.size && `maat ${p.size}`, p.price != null && formatPrice(p.price)]
                      .filter(Boolean)
                      .join(' · ')}{' '}
                    {p.colors.map((c) => (
                      <ColorDot key={c} color={c} size={10} />
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="form-actions">
            <button className="btn" disabled={busy} onClick={() => setFound((all) => all.filter((x) => x !== f))}>
              Later
            </button>
            <button className="btn btn-primary" disabled={busy || f.selected.length === 0} onClick={() => save(f)}>
              {f.selected.length} toevoegen aan kast
            </button>
          </div>
        </div>
      ))}

      {history.some((m) => m.itemCount > 0) && (
        <>
          <h2 className="section-title">Eerder geïmporteerd</h2>
          <ul className="list">
            {history
              .filter((m) => m.itemCount > 0)
              .map((m) => (
                <li key={m.id}>
                  <span className="grow">
                    {m.shop} · {new Date(m.date).toLocaleDateString('nl-NL')}
                    <span className="muted small block">{m.subject}</span>
                  </span>
                  <span className="muted">{m.itemCount} stuks</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </section>
  )
}
