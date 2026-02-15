type CacheEntry<T> = {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    store.delete(key)
    return undefined
  }
  return entry.value as T
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs })
}

export async function cacheGetOrSet<T>(
  key: string,
  fn: () => Promise<T>,
  ttlMs: number,
): Promise<T> {
  const cached = cacheGet<T>(key)
  if (cached !== undefined) return cached
  const value = await fn()
  cacheSet(key, value, ttlMs)
  return value
}

export function makeCacheKey(prefix: string, params: Record<string, unknown>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
  return `${prefix}:${parts.join(',')}`
}
