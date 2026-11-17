import { useEffect, useRef } from 'react'
import { subscribeRealtime } from '@/shared/realtime/realtime-bus'

// Calls the handler for every realtime message while the component is mounted. The latest handler is always used.
export function useRealtimeEvent(handler: (event: unknown) => void) {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => subscribeRealtime((event) => latest.current(event)), [])
}
