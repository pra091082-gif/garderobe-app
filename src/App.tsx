import { useEffect, useState } from 'react'
import { ClosetView } from './components/ClosetView'
import { Icon, type IconName } from './components/icons'
import { Onboarding } from './components/Onboarding'
import { OutfitsView } from './components/OutfitsView'
import { ProfileView } from './components/ProfileView'
import { PurchasesView } from './components/PurchasesView'
import { StylistView } from './components/StylistView'
import { Loading } from './components/ui'
import { ProfileContext, setActiveProfile, useProfiles } from './profile'

const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'kast', label: 'Kast', icon: 'closet' },
  { id: 'outfits', label: 'Outfits', icon: 'outfit' },
  { id: 'stylist', label: 'Stylist', icon: 'sparkle' },
  { id: 'aankopen', label: 'Aankopen', icon: 'bag' },
  { id: 'profiel', label: 'Profiel', icon: 'user' },
]

function tabFromHash(): string {
  const h = location.hash.slice(1)
  return TABS.some((t) => t.id === h) ? h : 'kast'
}

export default function App() {
  const [tab, setTab] = useState(tabFromHash)
  // Kept on while a new profile goes through onboarding (the profile exists before the style test ends).
  const [onboarding, setOnboarding] = useState<'first' | 'add'>()
  const state = useProfiles()

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    // Ask the browser not to evict our IndexedDB data under storage pressure.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  if (!state) return <Loading>Laden…</Loading>
  const { profiles, profile } = state
  if (!profile || onboarding) {
    const done = () => {
      setOnboarding(undefined)
      location.hash = 'kast'
    }
    return (
      <Onboarding
        skipWelcome={onboarding === 'add'}
        onCreating={() => setOnboarding((o) => o ?? 'first')}
        onDone={done}
      />
    )
  }

  const nav = (cls: string) =>
    TABS.map((t) => (
      <a key={t.id} href={`#${t.id}`} className={tab === t.id ? 'active' : ''} aria-current={tab === t.id}>
        <Icon name={t.icon} size={cls === 'tabbar' ? 24 : 18} />
        {t.label}
      </a>
    ))

  return (
    <ProfileContext.Provider value={profile}>
      <div className="app">
        <header className="header">
          <div className="header-row">
            <a href="#kast" className="wordmark">
              GARDEROBE
            </a>
            <nav className="topnav" aria-label="Hoofdmenu">
              {nav('topnav')}
            </nav>
          </div>
          <nav className="departments" aria-label="Profielen">
            {profiles.map((p) => (
              <button
                key={p.id}
                className={p.id === profile.id ? 'active' : ''}
                aria-pressed={p.id === profile.id}
                onClick={() => setActiveProfile(p.id)}
              >
                <span>{p.department}</span>
                <strong>{p.name}</strong>
              </button>
            ))}
            <button className="add-profile" onClick={() => setOnboarding('add')}>
              <Icon name="plus" size={16} /> Persoon
            </button>
          </nav>
        </header>
        <main key={profile.id}>
          {tab === 'kast' && <ClosetView />}
          {tab === 'outfits' && <OutfitsView />}
          {tab === 'stylist' && <StylistView />}
          {tab === 'aankopen' && <PurchasesView />}
          {tab === 'profiel' && <ProfileView />}
        </main>
        <nav className="tabbar" aria-label="Hoofdmenu">
          {nav('tabbar')}
        </nav>
      </div>
    </ProfileContext.Provider>
  )
}
