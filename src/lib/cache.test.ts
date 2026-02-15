import { describe, expect, test } from 'bun:test'
import { makeCacheKey, cacheGet, cacheSet, cacheGetOrSet } from './cache'

describe('makeCacheKey', () => {
  test('sorts parameters alphabetically', () => {
    const key1 = makeCacheKey('test', { b: '2', a: '1' })
    const key2 = makeCacheKey('test', { a: '1', b: '2' })
    expect(key1).toBe(key2)
  })

  test('filters out undefined values', () => {
    const key = makeCacheKey('test', { a: '1', b: undefined, c: '3' })
    expect(key).toBe('test:a=1,c=3')
  })

  test('produces correct format', () => {
    const key = makeCacheKey('search', { query: 'swift', type: 'doc' })
    expect(key).toBe('search:query=swift,type=doc')
  })
})

describe('cacheGet / cacheSet', () => {
  test('returns stored value', () => {
    cacheSet('test-get', 'hello', 60_000)
    expect(cacheGet('test-get')).toBe('hello')
  })

  test('returns undefined for missing key', () => {
    expect(cacheGet('nonexistent-key')).toBeUndefined()
  })

  test('returns undefined after TTL expires', async () => {
    cacheSet('test-ttl', 'value', 1) // 1ms TTL
    await Bun.sleep(10)
    expect(cacheGet('test-ttl')).toBeUndefined()
  })
})

describe('cacheGetOrSet', () => {
  test('calls fn on cache miss and stores result', async () => {
    let called = 0
    const result = await cacheGetOrSet(
      'test-miss',
      async () => {
        called++
        return 42
      },
      60_000,
    )
    expect(result).toBe(42)
    expect(called).toBe(1)
  })

  test('does not call fn on cache hit', async () => {
    cacheSet('test-hit', 'cached', 60_000)
    let called = 0
    const result = await cacheGetOrSet(
      'test-hit',
      async () => {
        called++
        return 'fresh'
      },
      60_000,
    )
    expect(result).toBe('cached')
    expect(called).toBe(0)
  })
})
