import { useEffect, useState } from 'react'
import type { Product } from './ai'
import type { Profile } from './db'

/**
 * Looks up real products from web shops for some wishes once `enabled` is true.
 * `products[i]` belongs to `wishes[i]`; `undefined` while not (yet) loaded for exactly these wishes.
 */
export function useRealProducts(profile: Profile, wishes: string[], enabled: boolean, perWish = 2) {
  const key = JSON.stringify([profile.id, wishes, perWish])
  const [found, setFound] = useState<{ key: string; products?: Product[][]; error?: string }>()

  useEffect(() => {
    if (!enabled || wishes.length === 0) return
    let cancelled = false
    import('./ai')
      .then(({ findProducts }) => findProducts(profile, wishes, perWish))
      .then((products) => !cancelled && setFound({ key, products }))
      .catch((e) => !cancelled && setFound({ key, error: e instanceof Error ? e.message : String(e) }))
    return () => {
      cancelled = true
    }
    // `key` stands in for `wishes`, which is a new array on every render.
  }, [key, enabled]) // oxlint-disable-line react-hooks/exhaustive-deps

  const current = enabled && found?.key === key ? found : undefined
  return { products: current?.products, error: current?.error }
}
