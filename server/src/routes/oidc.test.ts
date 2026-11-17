import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { exportPKCS8, generateKeyPair } from 'jose'
import type { SQL } from 'bun'
import { insertClient } from '@/repositories/oidc.repository'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp } from '@/testing/http'
import { tokenHash } from '@/services/auth'

const redirectUri = 'https://app.test/auth/callback'
const logoutUri = 'https://app.test/'
const secret = 'route-test-secret'

function challengeOf(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// The OIDC routes read their key from the environment when the app is built. Each block sets the variables it needs.
async function withOidcEnv<T>(enabled: boolean, run: () => Promise<T>): Promise<T> {
  const before = { key: process.env.OIDC_SIGNING_KEY_B64, id: process.env.OIDC_SIGNING_KEY_ID }
  if (enabled) {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true })
    process.env.OIDC_SIGNING_KEY_B64 = Buffer.from(await exportPKCS8(privateKey)).toString('base64')
    process.env.OIDC_SIGNING_KEY_ID = 'route-test'
  } else {
    delete process.env.OIDC_SIGNING_KEY_B64
    delete process.env.OIDC_SIGNING_KEY_ID
  }
  try {
    return await run()
  } finally {
    if (before.key === undefined) delete process.env.OIDC_SIGNING_KEY_B64
    else process.env.OIDC_SIGNING_KEY_B64 = before.key
    if (before.id === undefined) delete process.env.OIDC_SIGNING_KEY_ID
    else process.env.OIDC_SIGNING_KEY_ID = before.id
  }
}

describe.skipIf(!databaseEnabled)('OIDC routes', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let clientId: string

  beforeAll(async () => {
    db = await openTestDatabase()
    http = await withOidcEnv(true, async () => createTestHttp(db, process.env.TEST_DATABASE_URL ?? ''))
    clientId = `r-${randomUUID().slice(0, 8)}`
    await insertClient(db, { clientId, name: 'Route test', secretHash: tokenHash(secret), redirectUris: [redirectUri], postLogoutRedirectUris: [logoutUri] })
  })

  afterAll(async () => {
    await db.close()
  })

  test('the discovery document is plain JSON, with no code or data wrapper', async () => {
    const response = await http.call('GET', '/api/oidc/.well-known/openid-configuration')
    expect(response.status).toBe(200)
    expect(response.json.code).toBeUndefined()
    expect(response.json.issuer).toBe(`${process.env.PUBLIC_WEB_URL}/api/oidc`)
    expect(response.json.token_endpoint).toBe(`${process.env.PUBLIC_WEB_URL}/api/oidc/token`)
    expect(response.json.authorization_endpoint).toBe(`${process.env.PUBLIC_WEB_URL}/oidc/authorize`)
    expect(response.json.id_token_signing_alg_values_supported).toEqual(['ES256'])
  })

  test('the key set publishes one public key and no private part', async () => {
    const response = await http.call('GET', '/api/oidc/jwks')
    const keys = response.json.keys as Array<Record<string, unknown>>
    expect(keys).toHaveLength(1)
    expect(keys[0]).toMatchObject({ kid: 'route-test', alg: 'ES256', use: 'sig' })
    expect(keys[0]).not.toHaveProperty('d')
  })

  test('the authorization endpoint needs a signed-in user', async () => {
    const response = await http.call('POST', '/api/oidc/authorize', {
      body: { response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: 'openid', state: 's', nonce: 'n', code_challenge: challengeOf('v'.repeat(43)), code_challenge_method: 'S256' },
    })
    expect(response.status).toBe(401)
  })

  test('a signed-in user gets a code, which the token endpoint exchanges for tokens', async () => {
    const account = await http.signUp('oidc-route')
    const verifier = randomBytes(32).toString('base64url')
    const authorized = await http.call('POST', '/api/oidc/authorize', {
      token: account.token,
      body: { response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: 'openid email', state: 'st-1', nonce: 'nn-1', code_challenge: challengeOf(verifier), code_challenge_method: 'S256' },
    })
    expect(authorized.status).toBe(200)
    const redirectTo = new URL((authorized.json.data as { redirectTo: string }).redirectTo)
    expect(redirectTo.searchParams.get('state')).toBe('st-1')

    const token = await http.call('POST', '/api/oidc/token', {
      form: { grant_type: 'authorization_code', code: redirectTo.searchParams.get('code') ?? '', code_verifier: verifier, redirect_uri: redirectUri, client_id: clientId, client_secret: secret },
    })
    expect(token.status).toBe(200)
    expect(token.json.token_type).toBe('Bearer')
    expect(typeof token.json.id_token).toBe('string')
    expect(typeof token.json.access_token).toBe('string')

    const info = await http.call('GET', '/api/oidc/userinfo', { token: token.json.access_token as string })
    expect(info.status).toBe(200)
    expect(info.json).toMatchObject({ sub: account.user.id, email: account.user.email })
  })

  test('a session cookie alone may approve only from a trusted origin', async () => {
    const account = await http.signUp('oidc-csrf')
    const verifier = randomBytes(32).toString('base64url')
    const body = { response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope: 'openid', state: 'c', nonce: 'c', code_challenge: challengeOf(verifier), code_challenge_method: 'S256' }
    const cookie = `apidocs_session=${account.token}`
    const foreign = await http.call('POST', '/api/oidc/authorize', { body, headers: { Cookie: cookie, Origin: 'https://evil.test' } })
    expect(foreign.status).toBe(403)
    expect(foreign.json.code).toBe('CSRF_ORIGIN_REFUSED')

    const own = await http.call('POST', '/api/oidc/authorize', { body, headers: { Cookie: cookie, Origin: process.env.PUBLIC_WEB_URL ?? '' } })
    expect(own.status).toBe(200)
  })

  test('the token endpoint answers in OAuth error form and says it does not cache', async () => {
    const response = await http.call('POST', '/api/oidc/token', { form: { grant_type: 'password' } })
    expect(response.status).toBe(400)
    expect(response.json).toEqual({ error: 'unsupported_grant_type', error_description: expect.any(String) })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  test('user info refuses a missing or made-up token', async () => {
    const response = await http.call('GET', '/api/oidc/userinfo', { token: 'made-up' })
    expect(response.status).toBe(401)
    expect(response.json.error).toBe('invalid_token')
  })

  test('the logout endpoint returns only a registered logout address', async () => {
    const good = await http.call('POST', '/api/oidc/end-session', { body: { client_id: clientId, post_logout_redirect_uri: logoutUri, state: 'bye' } })
    expect(good.status).toBe(200)
    expect(String((good.json.data as { redirectTo: string }).redirectTo)).toContain('state=bye')

    const bad = await http.call('POST', '/api/oidc/end-session', { body: { client_id: clientId, post_logout_redirect_uri: 'https://evil.test/' } })
    expect(bad.status).toBe(400)
    expect(bad.json.code).toBeDefined()
  })
})

describe.skipIf(!databaseEnabled)('OIDC routes when no key is configured', () => {
  test('every OIDC route answers OIDC_DISABLED', async () => {
    const db = await openTestDatabase()
    try {
      const http = await withOidcEnv(false, async () => createTestHttp(db, process.env.TEST_DATABASE_URL ?? ''))
      const response = await http.call('GET', '/api/oidc/.well-known/openid-configuration')
      expect(response.status).toBe(404)
      expect(response.json.code).toBe('OIDC_DISABLED')
    } finally {
      await db.close()
    }
  })
})
