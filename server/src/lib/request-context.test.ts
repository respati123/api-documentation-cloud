import { describe, expect, test } from 'bun:test'
import { currentRequestId, runWithRequestId } from './request-context'

describe('request context', () => {
  test('exposes the request id inside the run', async () => {
    const seen = await runWithRequestId('req-1', async () => currentRequestId())
    expect(seen).toBe('req-1')
  })

  test('keeps concurrent requests apart', async () => {
    const [first, second] = await Promise.all([
      runWithRequestId('a', async () => { await Bun.sleep(5); return currentRequestId() }),
      runWithRequestId('b', async () => currentRequestId()),
    ])
    expect([first, second]).toEqual(['a', 'b'])
  })

  test('is empty outside a request', () => {
    expect(currentRequestId()).toBe('')
  })
})
