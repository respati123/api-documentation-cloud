import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { clientAddress, createSession, currentUser, enforceLimit, tokenHash } from '@/services/auth'
import { created, noContent, ok } from '@/lib/http'
import { isRecord } from '@/lib/validation'
import { randomBytes, randomUUID } from 'node:crypto'
import { sendPasswordResetEmail } from '@/services/mail'


export async function handlePublicRoutes(ctx: AppContext, request: Request, method: string, path: string): Promise<Response | undefined> {
  const { db, config, logger, limiter, desktopLoginCodes } = ctx
  if (method === 'POST' && path === '/api/auth/register') {
    enforceLimit(limiter, `register:${clientAddress(request)}`, 10, 60 * 60_000)
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AppError('EMAIL_INVALID')
    if (password.length < 10 || password.length > 256) throw new AppError('PASSWORD_LENGTH_INVALID')
    const id = randomUUID()
    try {
      const hash = await Bun.password.hash(password, { algorithm: 'argon2id' })
      await db`INSERT INTO users (id, email, password_hash) VALUES (${id}, ${email}, ${hash})`
    } catch (error) {
      if (isRecord(error) && error.code === '23505') throw new AppError('EMAIL_TAKEN')
      throw error
    }
    const token = await createSession(db, id)
    return created({ token, user: { id, email } })
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    enforceLimit(limiter, `login:${clientAddress(request)}`, 30, 15 * 60_000)
    if (email) enforceLimit(limiter, `login-email:${email}`, 10, 15 * 60_000)
    const [user] = await db`SELECT id, email, password_hash FROM users WHERE email = ${email}`
    if (!user || !await Bun.password.verify(password, user.password_hash)) throw new AppError('INVALID_CREDENTIALS')
    const token = await createSession(db, user.id)
    return ok({ token, user: { id: user.id, email: user.email } })
  }

  if (method === 'POST' && path === '/api/auth/forgot-password') {
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    enforceLimit(limiter, `forgot-ip:${clientAddress(request)}`, 10, 60 * 60_000)
    if (email) enforceLimit(limiter, `forgot-email:${email}`, 3, 60 * 60_000)
    const [account] = await db`SELECT id, email FROM users WHERE email = ${email}`
    if (account) {
      const rawToken = randomBytes(32).toString('base64url')
      await db.begin(async (tx) => {
        await tx`DELETE FROM password_resets WHERE user_id = ${account.id} AND used_at IS NULL`
        await tx`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (${tokenHash(rawToken)}, ${account.id}, ${new Date(Date.now() + 60 * 60_000)})`
      })
      if (!config.smtp.host) logger.warn('SMTP_HOST is not set. A password reset email was not sent.')
      else {
        try { await sendPasswordResetEmail(config, account.email, `${config.publicWebUrl}/reset-password?token=${encodeURIComponent(rawToken)}`) }
        catch (error) { logger.error('Password reset email delivery failed', { error }) }
      }
    }
    return noContent()
  }

  if (method === 'POST' && path === '/api/auth/reset-password') {
    enforceLimit(limiter, `reset-ip:${clientAddress(request)}`, 20, 15 * 60_000)
    const body = await bodyOf(request)
    const rawToken = typeof body.token === 'string' ? body.token.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 10 || password.length > 256) throw new AppError('PASSWORD_LENGTH_INVALID')
    const hash = await Bun.password.hash(password, { algorithm: 'argon2id' })
    const reset = await db.begin(async (tx) => {
      const [row] = await tx`SELECT user_id FROM password_resets WHERE token_hash = ${tokenHash(rawToken)} AND used_at IS NULL AND expires_at > now() FOR UPDATE`
      if (!row) return false
      await tx`UPDATE users SET password_hash = ${hash} WHERE id = ${row.user_id}`
      await tx`UPDATE password_resets SET used_at = now() WHERE token_hash = ${tokenHash(rawToken)}`
      await tx`DELETE FROM sessions WHERE user_id = ${row.user_id}`
      return true
    })
    if (!reset) throw new AppError('RESET_TOKEN_INVALID')
    return noContent()
  }

  if (method === 'GET' && path === '/api/me') return ok({ user: await currentUser(db, request) })

  if (method === 'POST' && path === '/api/desktop-login/exchange') {
    const body = await bodyOf(request)
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!code) throw new AppError('DESKTOP_CODE_REQUIRED')
    const key = tokenHash(code)
    const entry = desktopLoginCodes.get(key)
    desktopLoginCodes.delete(key)
    if (!entry || entry.expiresAt <= Date.now()) throw new AppError('DESKTOP_CODE_INVALID')
    const [matchedUser] = await db`SELECT id, email FROM users WHERE id = ${entry.userId}`
    if (!matchedUser) throw new AppError('ACCOUNT_NOT_FOUND')
    const token = await createSession(db, entry.userId)
    return ok({ token, user: { id: matchedUser.id, email: matchedUser.email } })
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (bearer) await db`DELETE FROM sessions WHERE token_hash = ${tokenHash(bearer)}`
    return noContent()
  }
  return undefined
}
