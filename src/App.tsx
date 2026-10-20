import { useEffect, useState } from 'react'
import { ClosetView } from './components/ClosetView'
import { OutfitsView } from './components/OutfitsView'
import { PurchasesView } from './components/PurchasesView'
import { SettingsView } from './components/SettingsView'
import { StylistView } from './components/StylistView'

const TABS = [
  { id: 'kast', label: 'Kast', icon: '👚' },
  { id: 'outfits', label: 'Outfits', icon: '👗' },
  { id: 'stylist', label: 'Stylist', icon: '✨' },
  { id: 'aankopen', label: 'Aankopen', icon: '🛍️' },
  { id: 'meer', label: 'Meer', icon: '⚙️' },
] as const
type Tab = (typeof TABS)[number]['id']

function tabFromHash(): Tab {
  const h = location.hash.slice(1)
  return TABS.some((t) => t.id === h) ? (h as Tab) : 'kast'
}

export default function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    // Ask the browser not to evict our IndexedDB data under storage pressure.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>Garderobe</h1>
      </header>
      <main>
        {tab === 'kast' && <ClosetView />}
        {tab === 'outfits' && <OutfitsView />}
        {tab === 'stylist' && <StylistView />}
        {tab === 'aankopen' && <PurchasesView />}
        {tab === 'meer' && <SettingsView />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <a key={t.id} href={`#${t.id}`} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  )
}
