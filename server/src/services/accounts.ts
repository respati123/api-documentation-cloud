import { randomBytes, randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { createSession, sessionLifetimeMs, tokenHash } from '@/services/auth'
import { insertSession, type SessionClient } from '@/repositories/sessions.repository'
import { sendPasswordResetEmail } from '@/services/mail'
import { deleteSessionsForUser } from '@/repositories/sessions.repository'
import { deleteUnusedResets, insertReset, lockActiveReset, markResetUsed } from '@/repositories/password-resets.repository'
import { lockActiveUserInvite, markUserInviteUsed } from '@/repositories/user-invites.repository'
import { findUserByEmail, findUserById, insertUser, isAdminUser, setPasswordHash } from '@/repositories/users.repository'

export interface SessionResult {
  token: string
  user: { id: string; email: string; isAdmin?: boolean }
}

const resetLifetimeMs = 60 * 60_000

export async function registerAccount(db: SQL, email: string, password: string, inviteToken: string, session: { client: SessionClient; device: string }): Promise<SessionResult> {
  const id = randomUUID()
  const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' })
  const rawSessionToken = randomBytes(32).toString('base64url')
  const user = await db.begin(async (tx) => {
    const invite = await lockActiveUserInvite(tx, tokenHash(inviteToken))
    if (!invite || invite.email.toLowerCase() !== email.toLowerCase()) throw new AppError('INVITE_INVALID')
    if (!await insertUser(tx, { id, email: invite.email, passwordHash })) throw new AppError('EMAIL_TAKEN')
    await markUserInviteUsed(tx, invite.id)
    await insertSession(tx, { id: randomUUID(), tokenHash: tokenHash(rawSessionToken), userId: id, expiresAt: new Date(Date.now() + sessionLifetimeMs), client: session.client, device: session.device })
    return { id, email: invite.email }
  })
  return { token: rawSessionToken, user }
}

export async function loginAccount(db: SQL, email: string, password: string, session: { client: SessionClient; device: string }): Promise<SessionResult> {
  const account = await findUserByEmail(db, email)
  if (!account || !await Bun.password.verify(password, account.passwordHash)) throw new AppError('INVALID_CREDENTIALS')
  return { token: await createSession(db, account.id, session.client, session.device), user: { id: account.id, email: account.email, isAdmin: await isAdminUser(db, account.id) } }
}

// An unknown email gets the same answer as a known one, so the caller cannot tell which emails have accounts.
export async function requestPasswordReset(ctx: AppContext, email: string): Promise<void> {
  const account = await findUserByEmail(ctx.db, email)
  if (!account) return
  const rawToken = randomBytes(32).toString('base64url')
  await ctx.db.begin(async (tx) => {
    await deleteUnusedResets(tx, account.id)
    await insertReset(tx, { tokenHash: tokenHash(rawToken), userId: account.id, expiresAt: new Date(Date.now() + resetLifetimeMs) })
  })
  if (!ctx.config.smtp.host) {
    ctx.logger.warn('SMTP_HOST is not set. A password reset email was not sent.')
    return
  }
  try {
    await sendPasswordResetEmail(ctx.config, account.email, `${ctx.config.publicWebUrl}/reset-password?token=${encodeURIComponent(rawToken)}`)
  } catch (error) {
    ctx.logger.error('Password reset email delivery failed', { error })
  }
}

// Changing the password ends every session of the account, so a stolen session stops working.
export async function resetPassword(db: SQL, rawToken: string, password: string): Promise<void> {
  const passwordHash = await Bun.password.hash(password, { algorithm: 'argon2id' })
  const hash = tokenHash(rawToken)
  const reset = await db.begin(async (tx) => {
    const userId = await lockActiveReset(tx, hash)
    if (!userId) return false
    await setPasswordHash(tx, userId, passwordHash)
    await markResetUsed(tx, hash)
    await deleteSessionsForUser(tx, userId)
    return true
  })
  if (!reset) throw new AppError('RESET_TOKEN_INVALID')
}

// A desktop login code works once and expires after its own short lifetime.
export async function exchangeDesktopCode(ctx: AppContext, code: string, device: string): Promise<SessionResult> {
  const key = tokenHash(code)
  const entry = ctx.desktopLoginCodes.get(key)
  ctx.desktopLoginCodes.delete(key)
  if (!entry || entry.expiresAt <= Date.now()) throw new AppError('DESKTOP_CODE_INVALID')
  const user = await findUserById(ctx.db, entry.userId)
  if (!user) throw new AppError('ACCOUNT_NOT_FOUND')
  return { token: await createSession(ctx.db, user.id, 'desktop', device), user }
}
