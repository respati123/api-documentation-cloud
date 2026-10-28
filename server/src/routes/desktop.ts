import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { created } from '@/lib/http'
import { randomBytes } from 'node:crypto'
import { tokenHash } from '@/services/auth'


export async function handleDesktopApprove(ctx: AppContext, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { desktopLoginCodes } = ctx
  if (method === 'POST' && path === '/api/desktop-login/approve') {
    const now = Date.now()
    for (const [key, value] of desktopLoginCodes) if (value.expiresAt <= now) desktopLoginCodes.delete(key)
    const code = randomBytes(32).toString('base64url')
    desktopLoginCodes.set(tokenHash(code), { userId: user.id, expiresAt: now + 2 * 60_000 })
    return created({ code, expiresInSeconds: 120 })
  }
  return undefined
}
