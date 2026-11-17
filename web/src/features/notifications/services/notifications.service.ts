import * as z from 'zod/mini'
import { notificationListSchema } from '@/features/notifications/models/notification.model'
import { apiCall, apiPage } from '@/shared/services/api-client'

export const notificationsService = {
  // The menu shows the latest page only. Older notifications are not needed there.
  latest: async (token: string) => z.parse(notificationListSchema, (await apiPage('/api/me/notifications?limit=20', { token })).data),
  markRead: async (token: string, notificationId: string) =>
    apiCall(`/api/me/notifications/${encodeURIComponent(notificationId)}/read`, { token, method: 'POST' }),
  markAllRead: async (token: string) => apiCall('/api/me/notifications/read-all', { token, method: 'POST' }),
}
