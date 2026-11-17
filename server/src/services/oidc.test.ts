import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { exportPKCS8, generateKeyPair, importJWK, jwtVerify } from 'jose'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { insertClient } from '@/repositories/oidc.repository'
import { databaseEnabled, openTestDatabase, seedUser } from '@/testing/database'
import { tokenHash } from '@/services/auth'
import { createOidcKeys } from './oidc-keys'
import { approveAuthorization, endSessionRedirect, exchangeCode, pkceMatches, userInfo } from './oidc'

const publicWebUrl = 'https://docs.example.test'
const issuer = `${publicWebUrl}/api/oidc`
const redirectUri = 'https://app.test/auth/callback'
const logoutUri = 'https://app.test/'
const secret = 'client-secret-for-tests'

function challengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

describe.skipIf(!databaseEnabled)('OIDC service', () => {
  let db: SQL
  let deps: { db: SQL; keys: ReturnType<typeof createOidcKeys>; issuer: string; publicWebUrl: string }
  let clientId: string

  beforeAll(async () => {
    db = await openTestDatabase()
    const { privateKey } = await generateKeyPair('ES256', { extractable: true })
    const keys = createOidcKeys({ signingKeyPem: await exportPKCS8(privateKey), keyId: 'test-1', issuer })
    deps = { db, keys, issuer, publicWebUrl }
    clientId = `t-${randomUUID().slice(0, 8)}`
    await insertClient(db, { clientId, name: 'Test app', secretHash: tokenHash(secret), redirectUris: [redirectUri], postLogoutRedirectUris: [logoutUri] })
  })

  afterAll(async () => {
    await db.close()
  })

  function validRequest(overrides: Record<string, string | undefined> = {}) {
    const verifier = randomBytes(32).toString('base64url')
    const base: Record<string, string | undefined> = {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid email',
      state: 'state-1',
      nonce: 'nonce-1',
      code_challenge: challengeOf(verifier),
      code_challenge_method: 'S256',
    }
    return { request: { ...base, ...overrides }, verifier }
  }

  async function freshUser() {
    return seedUser(db)
  }

  async function codeFor(userId: string, overrides: Record<string, string | undefined> = {}) {
    const { request, verifier } = validRequest(overrides)
    const result = await approveAuthorization(deps, { id: userId, email: 'x@test.dev', isAdmin: false }, request)
    const code = new URL(result.redirectTo).searchParams.get('code') ?? ''
    return { code, verifier, redirectTo: result.redirectTo }
  }

  describe('approve', () => {
    test('returns the registered redirect URI with a code and the same state', async () => {
      const user = await freshUser()
      const { redirectTo } = await codeFor(user.id)
      const url = new URL(redirectTo)
      expect(`${url.origin}${url.pathname}`).toBe(redirectUri)
      expect(url.searchParams.get('code')).toBeTruthy()
      expect(url.searchParams.get('state')).toBe('state-1')
    })

    test('an unknown client is refused without a redirect', async () => {
      const user = await freshUser()
      const { request } = validRequest({ client_id: 'no-such-client' })
      await expect(approveAuthorization(deps, { id: user.id, email: user.email, isAdmin: false }, request)).rejects.toMatchObject({ code: 'OIDC_CLIENT_UNKNOWN' })
    })

    test('a redirect URI that is not registered is refused, including one that only shares a prefix', async () => {
      const user = await freshUser()
      for (const bad of ['https://app.test/auth/callback-evil', 'https://app.test/auth', 'https://evil.test/auth/callback']) {
        const { request } = validRequest({ redirect_uri: bad })
        await expect(approveAuthorization(deps, { id: user.id, email: user.email, isAdmin: false }, request)).rejects.toBeInstanceOf(AppError)
      }
    })

    test('a disabled client is refused like an unknown one', async () => {
      const disabledId = `t-${randomUUID().slice(0, 8)}`
      await insertClient(db, { clientId: disabledId, name: 'Off', secretHash: tokenHash(secret), redirectUris: [redirectUri], postLogoutRedirectUris: [] })
      await db`UPDATE oidc_clients SET disabled_at = now() WHERE client_id = ${disabledId}`
      const user = await freshUser()
      const { request } = validRequest({ client_id: disabledId })
      await expect(approveAuthorization(deps, { id: user.id, email: user.email, isAdmin: false }, request)).rejects.toMatchObject({ code: 'OIDC_CLIENT_UNKNOWN' })
    })

    test('a missing nonce, the plain PKCE method, or a scope outside the allowed list redirects with invalid_request', async () => {
      const user = await freshUser()
      const actor = { id: user.id, email: user.email, isAdmin: false }
      for (const overrides of [{ nonce: undefined }, { code_challenge_method: 'plain' }, { scope: 'openid admin' }]) {
        const { request } = validRequest(overrides)
        const result = await approveAuthorization(deps, actor, request)
        const url = new URL(result.redirectTo)
        expect(url.searchParams.get('error')).toBe('invalid_request')
        expect(url.searchParams.get('state')).toBe('state-1')
        expect(url.searchParams.get('code')).toBeNull()
      }
    })
  })

  describe('exchange', () => {
    test('a correct request returns an ID token and an access token', async () => {
      const user = await freshUser()
      const { code, verifier } = await codeFor(user.id)
      const result = await exchangeCode(deps, {
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: secret,
      })
      expect(result.status).toBe(200)
      const body = result.body as { id_token: string; access_token: string; token_type: string; expires_in: number }
      expect(body.token_type).toBe('Bearer')
      expect(body.expires_in).toBe(300)
      const jwks = await deps.keys.publicJwks()
      const key = await importJWK(jwks.keys[0]!, 'ES256')
      const { payload } = await jwtVerify(body.id_token, key, { issuer, audience: clientId, algorithms: ['ES256'] })
      expect(payload).toMatchObject({ sub: user.id, nonce: 'nonce-1' })
    })

    test('the same code cannot be used twice', async () => {
      const user = await freshUser()
      const { code, verifier } = await codeFor(user.id)
      const form = { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId, client_secret: secret }
      expect((await exchangeCode(deps, form)).status).toBe(200)
      expect(await exchangeCode(deps, form)).toMatchObject({ status: 400, body: { error: 'invalid_grant' } })
    })

    test('a wrong verifier, a different redirect URI, or an expired code is invalid_grant', async () => {
      const user = await freshUser()
      const first = await codeFor(user.id)
      const wrongVerifier = await exchangeCode(deps, {
        grant_type: 'authorization_code', code: first.code, code_verifier: randomBytes(32).toString('base64url'), redirect_uri: redirectUri, client_id: clientId, client_secret: secret,
      })
      expect(wrongVerifier).toMatchObject({ status: 400, body: { error: 'invalid_grant' } })

      const second = await codeFor(user.id)
      const wrongRedirect = await exchangeCode(deps, {
        grant_type: 'authorization_code', code: second.code, code_verifier: second.verifier, redirect_uri: 'https://app.test/other', client_id: clientId, client_secret: secret,
      })
      expect(wrongRedirect).toMatchObject({ status: 400, body: { error: 'invalid_grant' } })

      const expiredCode = `expired-${randomUUID()}`
      await db`INSERT INTO oidc_authorization_codes (code_hash, client_id, user_id, redirect_uri, scope, nonce, code_challenge, expires_at)
        VALUES (${tokenHash(expiredCode)}, ${clientId}, ${user.id}, ${redirectUri}, 'openid', 'n', 'c', now() - interval '1 second')`
      const expired = await exchangeCode(deps, {
        grant_type: 'authorization_code', code: expiredCode, code_verifier: randomBytes(32).toString('base64url'), redirect_uri: redirectUri, client_id: clientId, client_secret: secret,
      })
      expect(expired).toMatchObject({ status: 400, body: { error: 'invalid_grant' } })
    })

    test('a wrong secret or an unknown client is invalid_client with status 401', async () => {
      const user = await freshUser()
      const { code, verifier } = await codeFor(user.id)
      const base = { grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri }
      expect(await exchangeCode(deps, { ...base, client_id: clientId, client_secret: 'wrong' })).toMatchObject({ status: 401, body: { error: 'invalid_client' } })
      expect(await exchangeCode(deps, { ...base, client_id: 'no-such-client', client_secret: secret })).toMatchObject({ status: 401, body: { error: 'invalid_client' } })
    })

    test('a grant type other than authorization_code is refused', async () => {
      expect(await exchangeCode(deps, { grant_type: 'password', client_id: clientId, client_secret: secret })).toMatchObject({
        status: 400,
        body: { error: 'unsupported_grant_type' },
      })
    })
  })

  describe('user info', () => {
    test('a valid access token returns the user, and a foreign token is refused', async () => {
      const user = await freshUser()
      const { code, verifier } = await codeFor(user.id)
      const issued = await exchangeCode(deps, {
        grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId, client_secret: secret,
      })
      const accessToken = (issued.body as { access_token: string }).access_token
      const ok = await userInfo(deps, accessToken)
      expect(ok).toMatchObject({ status: 200, body: { sub: user.id, email: user.email } })

      expect(await userInfo(deps, 'not-a-token')).toMatchObject({ status: 401, body: { error: 'invalid_token' } })
    })
  })

  describe('end session', () => {
    test('a registered logout URI is returned with the state', () => {
      return endSessionRedirect(db, { clientId, postLogoutRedirectUri: logoutUri, state: 'bye' }).then((result) => {
        const url = new URL(result.redirectTo)
        expect(`${url.origin}${url.pathname}`).toBe(logoutUri)
        expect(url.searchParams.get('state')).toBe('bye')
      })
    })

    test('an unregistered logout URI is refused', async () => {
      await expect(endSessionRedirect(db, { clientId, postLogoutRedirectUri: 'https://evil.test/', state: 'x' })).rejects.toMatchObject({
        code: 'OIDC_REDIRECT_URI_INVALID',
      })
    })
  })

  test('the PKCE check accepts the matching verifier and rejects another one', () => {
    const verifier = randomBytes(32).toString('base64url')
    expect(pkceMatches(verifier, challengeOf(verifier))).toBe(true)
    expect(pkceMatches(randomBytes(32).toString('base64url'), challengeOf(verifier))).toBe(false)
    expect(pkceMatches('short', challengeOf('short'))).toBe(false)
  })
})
