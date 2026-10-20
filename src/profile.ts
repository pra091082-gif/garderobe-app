import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext, useSyncExternalStore } from 'react'
import { db, type Feedback, type Item, type Profile } from './db'

const KEY = 'garderobe-active-profile'
const listeners = new Set<() => void>()

function readActive(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

let active = readActive()

export function setActiveProfile(id: string): void {
  active = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // storage unavailable; keep in memory
  }
  listeners.forEach((l) => l())
}

function useActiveId(): string {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => active,
  )
}

/** All profiles plus the active one (falls back to the first). `undefined` while loading. */
export function useProfiles(): { profiles: Profile[]; profile?: Profile } | undefined {
  const id = useActiveId()
  const profiles = useLiveQuery(() => db.profiles.orderBy('createdAt').toArray())
  if (!profiles) return undefined
  return { profiles, profile: profiles.find((p) => p.id === id) ?? profiles[0] }
}

/** Provided by App once a profile exists, so screens can rely on it being present. */
export const ProfileContext = createContext<Profile | undefined>(undefined)

export function useProfile(): Profile {
  const profile = useContext(ProfileContext)
  if (!profile) throw new Error('useProfile buiten ProfileContext')
  return profile
}

export function useProfileItems(profileId: string): Item[] | undefined {
  return useLiveQuery(() => db.items.where('profileId').equals(profileId).toArray(), [profileId])
}

export function useFeedback(profileId: string): Feedback[] {
  return useLiveQuery(() => db.feedback.where('profileId').equals(profileId).sortBy('createdAt'), [profileId]) ?? []
}

export function personLabel(p: Profile): string {
  if (p.department === 'Kinderen') return p.age ? `kind van ${p.age} jaar` : 'kind'
  return p.department === 'Dames' ? 'vrouw' : 'man'
}
