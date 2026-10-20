/**
 * Read-only Gmail access from the browser via Google Identity Services (token flow).
 * The access token is kept in memory only and expires after about an hour.
 */

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (r: TokenResponse) => void
            error_callback?: (e: { type: string; message?: string }) => void
          }): { requestAccessToken(): void }
        }
      }
    }
  }
}

export const SHOPS = [
  { name: 'Zalando', match: /zalando/i },
  { name: 'BestSecret', match: /bestsecret/i },
  { name: 'Otrium', match: /otrium/i },
] as const

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const QUERY =
  'from:(zalando OR bestsecret OR otrium) subject:(bestelling OR order OR besteld OR bestellung OR aankoop) newer_than:5y -in:spam -in:trash'

let token: { value: string; expires: number } | undefined

function loadScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Kon Google-inloggen niet laden. Ben je online?'))
    document.head.appendChild(s)
  })
}

export function isConnected(): boolean {
  return !!token && token.expires > Date.now()
}

export function disconnect(): void {
  token = undefined
}

export async function connect(clientId: string): Promise<void> {
  if (!clientId) throw new Error('Vul eerst je Google Client-ID in onder Meer → Koppelingen.')
  await loadScript()
  const value = await new Promise<string>((resolve, reject) => {
    const tc = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (r) => {
        if (r.access_token) {
          token = { value: r.access_token, expires: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000 }
          resolve(r.access_token)
        } else reject(new Error(r.error_description || r.error || 'Inloggen bij Google mislukt.'))
      },
      error_callback: (e) =>
        reject(new Error(e.type === 'popup_closed' ? 'Inloggen geannuleerd.' : e.message || 'Inloggen bij Google mislukt.')),
    })
    tc.requestAccessToken()
  })
  token ??= { value, expires: Date.now() + 3_000_000 }
}

async function api<T>(path: string): Promise<T> {
  if (!isConnected()) throw new Error('Je Gmail-sessie is verlopen. Koppel Gmail opnieuw.')
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token!.value}` } })
  if (res.status === 401) {
    token = undefined
    throw new Error('Je Gmail-sessie is verlopen. Koppel Gmail opnieuw.')
  }
  if (!res.ok) throw new Error(`Gmail gaf een fout (${res.status}).`)
  return res.json()
}

/** Ids of possible order mails, newest first. */
export async function searchOrderMails(max = 100): Promise<string[]> {
  const ids: string[] = []
  let pageToken: string | undefined
  do {
    const q = new URLSearchParams({ q: QUERY, maxResults: String(Math.min(100, max - ids.length)) })
    if (pageToken) q.set('pageToken', pageToken)
    const r = await api<{ messages?: { id: string }[]; nextPageToken?: string }>(`/messages?${q}`)
    ids.push(...(r.messages ?? []).map((m) => m.id))
    pageToken = r.nextPageToken
  } while (pageToken && ids.length < max)
  return ids
}

interface Part {
  mimeType?: string
  body?: { data?: string }
  parts?: Part[]
}

export interface OrderMail {
  id: string
  shop: string
  subject: string
  date: number
  text: string
  imageUrls: string[]
}

function decode(data: string): string {
  const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

function findBody(part: Part, mime: string): string | undefined {
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data)
  for (const p of part.parts ?? []) {
    const found = findBody(p, mime)
    if (found) return found
  }
  return undefined
}

/** Plain text plus product-image candidates from an HTML mail. */
export function parseHtml(html: string): { text: string; imageUrls: string[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('style, script, head').forEach((el) => el.remove())
  const imageUrls = [
    ...new Set(
      [...doc.querySelectorAll('img')]
        .filter((img) => {
          // Skip tracking pixels and tiny icons.
          const w = Number(img.getAttribute('width') ?? 999)
          const h = Number(img.getAttribute('height') ?? 999)
          return w > 40 && h > 40
        })
        .map((img) => img.getAttribute('src') ?? '')
        .filter((src) => /^https:\/\//.test(src)),
    ),
  ].slice(0, 80)
  doc.querySelectorAll('br, p, div, tr, li, h1, h2, h3, td').forEach((el) => el.append('\n'))
  const text = (doc.body?.textContent ?? '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
  return { text, imageUrls }
}

export async function getOrderMail(id: string): Promise<OrderMail> {
  const m = await api<{ internalDate: string; payload: Part & { headers: { name: string; value: string }[] } }>(
    `/messages/${id}?format=full`,
  )
  const header = (n: string) => m.payload.headers.find((h) => h.name.toLowerCase() === n)?.value ?? ''
  const from = header('from')
  const html = findBody(m.payload, 'text/html')
  const plain = findBody(m.payload, 'text/plain')
  const parsed = html ? parseHtml(html) : { text: plain ?? '', imageUrls: [] }
  return {
    id,
    shop: SHOPS.find((s) => s.match.test(from))?.name ?? from,
    subject: header('subject'),
    date: Number(m.internalDate),
    ...parsed,
  }
}
