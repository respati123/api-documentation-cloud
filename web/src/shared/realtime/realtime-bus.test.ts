import { describe, expect, test, vi } from 'vitest'
import { emitRealtime, subscribeRealtime } from '@/shared/realtime/realtime-bus'

describe('realtime bus', () => {
  test('every subscriber hears an event until it unsubscribes', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = subscribeRealtime(first)
    const stopSecond = subscribeRealtime(second)

    emitRealtime({ type: 'planning.changed' })
    stopFirst()
    emitRealtime({ type: 'notification.created' })
    stopSecond()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
  })
})
