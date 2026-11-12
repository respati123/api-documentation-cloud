import * as z from 'zod/mini'

export const notificationSchema = z.object({
  id: z.string(),
  kind: z.string(),
  link: z.string(),
  data: z.record(z.string(), z.unknown()),
  readAt: z.nullable(z.string()),
  createdAt: z.string(),
})
export const notificationListSchema = z.object({ notifications: z.array(notificationSchema), unreadCount: z.number() })

export const notificationCreatedSchema = z.object({ type: z.literal('notification.created'), notification: notificationSchema })

export type AppNotification = z.infer<typeof notificationSchema>
export type NotificationList = z.infer<typeof notificationListSchema>
