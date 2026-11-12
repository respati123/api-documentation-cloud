import type { AppContext } from '@/context'
import { noContent, ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import type { AuthUser } from '@/models/workspace'
import { listNotificationsPage, readAllNotifications, readNotification } from '@/services/notifications'

export async function handleNotificationRoutes(ctx: AppContext, url: URL, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx

  if (method === 'GET' && path === '/api/me/notifications') {
    const page = await listNotificationsPage(db, user.id, readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ notifications: page.items, unreadCount: page.unreadCount }, { nextCursor: page.nextCursor })
  }

  if (method === 'POST' && path === '/api/me/notifications/read-all') {
    await readAllNotifications(db, user.id)
    return noContent()
  }

  const readMatch = path.match(/^\/api\/me\/notifications\/([\w-]+)\/read$/)
  if (method === 'POST' && readMatch) {
    await readNotification(db, user.id, readMatch[1])
    return noContent()
  }

  return undefined
}
