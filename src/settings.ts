import { useSyncExternalStore } from 'react'

/** Per-device settings. Kept in localStorage; they never leave this device except to the services they belong to. */
export interface Settings {
  anthropicKey: string
  googleClientId: string
}

const KEY = 'garderobe-settings'
const listeners = new Set<() => void>()
let cache: Settings | undefined

function read(): Settings {
  if (cache) return cache
  let stored: Partial<Settings> = {}
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    // ignore unreadable storage
  }
  cache = {
    anthropicKey: stored.anthropicKey ?? '',
    googleClientId: stored.googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  }
  return cache
}

export function getSettings(): Settings {
  return read()
}

export function saveSettings(patch: Partial<Settings>): void {
  cache = { ...read(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    // storage unavailable (private mode); keep in memory only
  }
  listeners.forEach((l) => l())
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
  )
}
