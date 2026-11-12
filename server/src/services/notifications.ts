import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { publishNotification } from '@/services/notification-bus'
import { countUnreadNotifications, insertNotification, listNotifications, markAllNotificationsRead, markNotificationRead } from '@/repositories/notifications.repository'

export type NotificationKind = 'mcp_key_ready' | 'comment_mention' | 'comment_reply' | 'task_comment' | 'task_assigned' | 'design_approved'

export async function notify(db: SQL, userId: string, kind: NotificationKind, link: string, data: Record<string, unknown> = {}): Promise<void> {
  const id = randomUUID()
  await insertNotification(db, { id, userId, kind, link, data })
  publishNotification(userId, { id, kind, link, data, readAt: null, createdAt: new Date().toISOString() })
}

export async function listNotificationsPage(db: SQL, userId: string, limit: number, cursor: CursorKeys | null) {
  const after = cursorValues(cursor, ['t', 'i'])
  const rows = await listNotifications(db, { userId, after: after ? { createdAt: after.t, id: after.i } : null, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ t: new Date(row.createdAt).toISOString(), i: row.id }))
  return { items: page.items, nextCursor: page.nextCursor, unreadCount: await countUnreadNotifications(db, userId) }
}

export async function readNotification(db: SQL, userId: string, notificationId: string): Promise<void> {
  if (!(await markNotificationRead(db, userId, notificationId))) throw new AppError('NOTIFICATION_NOT_FOUND')
}

export async function readAllNotifications(db: SQL, userId: string): Promise<void> {
  await markAllNotificationsRead(db, userId)
}
