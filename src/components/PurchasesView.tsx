import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import type { ShopOrder, ShopPurchase } from '../ai'
import { db, newId, type Item, type Profile } from '../db'
import { connect, getOrderMail, isConnected, searchOrderMails, type OrderMail } from '../gmail'
import { downloadImage, useObjectUrl } from '../media'
import { useProfile, useProfiles } from '../profile'
import { useSettings } from '../settings'
import { formatPrice, toggle } from '../util'
import { Icon } from './icons'
import { SizeAdvisor } from './SizeAdvisor'
import { ColorDot, Loading, PhotoButtons } from './ui'

const BATCH = 10

/**
 * Order pages of the shops. On a phone with the shop app installed these links open the app itself;
 * otherwise the website, where you log in.
 */
const SHOP_LINKS = [
  { name: 'BestSecret', url: 'https://www.bestsecret.com/' },
  { name: 'Zalando', url: 'https://www.zalando.nl/myaccount/orders/' },
]

/** An order waiting for review, from a Gmail mail, a screenshot or a product link. */
interface Found {
  key: string
  shop: string
  title: string
  date: number
  orderDate: string | null
  items: ShopPurchase[]
  selected: number[]
  profileId: string
  /** Set for orders from Gmail, so the mail is not read again. */
  mail?: OrderMail
}

/** The person an order is most likely for: a single profile in the department the shop names. */
function guessProfile(items: ShopPurchase[], profiles: Profile[], fallback: string): string {
  const deps = new Set(items.map((i) => i.department).filter(Boolean))
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
  const [link, setLink] = useState('')
  // Set after opening a shop; once the person comes back, the screenshot step is highlighted.
  const [away, setAway] = useState(false)
  const [back, setBack] = useState(false)

  useEffect(() => {
    if (!away) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      setAway(false)
      setBack(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [away])

  const awayToShop = () => {
    setBack(false)
    setAway(true)
  }

  const ready = !!settings.anthropicKey && !!settings.googleClientId
  const hasKey = !!settings.anthropicKey

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
        const clothing = result.items
          .filter((i) => i.isClothing)
          .map(({ imageUrl, ...i }) => ({ ...i, imageUrl: imageUrl ?? undefined }))
        if (result.isOrderConfirmation && clothing.length > 0) {
          setFound((f) => [
            ...f,
            {
              key: mail.id,
              shop: mail.shop,
              title: mail.subject,
              date: mail.date,
              orderDate: result.orderDate,
              items: clothing,
              selected: clothing.map((_, i) => i),
              profileId: guessProfile(clothing, profiles, active.id),
              mail,
            },
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

  /** Adds an order from a screenshot or link to the review list; pieces already in the closet start unticked. */
  async function review(order: ShopOrder, key: string, title: string) {
    const items = order.items.filter((i) => i.isClothing)
    if (items.length === 0) throw new Error(`Geen kleding gevonden in ${title.toLowerCase()}.`)
    const owned = await db.items.toArray()
    const known = (p: ShopPurchase) =>
      owned.some(
        (o) =>
          o.name.toLowerCase() === p.name.toLowerCase() &&
          o.brand.toLowerCase() === p.brand.toLowerCase() &&
          (o.size ?? null) === p.size,
      )
    const shop = order.shop || 'Webwinkel'
    setFound((f) => [
      ...f,
      {
        key,
        shop,
        title,
        date: Date.now(),
        orderDate: order.orderDate,
        items,
        selected: items.flatMap((p, i) => (known(p) ? [] : [i])),
        profileId: guessProfile(items, profiles, active.id),
      },
    ])
  }

  const readScreenshots = (files: File[]) =>
    run(async () => {
      setBack(false)
      const { extractFromScreenshot } = await import('../ai')
      for (const [n, file] of files.entries()) {
        setStatus(`Screenshot ${n + 1} van ${files.length} lezen…`)
        try {
          await review(await extractFromScreenshot(file), newId(), `Screenshot ${n + 1}`)
        } catch (e) {
          // One unreadable screenshot should not stop the rest.
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    })

  const readLink = () =>
    run(async () => {
      const url = link.trim()
      if (!/^https?:\/\//.test(url)) throw new Error('Plak een volledige link, beginnend met https://')
      setStatus('Productpagina lezen…')
      const { extractFromLink } = await import('../ai')
      await review(await extractFromLink(url), newId(), url)
      setLink('')
    })

  const save = (f: Found) =>
    run(async () => {
      const chosen = f.selected.map((i) => f.items[i])
      for (const [n, p] of chosen.entries()) {
        setStatus(`Stuk ${n + 1} van ${chosen.length} opslaan…`)
        const photo = p.photo ?? (p.imageUrl ? await downloadImage(p.imageUrl) : undefined)
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
          source: f.mail ? 'gmail' : 'shop',
          shop: f.shop,
          size: p.size ?? undefined,
          price: p.price ?? undefined,
          purchasedAt: f.orderDate ?? (f.mail ? new Date(f.mail.date).toISOString().slice(0, 10) : undefined),
          wornCount: 0,
          createdAt: Date.now(),
        }
        await db.items.add(item)
      }
      if (f.mail)
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

      <div className="page-head">
        <div>
          <span className="eyebrow">Screenshot of link</span>
          <h2 className="section-title" style={{ marginTop: 0, fontSize: '1.4rem' }}>
            Je bestellingen in de kast
          </h2>
          <p>
            Open in de app van Zalando of BestSecret <strong>Mijn bestellingen</strong> (of een bestelling) en maak
            screenshots. De app haalt alle stukken eruit, met foto, merk, maat en prijs. Een productlink van Zalando
            plakken kan ook. Geretourneerde stukken worden overgeslagen.
          </p>
        </div>
      </div>

      {!hasKey ? (
        <p className="message">
          Vul eerst je Claude API-sleutel in onder <a href="#profiel">Profiel → Koppelingen</a>.
        </p>
      ) : (
        <div className={`panel ${back ? 'panel-highlight' : ''}`}>
          <ol className="steps">
            <li>Open je bestellingen in de winkel-app.</li>
            <li>Maak screenshots van wat je hebt gekocht.</li>
            <li>Kom terug en kies de screenshots.</li>
          </ol>
          <div className="shop-links">
            {SHOP_LINKS.map((s) => (
              <a
                key={s.name}
                className="btn"
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={awayToShop}
              >
                <Icon name="bag" size={18} /> {s.name}
              </a>
            ))}
          </div>
          {back && (
            <p>
              <strong>Welkom terug.</strong> Kies nu de screenshots van je bestellingen.
            </p>
          )}
          <PhotoButtons
            multiple
            camera={false}
            galleryLabel="Screenshots kiezen"
            disabled={busy}
            onFiles={readScreenshots}
          />
          <div className="link-row">
            <label className="field grow">
              <span>Of plak een productlink</span>
              <input
                type="url"
                inputMode="url"
                placeholder="https://www.zalando.nl/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </label>
            <button className="btn" disabled={busy || !link.trim()} onClick={readLink}>
              <Icon name="link" size={18} /> Ophalen
            </button>
          </div>
        </div>
      )}

      {status && <Loading>{status}</Loading>}
      {error && <p className="error">{error}</p>}

      {found.map((f) => (
        <div key={f.key} className="result">
          <header>
            <div>
              <span className="eyebrow">
                {f.orderDate
                  ? new Date(f.orderDate).toLocaleDateString('nl-NL')
                  : new Date(f.date).toLocaleDateString('nl-NL')}
              </span>
              <h3>{f.shop}</h3>
              <div className="muted small">{f.title}</div>
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
            {f.items.map((p, i) => (
              <li key={i}>
                <input
                  type="checkbox"
                  aria-label={`${p.name} toevoegen`}
                  checked={f.selected.includes(i)}
                  onChange={() =>
                    setFound((all) => all.map((x) => (x === f ? { ...x, selected: toggle(x.selected, i) } : x)))
                  }
                />
                <Thumb item={p} />
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

      <div className="page-head">
        <div>
          <span className="eyebrow">Uit Gmail</span>
          <h2 className="section-title" style={{ marginTop: 0, fontSize: '1.4rem' }}>
            Online aankopen
          </h2>
          <p>
            De app zoekt in Gmail naar bestelbevestigingen en haalt de gekochte kleding eruit, met foto, merk, maat en
            prijs. Jij kiest wat in welke kast komt. Gmail wordt alleen gelezen, nooit gewijzigd. Hiervoor is eenmalig
            een Google Client-ID nodig (zie de handleiding).
          </p>
        </div>
      </div>

      {!ready ? (
        <p className="message">
          Voor Gmail: vul je Claude API-sleutel en Google Client-ID in onder{' '}
          <a href="#profiel">Profiel → Koppelingen</a>.
        </p>
      ) : (
        <div className="form-actions start">
          <button className="btn btn-primary" disabled={busy} onClick={search}>
            <Icon name="search" size={18} /> {connected ? 'Opnieuw zoeken' : 'Gmail koppelen en zoeken'}
          </button>
        </div>
      )}

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

      <SizeAdvisor />
    </section>
  )
}

function Thumb({ item }: { item: ShopPurchase }) {
  const url = useObjectUrl(item.photo) ?? item.imageUrl
  if (url) return <img className="thumb photo" src={url} alt="" referrerPolicy="no-referrer" />
  return (
    <span className="thumb photo photo-empty">
      <Icon name="bag" />
    </span>
  )
}
