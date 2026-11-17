import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { findUserById, isAdminUser } from '@/repositories/users.repository'
import {
  consumeAuthorizationCode,
  findClient,
  insertAuthorizationCode,
  type OidcClientRow,
} from '@/repositories/oidc.repository'
import { tokenHash } from '@/services/auth'
import type { OidcKeys, OidcUser } from './oidc-keys'

export interface OidcDeps {
  db: SQL
  keys: OidcKeys
  issuer: string
  publicWebUrl: string
}

export const ALLOWED_SCOPES = ['openid', 'email', 'profile'] as const
const CODE_LIFETIME_MS = 60_000
const ACCESS_TOKEN_SECONDS = 300
const PKCE_VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/
const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43,128}$/

export interface AuthorizeInput {
  response_type?: string
  client_id?: string
  redirect_uri?: string
  scope?: string
  state?: string
  nonce?: string
  code_challenge?: string
  code_challenge_method?: string
}

export type TokenForm = Record<string, string | undefined>

export interface TokenResult {
  status: number
  body: Record<string, unknown>
}

// The OpenID Connect discovery document. Clients read the endpoint addresses from here.
export function discoveryDocument(deps: OidcDeps) {
  return {
    issuer: deps.issuer,
    authorization_endpoint: `${deps.publicWebUrl}/oidc/authorize`,
    token_endpoint: `${deps.issuer}/token`,
    userinfo_endpoint: `${deps.issuer}/userinfo`,
    jwks_uri: `${deps.issuer}/jwks`,
    end_session_endpoint: `${deps.publicWebUrl}/oidc/logout`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['ES256'],
    scopes_supported: [...ALLOWED_SCOPES],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: ['sub', 'email', 'name', 'is_admin'],
  }
}

// Checks the request and makes a one-time code. Problems with the client or its redirect URI stop the flow here.
// Other problems send the error back to the registered redirect URI, as OAuth 2.0 asks.
export async function approveAuthorization(deps: OidcDeps, user: OidcUser, input: AuthorizeInput): Promise<{ redirectTo: string }> {
  const client = await requireActiveClient(deps.db, input.client_id)
  const redirectUri = input.redirect_uri ?? ''
  if (!client.redirectUris.includes(redirectUri)) throw new AppError('OIDC_REDIRECT_URI_INVALID')

  const problem = authorizeProblem(input)
  if (problem) return { redirectTo: errorRedirect(redirectUri, problem, input.state) }

  const code = randomBytes(32).toString('base64url')
  await insertAuthorizationCode(deps.db, {
    codeHash: tokenHash(code),
    clientId: client.clientId,
    userId: user.id,
    redirectUri,
    scope: normalizedScope(input.scope ?? ''),
    nonce: input.nonce ?? '',
    codeChallenge: input.code_challenge ?? '',
    expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
  })
  const url = new URL(redirectUri)
  url.searchParams.set('code', code)
  if (input.state) url.searchParams.set('state', input.state)
  return { redirectTo: url.toString() }
}

// Returns the first problem with the request values, or null when all of them are valid.
function authorizeProblem(input: AuthorizeInput): { error: string; description: string } | null {
  if (input.response_type !== 'code') return invalid('response_type must be code')
  if (!validScope(input.scope)) return invalid('scope must contain openid and only openid, email, or profile')
  if (!isText(input.state, 512)) return invalid('state is missing')
  if (!isText(input.nonce, 512)) return invalid('nonce is missing')
  if (!input.code_challenge || !PKCE_CHALLENGE.test(input.code_challenge)) return invalid('code_challenge is invalid')
  if (input.code_challenge_method !== 'S256') return invalid('code_challenge_method must be S256')
  return null
}

function invalid(description: string) {
  return { error: 'invalid_request', description }
}

function isText(value: string | undefined, max: number): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= max
}

function validScope(scope: string | undefined): boolean {
  if (!scope) return false
  const parts = scope.split(' ').filter(Boolean)
  return parts.includes('openid') && parts.every((part) => (ALLOWED_SCOPES as readonly string[]).includes(part))
}

function normalizedScope(scope: string): string {
  return scope.split(' ').filter(Boolean).join(' ')
}

function errorRedirect(redirectUri: string, problem: { error: string; description: string }, state?: string): string {
  const url = new URL(redirectUri)
  url.searchParams.set('error', problem.error)
  url.searchParams.set('error_description', problem.description)
  if (state) url.searchParams.set('state', state)
  return url.toString()
}

async function requireActiveClient(db: SQL, clientId: string | undefined): Promise<OidcClientRow> {
  const client = clientId ? await findClient(db, clientId) : null
  if (!client || client.disabled) throw new AppError('OIDC_CLIENT_UNKNOWN')
  return client
}

// The token endpoint. Errors use the OAuth 2.0 shape, so tools that speak OIDC understand them.
export async function exchangeCode(deps: OidcDeps, form: TokenForm): Promise<TokenResult> {
  if (form.grant_type !== 'authorization_code') return tokenError(400, 'unsupported_grant_type', 'Only authorization_code is supported.')

  const client = form.client_id ? await findClient(deps.db, form.client_id) : null
  if (!client || client.disabled || !secretMatches(form.client_secret ?? '', client.secretHash)) {
    return tokenError(401, 'invalid_client', 'The client or its secret is not valid.')
  }

  const row = form.code ? await consumeAuthorizationCode(deps.db, tokenHash(form.code)) : null
  if (!row || row.clientId !== client.clientId) return tokenError(400, 'invalid_grant', 'The code is invalid or expired.')
  if (row.redirectUri !== form.redirect_uri) return tokenError(400, 'invalid_grant', 'The redirect URI does not match the code.')
  if (!pkceMatches(form.code_verifier ?? '', row.codeChallenge)) return tokenError(400, 'invalid_grant', 'The code verifier does not match.')

  const user = await loadUser(deps.db, row.userId)
  if (!user) return tokenError(400, 'invalid_grant', 'The code is invalid or expired.')

  const idToken = await deps.keys.signIdToken({ user, clientId: client.clientId, nonce: row.nonce })
  const accessToken = await deps.keys.signAccessToken({ user, clientId: client.clientId, scope: row.scope })
  return {
    status: 200,
    body: { access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_SECONDS, id_token: idToken, scope: row.scope },
  }
}

function tokenError(status: number, error: string, description: string): TokenResult {
  return { status, body: { error, error_description: description } }
}

function secretMatches(secret: string, storedHash: string): boolean {
  const given = Buffer.from(tokenHash(secret))
  const stored = Buffer.from(storedHash)
  return given.length === stored.length && timingSafeEqual(given, stored)
}

async function loadUser(db: SQL, userId: string): Promise<OidcUser | null> {
  const user = await findUserById(db, userId)
  if (!user) return null
  return { id: user.id, email: user.email, isAdmin: await isAdminUser(db, user.id) }
}

// Checks an access token from the user info endpoint and returns the user's identity claims.
export async function userInfo(deps: OidcDeps, accessToken: string): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const claims = await deps.keys.verifyAccessToken(accessToken)
    const user = await loadUser(deps.db, claims.sub)
    if (!user) return { status: 401, body: { error: 'invalid_token' } }
    return { status: 200, body: { sub: user.id, email: user.email, name: user.email, is_admin: user.isAdmin } }
  } catch {
    return { status: 401, body: { error: 'invalid_token' } }
  }
}

// Sign-out target. Only a logout URI that was registered for this client is allowed.
export async function endSessionRedirect(db: SQL, input: { clientId: string; postLogoutRedirectUri?: string; state?: string }): Promise<{ redirectTo: string }> {
  const client = await requireActiveClient(db, input.clientId)
  const target = input.postLogoutRedirectUri ?? ''
  if (!client.postLogoutRedirectUris.includes(target)) throw new AppError('OIDC_REDIRECT_URI_INVALID')
  const url = new URL(target)
  if (input.state) url.searchParams.set('state', input.state)
  return { redirectTo: url.toString() }
}

// PKCE (RFC 7636) with the S256 method: the challenge is base64url(sha256(verifier)).
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!PKCE_VERIFIER.test(verifier)) return false
  return createHash('sha256').update(verifier).digest('base64url') === challenge
}
