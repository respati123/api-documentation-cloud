import { describe, expect, test } from 'bun:test'
import { exportPKCS8, generateKeyPair, importJWK, importPKCS8, jwtVerify, SignJWT } from 'jose'
import { createOidcKeys } from './oidc-keys'

const issuer = 'https://docs.example.test/api/oidc'

async function testPem(): Promise<string> {
  const { privateKey } = await generateKeyPair('ES256', { extractable: true })
  return exportPKCS8(privateKey)
}

const user = { id: 'user-1', email: 'ana@example.test', isAdmin: false }

describe('OIDC keys', () => {
  test('the published key set has one ES256 signing key and no private part', async () => {
    const keys = createOidcKeys({ signingKeyPem: await testPem(), keyId: '2026-11', issuer })
    const jwks = await keys.publicJwks()
    expect(jwks.keys).toHaveLength(1)
    const [key] = jwks.keys
    expect(key).toMatchObject({ kid: '2026-11', alg: 'ES256', use: 'sig', kty: 'EC', crv: 'P-256' })
    expect(key).not.toHaveProperty('d')
  })

  test('an ID token verifies with the published key and carries the expected claims', async () => {
    const keys = createOidcKeys({ signingKeyPem: await testPem(), keyId: '2026-11', issuer })
    const token = await keys.signIdToken({ user, clientId: 'dbdesign', nonce: 'n-123' })
    const publicKey = await importJWK((await keys.publicJwks()).keys[0]!, 'ES256')
    const { payload, protectedHeader } = await jwtVerify(token, publicKey, { issuer, audience: 'dbdesign', algorithms: ['ES256'] })

    expect(protectedHeader.kid).toBe('2026-11')
    expect(payload).toMatchObject({ sub: 'user-1', email: 'ana@example.test', nonce: 'n-123', is_admin: false })
    const lifetime = (payload.exp ?? 0) - (payload.iat ?? 0)
    expect(lifetime).toBe(5 * 60)
  })

  test('an access token is accepted only for the user info endpoint', async () => {
    const pem = await testPem()
    const keys = createOidcKeys({ signingKeyPem: pem, keyId: '2026-11', issuer })
    const token = await keys.signAccessToken({ user, clientId: 'dbdesign', scope: 'openid email' })
    const claims = await keys.verifyAccessToken(token)
    expect(claims.sub).toBe('user-1')
    expect(claims.client_id).toBe('dbdesign')

    const otherAudience = await new SignJWT({ sub: 'user-1' })
      .setProtectedHeader({ alg: 'ES256', kid: '2026-11' })
      .setIssuer(issuer)
      .setAudience('https://docs.example.test/api/mcp')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(await importPKCS8(pem, 'ES256'))
    await expect(keys.verifyAccessToken(otherAudience)).rejects.toThrow()
  })

  test('a token signed by another key is refused', async () => {
    const ours = createOidcKeys({ signingKeyPem: await testPem(), keyId: '2026-11', issuer })
    const theirs = createOidcKeys({ signingKeyPem: await testPem(), keyId: '2026-11', issuer })
    const foreign = await theirs.signAccessToken({ user, clientId: 'dbdesign', scope: 'openid' })
    await expect(ours.verifyAccessToken(foreign)).rejects.toThrow()
  })
})
