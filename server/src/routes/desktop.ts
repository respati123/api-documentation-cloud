import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { created } from '@/lib/http'
import { randomBytes } from 'node:crypto'
import { isRecord } from '@/lib/validation'
import { createSession, tokenHash } from '@/services/auth'
import { checkDesktopKey, sealForDesktop } from '@/services/desktop-box'

// An approval request may carry no body, as older desktop builds send it.
async function optionalBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return isRecord(body) ? body : {}
  } catch {
    return {}
  }
}

// Approves a desktop sign-in. With a public key from the desktop app, the answer is a sealed session box that only that app can open.
// Without one, the older one-time code is returned, for desktop builds that predate the box.
export async function handleDesktopApprove(ctx: AppContext, request: Request, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { desktopLoginCodes } = ctx
  if (method === 'POST' && path === '/api/desktop-login/approve') {
    const body = await optionalBody(request)
    if (typeof body.publicKey === 'string') {
      checkDesktopKey(body.publicKey)
      const device = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 120) : ''
      const token = await createSession(ctx.db, user.id, 'desktop', device || 'Desktop app')
      return created({ box: sealForDesktop(body.publicKey, token) })
    }
    const now = Date.now()
    for (const [key, value] of desktopLoginCodes) if (value.expiresAt <= now) desktopLoginCodes.delete(key)
    const code = randomBytes(32).toString('base64url')
    desktopLoginCodes.set(tokenHash(code), { userId: user.id, expiresAt: now + 2 * 60_000 })
    return created({ code, expiresInSeconds: 120 })
  }
  return undefined
}
