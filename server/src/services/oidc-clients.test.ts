import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { findClient } from '@/repositories/oidc.repository'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { tokenHash } from '@/services/auth'
import { createOidcClient, isAllowedRedirectUri, rotateOidcClientSecret } from './oidc-clients'

describe('redirect URI rule', () => {
  test('accepts https addresses and local development addresses over http', () => {
    expect(isAllowedRedirectUri('https://dbdesign.respati.web.id/auth/callback')).toBe(true)
    expect(isAllowedRedirectUri('http://localhost:5173/auth/callback')).toBe(true)
    expect(isAllowedRedirectUri('http://127.0.0.1:4747/auth/callback')).toBe(true)
  })

  test('refuses plain http to other hosts, relative paths, and other schemes', () => {
    expect(isAllowedRedirectUri('http://app.test/auth/callback')).toBe(false)
    expect(isAllowedRedirectUri('/auth/callback')).toBe(false)
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false)
    expect(isAllowedRedirectUri('not a url')).toBe(false)
  })
})

describe.skipIf(!databaseEnabled)('OIDC client registration', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  function newId() {
    return `c-${randomUUID().slice(0, 8)}`
  }

  test('create stores only the hash of the secret and returns the secret once', async () => {
    const clientId = newId()
    const created = await createOidcClient(db, { clientId, name: 'DBDesign', redirectUris: ['https://dbdesign.respati.web.id/auth/callback'], postLogoutRedirectUris: ['https://dbdesign.respati.web.id/'] })
    expect(created.clientId).toBe(clientId)
    expect(created.secret.length).toBeGreaterThanOrEqual(43)

    const stored = await findClient(db, clientId)
    expect(stored?.secretHash).toBe(tokenHash(created.secret))
    expect(stored?.secretHash).not.toBe(created.secret)
  })

  test('create refuses an invalid client id and a plain http redirect', async () => {
    await expect(createOidcClient(db, { clientId: 'Bad Id', name: 'x', redirectUris: ['https://a.test/cb'], postLogoutRedirectUris: [] })).rejects.toMatchObject({ code: 'OIDC_REQUEST_INVALID' })
    await expect(createOidcClient(db, { clientId: newId(), name: 'x', redirectUris: ['http://app.test/cb'], postLogoutRedirectUris: [] })).rejects.toMatchObject({ code: 'OIDC_REDIRECT_URI_INVALID' })
  })

  test('rotate changes the stored hash and returns a new secret', async () => {
    const clientId = newId()
    const created = await createOidcClient(db, { clientId, name: 'Stitchkit', redirectUris: ['https://stitchkit.respati.web.id/auth/callback'], postLogoutRedirectUris: [] })
    const rotated = await rotateOidcClientSecret(db, clientId)
    expect(rotated).not.toBe(created.secret)
    expect((await findClient(db, clientId))?.secretHash).toBe(tokenHash(rotated))
  })

  test('rotate for an unknown client is refused', async () => {
    await expect(rotateOidcClientSecret(db, 'no-such-client')).rejects.toMatchObject({ code: 'OIDC_CLIENT_UNKNOWN' })
  })
})
