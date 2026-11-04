import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { AuthUser } from '@/models/workspace'
import type { RateLimiter } from '@/middleware/rate-limit'
import { deleteSession, findSession, insertSession, type SessionClient } from '@/repositories/sessions.repository'

export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
export const sessionCookieName = 'apidocs_session'

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function clientAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export function enforceLimit(limiter: RateLimiter, key: string, limit: number, windowMs: number) {
  if (!limiter.hit(key, limit, windowMs)) throw new AppError('RATE_LIMITED')
}

export function bearerToken(request: Request): string | undefined {
  return request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
}

// The session cookie of a browser request, if it has one.
export function cookieToken(request: Request): string | undefined {
  const header = request.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === sessionCookieName && value.length) return value.join('=')
  }
  return undefined
}

// The desktop app sends a bearer token. The web portal sends its cookie. A bearer token wins when both are present.
function sessionToken(request: Request): string | undefined {
  return bearerToken(request) ?? cookieToken(request)
}

export function deviceLabel(request: Request): string {
  return (request.headers.get('user-agent') ?? '').slice(0, 120)
}

export async function createSession(db: SQL, userId: string, client: SessionClient, device: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await insertSession(db, { id: randomUUID(), tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + sessionLifetimeMs), client, device })
  return token
}

export async function currentSession(db: SQL, request: Request): Promise<{ user: AuthUser; sessionId: string }> {
  const token = sessionToken(request)
  if (!token) throw new AppError('AUTH_REQUIRED')
  const session = await findSession(db, tokenHash(token))
  if (!session) throw new AppError('SESSION_EXPIRED')
  return session
}

export async function currentUser(db: SQL, request: Request): Promise<AuthUser> {
  return (await currentSession(db, request)).user
}

// Ends the session of the token this request carries. A request without a token is not an error.
export async function endSession(db: SQL, request: Request): Promise<void> {
  const token = sessionToken(request)
  if (token) await deleteSession(db, tokenHash(token))
}

// A cookie is sent by the browser on its own, so a write made with only a cookie must come from a trusted origin.
// SameSite=Lax already blocks most cross-site writes. This check covers the rest, and refuses a request with no Origin.
export function refusesCookieWrite(request: Request, trustedOrigins: readonly string[]): boolean {
  if (bearerToken(request) || !cookieToken(request)) return false
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') return false
  const origin = request.headers.get('origin')
  return !origin || !trustedOrigins.includes(origin)
}

export function trustedOrigins(corsOrigins: readonly string[], publicWebUrl: string): string[] {
  try {
    return [...new Set([...corsOrigins, new URL(publicWebUrl).origin])]
  } catch {
    return [...corsOrigins]
  }
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(sessionLifetimeMs / 1000)}${secure ? '; Secure' : ''}`
}

export function clearedSessionCookie(secure: boolean): string {
  return `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`
}

export function isSecureOrigin(publicWebUrl: string): boolean {
  return publicWebUrl.startsWith('https:')
}
