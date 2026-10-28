import { describe, expect, test } from 'bun:test'
import { RateLimiter } from './rate-limit'

function clock(start = 0) {
  let now = start
  return { now: () => now, advance: (ms: number) => { now += ms } }
}

describe('RateLimiter', () => {
  test('allows attempts up to the limit and rejects the next one', () => {
    const limiter = new RateLimiter(clock().now)
    expect([1, 2, 3].map(() => limiter.hit('login:a', 3, 60_000))).toEqual([true, true, true])
    expect(limiter.hit('login:a', 3, 60_000)).toBe(false)
  })

  test('keeps separate counters for separate keys', () => {
    const limiter = new RateLimiter(clock().now)
    limiter.hit('login:a', 1, 60_000)
    expect(limiter.hit('login:a', 1, 60_000)).toBe(false)
    expect(limiter.hit('login:b', 1, 60_000)).toBe(true)
  })

  test('opens a new window after the previous one expires', () => {
    const time = clock()
    const limiter = new RateLimiter(time.now)
    limiter.hit('forgot:a', 1, 60_000)
    expect(limiter.hit('forgot:a', 1, 60_000)).toBe(false)
    time.advance(60_000)
    expect(limiter.hit('forgot:a', 1, 60_000)).toBe(true)
  })
})
