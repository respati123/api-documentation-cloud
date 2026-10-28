import { createHash, randomBytes } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { AuthUser } from '@/models/workspace'
import type { RateLimiter } from '@/middleware/rate-limit'
import { deleteSession, findSessionUser, insertSession } from '@/repositories/sessions.repository'

export const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000

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

export async function createSession(db: SQL, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await insertSession(db, { tokenHash: tokenHash(token), userId, expiresAt: new Date(Date.now() + sessionLifetimeMs) })
  return token
}

export async function currentUser(db: SQL, request: Request): Promise<AuthUser> {
  const bearer = bearerToken(request)
  if (!bearer) throw new AppError('AUTH_REQUIRED')
  const user = await findSessionUser(db, tokenHash(bearer))
  if (!user) throw new AppError('SESSION_EXPIRED')
  return user
}

// Ends the session of the bearer token. A request without a token is not an error.
export async function endSession(db: SQL, request: Request): Promise<void> {
  const bearer = bearerToken(request)
  if (bearer) await deleteSession(db, tokenHash(bearer))
}
