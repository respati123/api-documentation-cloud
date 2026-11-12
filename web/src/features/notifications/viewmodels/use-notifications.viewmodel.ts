import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as z from 'zod/mini'
import { useAuthSessionStore } from '@/features/auth'
import {
  NOTIFICATION_KIND_TEXT,
  NOTIFICATIONS_TEXT,
  UNKNOWN_NOTIFICATION_TEXT,
} from '@/features/notifications/constants/notifications-text.constants'
import { type AppNotification, notificationCreatedSchema } from '@/features/notifications/models/notification.model'
import { notificationsService } from '@/features/notifications/services/notifications.service'
import { useRealtimeEvent } from '@/shared/realtime/use-realtime-event'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatRelativeDate } from '@/shared/utils/format'

const notificationKeys = { latest: ['notifications', 'latest'] as const }

// New notifications arrive over the app's socket and refresh the list at once. A slow poll covers a dropped socket.
// Opening a notification marks it read and follows its link.
export function useNotificationsViewModel(onOpenLink: (link: string) => void) {
  const { t, i18n } = useTranslation('notifications')
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const queryClient = useQueryClient()

  const latest = useQuery({
    queryKey: notificationKeys.latest,
    queryFn: () => notificationsService.latest(token),
    enabled: signedIn,
    refetchInterval: 5 * 60_000,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationKeys.latest })
  useRealtimeEvent((event) => {
    if (z.safeParse(notificationCreatedSchema, event).success) void refresh()
  })
  const markRead = useMutation({ mutationFn: (id: string) => notificationsService.markRead(token, id), onSuccess: refresh })
  const markAllRead = useMutation({ mutationFn: () => notificationsService.markAllRead(token), onSuccess: refresh })

  const describe = (notification: AppNotification) => {
    const key = NOTIFICATION_KIND_TEXT[notification.kind] ?? UNKNOWN_NOTIFICATION_TEXT
    const text = (name: string) => (typeof notification.data[name] === 'string' ? (notification.data[name] as string) : '')
    return t(key, { keyName: text('keyName'), actor: text('actor'), preview: text('preview'), title: text('title') })
  }

  return {
    unreadCount: latest.data?.unreadCount ?? 0,
    items: (latest.data?.notifications ?? []).map((notification) => ({
      id: notification.id,
      text: describe(notification),
      when: formatRelativeDate(notification.createdAt, i18n.language) ?? '',
      unread: notification.readAt === null,
    })),
    error: latest.error ? readErrorMessage(latest.error, t(NOTIFICATIONS_TEXT.error)) : null,
    onOpen: (id: string) => {
      const notification = latest.data?.notifications.find((item) => item.id === id)
      if (!notification) return
      if (notification.readAt === null) markRead.mutate(id)
      onOpenLink(notification.link)
    },
    onMarkAllRead: () => markAllRead.mutate(),
  }
}
