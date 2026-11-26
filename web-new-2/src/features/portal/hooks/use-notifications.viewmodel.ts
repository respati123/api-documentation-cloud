import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { portalService } from '../services/portal.service'
import { portalKeys } from './portal.keys'

export function useNotificationsViewModel(authenticated: boolean) {
  const queryClient = useQueryClient()
  const inbox = useQuery({
    queryKey: portalKeys.notifications,
    queryFn: portalService.notifications,
    enabled: authenticated,
    refetchInterval: 5 * 60_000,
  })
  const invalidateInbox = () => queryClient.invalidateQueries({ queryKey: portalKeys.notifications })
  const markRead = useMutation({
    mutationFn: portalService.markNotificationRead,
    onSuccess: invalidateInbox,
  })
  const markAllRead = useMutation({
    mutationFn: portalService.markAllNotificationsRead,
    onSuccess: invalidateInbox,
  })

  return { inbox, markRead, markAllRead }
}
