import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { WORKSPACE_TEXT } from '@/features/workspace-detail/constants/workspace-detail-text.constants'
import { parseSyncEvent } from '@/features/workspace-detail/utils/live-sync'
import { workspaceDetailKeys } from '@/features/workspace-detail/viewmodels/workspace-detail.keys'
import { useRealtimeStatusStore } from '@/shared/realtime/realtime-bus'
import { useRealtimeEvent } from '@/shared/realtime/use-realtime-event'
import { showToast } from '@/shared/toast/toast-manager'

export type LiveStatus = 'connecting' | 'live' | 'offline'

// Listens on the app's shared socket for this workspace. A new commit refreshes the page and says who pushed it.
export function useWorkspaceLiveSync(workspaceId: string): LiveStatus {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const status = useRealtimeStatusStore((state) => state.status)

  useRealtimeEvent((raw) => {
    const event = parseSyncEvent(JSON.stringify(raw))
    if (!event || event.workspaceId !== workspaceId) return
    void queryClient.invalidateQueries({ queryKey: workspaceDetailKeys.all })
    if (event.type === 'workspace.updated')
      showToast({ kind: 'info', message: t(WORKSPACE_TEXT.live.updated, { actor: event.actorEmail }) })
  })

  return status === 'idle' ? 'connecting' : status
}
