import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNoticeStore } from '@/features/app-shell'
import { useAuthSessionStore } from '@/features/auth'
import { apiCall } from '@/shared/services/api-client'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'
import { parseSyncEvent, reconnectDelay, socketUrl } from '../utils/live-sync'
import { workspaceDetailKeys } from './workspace-detail.keys'

export type LiveStatus = 'connecting' | 'live' | 'offline'

// Keeps one socket open for the workspace page. A new commit refreshes the page and says who pushed it.
// Each connection uses a fresh ticket, because a ticket works once and expires after 30 seconds.
export function useWorkspaceLiveSync(workspaceId: string): LiveStatus {
  const { t } = useTranslation()
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const showNotice = useNoticeStore((state) => state.show)
  const [status, setStatus] = useState<LiveStatus>('connecting')

  useEffect(() => {
    if (!token || !workspaceId) return
    let disposed = false
    let socket: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0

    function scheduleReconnect() {
      if (disposed) return
      setStatus('offline')
      timer = setTimeout(() => void connect(), reconnectDelay(attempt))
      attempt += 1
    }

    async function connect() {
      setStatus('connecting')
      try {
        const { ticket } = await apiCall<{ ticket: string }>('/api/sync/events-ticket', { token, method: 'POST' })
        if (disposed) return
        const next = new WebSocket(socketUrl(import.meta.env.VITE_API_URL || '', window.location, ticket))
        socket = next
        next.onopen = () => {
          attempt = 0
          setStatus('live')
        }
        next.onmessage = (message) => {
          const event = parseSyncEvent(String(message.data))
          if (!event || event.workspaceId !== workspaceId) return
          void queryClient.invalidateQueries({ queryKey: workspaceDetailKeys.all })
          showNotice({ kind: 'info', message: t(WORKSPACE_TEXT.live.updated, { actor: event.actorEmail }) })
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
  }, [token, workspaceId, queryClient, showNotice, t])

  return status
}
