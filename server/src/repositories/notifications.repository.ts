import type { SQL } from 'bun'

export interface NotificationRow {
  id: string
  kind: string
  link: string
  data: Record<string, unknown>
  readAt: Date | null
  createdAt: Date
}

const columns = 'id, kind, link, data, read_at AS "readAt", created_at AS "createdAt"'

export async function insertNotification(db: SQL, input: { id: string; userId: string; kind: string; link: string; data: Record<string, unknown> }): Promise<void> {
  await db`INSERT INTO notifications (id, user_id, kind, link, data) VALUES (${input.id}, ${input.userId}, ${input.kind}, ${input.link}, (${JSON.stringify(input.data)}::text)::jsonb)`
}

export async function listNotifications(db: SQL, input: { userId: string; after: { createdAt: string; id: string } | null; limit: number }): Promise<NotificationRow[]> {
  if (input.after) {
    return db`SELECT ${db.unsafe(columns)} FROM notifications WHERE user_id = ${input.userId} AND (created_at, id) < (${input.after.createdAt}::timestamptz, ${input.after.id}) ORDER BY created_at DESC, id DESC LIMIT ${input.limit}`
  }
  return db`SELECT ${db.unsafe(columns)} FROM notifications WHERE user_id = ${input.userId} ORDER BY created_at DESC, id DESC LIMIT ${input.limit}`
}

export async function countUnreadNotifications(db: SQL, userId: string): Promise<number> {
  const [row] = await db`SELECT count(*)::int AS count FROM notifications WHERE user_id = ${userId} AND read_at IS NULL`
  return row.count
}

export async function markNotificationRead(db: SQL, userId: string, notificationId: string): Promise<boolean> {
  const rows = await db`UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = ${notificationId} AND user_id = ${userId} RETURNING id`
  return rows.length > 0
}

export async function markAllNotificationsRead(db: SQL, userId: string): Promise<void> {
  await db`UPDATE notifications SET read_at = now() WHERE user_id = ${userId} AND read_at IS NULL`
}

export async function listUnreadNotifications(db: SQL, userId: string, limit: number): Promise<NotificationRow[]> {
  return db`SELECT ${db.unsafe(columns)} FROM notifications WHERE user_id = ${userId} AND read_at IS NULL ORDER BY created_at DESC, id DESC LIMIT ${limit}`
}
