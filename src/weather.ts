import { useCallback, useEffect, useState } from 'react'

/** Today's weather, as far as it matters for what to wear. */
export interface DayWeather {
  place: string
  tempMin: number
  tempMax: number
  /** Average daytime "feels like" temperature (weighted towards the warm part of the day). */
  feelsLike: number
  /** Highest chance of rain today, in %. */
  rainChance: number
  /** Highest wind speed today, in km/h. */
  windMax: number
  code: number
  fetchedAt: number
}

export interface Place {
  name: string
  lat: number
  lon: number
}

const PLACE_KEY = 'garderobe-place'
const CACHE_KEY = 'garderobe-weather'
const MAX_AGE = 60 * 60 * 1000

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable; the weather is simply fetched again next time
  }
}

/** Looks up a town via Open-Meteo's geocoding (free, no key). */
export async function findPlace(name: string): Promise<Place | undefined> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=nl`,
  )
  if (!res.ok) throw new Error('Zoeken naar de plaats is mislukt.')
  const hit = (await res.json()).results?.[0]
  return hit && { name: hit.name, lat: hit.latitude, lon: hit.longitude }
}

function currentPosition(): Promise<Place | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ name: 'Jouw locatie', lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(undefined),
      { timeout: 8000, maximumAge: MAX_AGE },
    )
  })
}

async function fetchWeather(place: Place): Promise<DayWeather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    '&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,' +
    'precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=auto&forecast_days=1'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Het weer kon niet worden opgehaald.')
  const d = (await res.json()).daily
  return {
    place: place.name,
    tempMin: Math.round(d.temperature_2m_min[0]),
    tempMax: Math.round(d.temperature_2m_max[0]),
    feelsLike: Math.round((d.apparent_temperature_max[0] * 2 + d.apparent_temperature_min[0]) / 3),
    rainChance: d.precipitation_probability_max[0] ?? 0,
    windMax: Math.round(d.wind_speed_10m_max[0]),
    code: d.weather_code[0],
    fetchedAt: Date.now(),
  }
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString()

function cachedToday(): DayWeather | undefined {
  const cached = readJson<DayWeather>(CACHE_KEY)
  return cached && sameDay(cached.fetchedAt, Date.now()) ? cached : undefined
}

/**
 * Today's weather for the saved place, or else the device location. Cached for an hour.
 * `needsPlace` is true when neither is available; the screen then asks for a town.
 */
export function useWeather() {
  const [weather, setWeather] = useState<DayWeather | undefined>(cachedToday)
  const [error, setError] = useState<string>()
  const [needsPlace, setNeedsPlace] = useState(false)

  const load = useCallback(async (place?: Place) => {
    try {
      const where = place ?? readJson<Place>(PLACE_KEY) ?? (await currentPosition())
      if (!where) return setNeedsPlace(true)
      const w = await fetchWeather(where)
      if (place) writeJson(PLACE_KEY, place)
      writeJson(CACHE_KEY, w)
      setError(undefined)
      setNeedsPlace(false)
      setWeather(w)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    const cached = cachedToday()
    if (!cached || Date.now() - cached.fetchedAt > MAX_AGE) void load()
  }, [load])

  return { weather, error, needsPlace, setPlace: load }
}

export function weatherLabel(code: number): string {
  if (code === 0) return 'Zonnig'
  if (code <= 3) return 'Half bewolkt'
  if (code <= 48) return 'Mistig'
  if (code <= 67 || (code >= 80 && code <= 82)) return 'Regen'
  if (code <= 77 || code === 85 || code === 86) return 'Sneeuw'
  return 'Onweer'
}

/** One line for the AI stylist, e.g. "8° tot 14°, voelt als 11°, 70% kans op regen, wind 25 km/u (Regen)". */
export function describeWeather(w: DayWeather): string {
  return `${w.tempMin}° tot ${w.tempMax}°, voelt als ${w.feelsLike}°, ${w.rainChance}% kans op regen, wind ${w.windMax} km/u (${weatherLabel(w.code)})`
}
