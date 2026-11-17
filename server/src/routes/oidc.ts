import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { noStoreHeaders, oidcJson } from '@/lib/oidc-http'
import { ok } from '@/lib/http'
import { isAdminUser } from '@/repositories/users.repository'
import { clearedSessionCookie, bearerToken, clientAddress, currentUser, endSession, enforceLimit, isSecureOrigin } from '@/services/auth'
import { approveAuthorization, discoveryDocument, endSessionRedirect, exchangeCode, userInfo, type AuthorizeInput, type OidcDeps } from '@/services/oidc'

const TOKEN_BODY_LIMIT_BYTES = 8 * 1024
const TOKEN_LIMIT = 60
const TOKEN_WINDOW_MS = 15 * 60_000

// The OpenID Connect endpoints. A route returns undefined when the method and path do not match.
export async function handleOidcRoutes(ctx: AppContext, request: Request, method: string, path: string): Promise<Response | undefined> {
  if (!path.startsWith('/api/oidc/')) return undefined

  if (!ctx.oidcKeys || !ctx.config.oidc) throw new AppError('OIDC_DISABLED')
  const deps: OidcDeps = {
    db: ctx.db,
    keys: ctx.oidcKeys,
    issuer: ctx.config.oidc.issuer,
    publicWebUrl: ctx.config.publicWebUrl.replace(/\/+$/, ''),
  }

  if (method === 'GET' && path === '/api/oidc/.well-known/openid-configuration') return oidcJson(200, discoveryDocument(deps))
  if (method === 'GET' && path === '/api/oidc/jwks') return oidcJson(200, await deps.keys.publicJwks(), { 'Cache-Control': 'public, max-age=300' })
  if (method === 'POST' && path === '/api/oidc/token') return tokenRoute(ctx, deps, request)
  if (method === 'GET' && path === '/api/oidc/userinfo') return userInfoRoute(deps, request)
  if (method === 'POST' && path === '/api/oidc/authorize') return authorizeRoute(ctx, deps, request)
  if (method === 'POST' && path === '/api/oidc/end-session') return endSessionRoute(ctx, deps, request)
  return undefined
}

async function tokenRoute(ctx: AppContext, deps: OidcDeps, request: Request): Promise<Response> {
  enforceLimit(ctx.limiter, `oidc-token:${clientAddress(request)}`, TOKEN_LIMIT, TOKEN_WINDOW_MS)
  const text = await request.text()
  if (text.length > TOKEN_BODY_LIMIT_BYTES) return oidcJson(400, { error: 'invalid_request', error_description: 'The request body is too large.' }, noStoreHeaders)
  const form = Object.fromEntries(new URLSearchParams(text))
  const result = await exchangeCode(deps, form)
  return oidcJson(result.status, result.body, noStoreHeaders)
}

async function userInfoRoute(deps: OidcDeps, request: Request): Promise<Response> {
  const token = bearerToken(request)
  if (!token) return oidcJson(401, { error: 'invalid_token' }, noStoreHeaders)
  const result = await userInfo(deps, token)
  return oidcJson(result.status, result.body, noStoreHeaders)
}

// Called by the portal's sign-in page after the user is signed in. The portal session comes from the cookie or a bearer token.
async function authorizeRoute(ctx: AppContext, deps: OidcDeps, request: Request): Promise<Response> {
  const user = await currentUser(ctx.db, request)
  const body = (await bodyOf(request)) as AuthorizeInput
  const isAdmin = await isAdminUser(ctx.db, user.id)
  const result = await approveAuthorization(deps, { id: user.id, email: user.email, isAdmin }, body)
  return ok(result)
}

// Called by the portal's sign-out page. It ends the portal session too, so the user is signed out everywhere in the portal.
async function endSessionRoute(ctx: AppContext, deps: OidcDeps, request: Request): Promise<Response> {
  const body = await bodyOf(request)
  const result = await endSessionRedirect(ctx.db, {
    clientId: typeof body.client_id === 'string' ? body.client_id : '',
    postLogoutRedirectUri: typeof body.post_logout_redirect_uri === 'string' ? body.post_logout_redirect_uri : undefined,
    state: typeof body.state === 'string' ? body.state : undefined,
  })
  await endSession(ctx.db, request)
  const response = ok(result)
  response.headers.append('Set-Cookie', clearedSessionCookie(isSecureOrigin(deps.publicWebUrl)))
  return response
}
