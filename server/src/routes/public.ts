import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { clientAddress, currentUser, endSession, enforceLimit } from '@/services/auth'
import { created, noContent, ok } from '@/lib/http'
import { exchangeDesktopCode, loginAccount, registerAccount, requestPasswordReset, resetPassword } from '@/services/accounts'

export async function handlePublicRoutes(ctx: AppContext, request: Request, method: string, path: string): Promise<Response | undefined> {
  const { db, limiter } = ctx
  if (method === 'POST' && path === '/api/auth/register') {
    enforceLimit(limiter, `register:${clientAddress(request)}`, 10, 60 * 60_000)
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AppError('EMAIL_INVALID')
    if (password.length < 10 || password.length > 256) throw new AppError('PASSWORD_LENGTH_INVALID')
    return created(await registerAccount(db, email, password))
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    enforceLimit(limiter, `login:${clientAddress(request)}`, 30, 15 * 60_000)
    if (email) enforceLimit(limiter, `login-email:${email}`, 10, 15 * 60_000)
    return ok(await loginAccount(db, email, password))
  }

  if (method === 'POST' && path === '/api/auth/forgot-password') {
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    enforceLimit(limiter, `forgot-ip:${clientAddress(request)}`, 10, 60 * 60_000)
    if (email) enforceLimit(limiter, `forgot-email:${email}`, 3, 60 * 60_000)
    await requestPasswordReset(ctx, email)
    return noContent()
  }

  if (method === 'POST' && path === '/api/auth/reset-password') {
    enforceLimit(limiter, `reset-ip:${clientAddress(request)}`, 20, 15 * 60_000)
    const body = await bodyOf(request)
    const rawToken = typeof body.token === 'string' ? body.token.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 10 || password.length > 256) throw new AppError('PASSWORD_LENGTH_INVALID')
    await resetPassword(db, rawToken, password)
    return noContent()
  }

  if (method === 'GET' && path === '/api/me') return ok({ user: await currentUser(db, request) })

  if (method === 'POST' && path === '/api/desktop-login/exchange') {
    const body = await bodyOf(request)
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!code) throw new AppError('DESKTOP_CODE_REQUIRED')
    return ok(await exchangeDesktopCode(ctx, code))
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    await endSession(db, request)
    return noContent()
  }
  return undefined
}
