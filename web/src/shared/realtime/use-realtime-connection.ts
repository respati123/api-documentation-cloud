import { useEffect } from 'react'
import { emitRealtime, useRealtimeStatusStore } from '@/shared/realtime/realtime-bus'
import { reconnectDelay, socketUrl } from '@/shared/realtime/realtime-url'
import { apiCall } from '@/shared/services/api-client'

// Keeps one socket open for the whole signed-in app and hands each message to the subscribers.
// Each connection uses a fresh ticket, because a ticket works once and expires after 30 seconds.
export function useRealtimeConnection(signedIn: boolean) {
  const setStatus = useRealtimeStatusStore((state) => state.setStatus)

  useEffect(() => {
    if (!signedIn) {
      setStatus('idle')
      return
    }
    let disposed = false
    let socket: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0

    const scheduleReconnect = () => {
      if (disposed) return
      setStatus('offline')
      timer = setTimeout(() => void connect(), reconnectDelay(attempt))
      attempt += 1
    }

    async function connect() {
      setStatus('connecting')
      try {
        const { ticket } = await apiCall<{ ticket: string }>('/api/sync/events-ticket', { method: 'POST' })
        if (disposed) return
        const next = new WebSocket(socketUrl(import.meta.env.VITE_API_URL || '', window.location, ticket))
        socket = next
        next.onopen = () => {
          attempt = 0
          setStatus('live')
        }
        next.onmessage = (message) => {
          try {
            emitRealtime(JSON.parse(String(message.data)))
          } catch {
            // A message that is not JSON is not an event the portal understands.
          }
        }
        next.onclose = () => scheduleReconnect()
        next.onerror = () => next.close()
      } catch {
        scheduleReconnect()
      }
    }

    void connect()
    return () => {
      disposed = true
      clearTimeout(timer)
      socket?.close()
    }
  }, [signedIn, setStatus])
}
