import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase, seedUser } from '@/testing/database'
import {
  consumeAuthorizationCode,
  deleteExpiredCodes,
  findClient,
  insertAuthorizationCode,
  insertClient,
  listClients,
  setClientDisabled,
  updateClientSecret,
} from './oidc.repository'

function newClientId(): string {
  return `t-${randomUUID().slice(0, 8)}`
}

describe.skipIf(!databaseEnabled)('oidc repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  async function makeClient(): Promise<string> {
    const clientId = newClientId()
    await insertClient(db, {
      clientId,
      name: 'Test app',
      secretHash: 'hash-1',
      redirectUris: ['https://app.test/auth/callback'],
      postLogoutRedirectUris: ['https://app.test/'],
    })
    return clientId
  }

  test('finds a stored client with its URIs and reports it as enabled', async () => {
    const clientId = await makeClient()
    const client = await findClient(db, clientId)
    expect(client).toMatchObject({
      clientId,
      name: 'Test app',
      secretHash: 'hash-1',
      redirectUris: ['https://app.test/auth/callback'],
      postLogoutRedirectUris: ['https://app.test/'],
      disabled: false,
    })
  })

  test('returns null for an unknown client', async () => {
    expect(await findClient(db, 'no-such-client')).toBeNull()
  })

  test('listClients never returns the secret hash', async () => {
    const clientId = await makeClient()
    const list = await listClients(db)
    const mine = list.find((client) => client.clientId === clientId)
    expect(mine).toBeDefined()
    expect(mine).not.toHaveProperty('secretHash')
  })

  test('rotates the secret hash and can disable and enable a client', async () => {
    const clientId = await makeClient()
    expect(await updateClientSecret(db, clientId, 'hash-2')).toBe(true)
    expect((await findClient(db, clientId))?.secretHash).toBe('hash-2')

    await setClientDisabled(db, clientId, true)
    expect((await findClient(db, clientId))?.disabled).toBe(true)
    await setClientDisabled(db, clientId, false)
    expect((await findClient(db, clientId))?.disabled).toBe(false)
  })

  test('a code can be consumed only once', async () => {
    const clientId = await makeClient()
    const user = await seedUser(db)
    const codeHash = `code-${randomUUID()}`
    await insertAuthorizationCode(db, {
      codeHash,
      clientId,
      userId: user.id,
      redirectUri: 'https://app.test/auth/callback',
      scope: 'openid email',
      nonce: 'n-1',
      codeChallenge: 'challenge-1',
      expiresAt: new Date(Date.now() + 60_000),
    })

    const first = await consumeAuthorizationCode(db, codeHash)
    expect(first).toMatchObject({ clientId, userId: user.id, nonce: 'n-1', codeChallenge: 'challenge-1', redirectUri: 'https://app.test/auth/callback', scope: 'openid email' })
    expect(await consumeAuthorizationCode(db, codeHash)).toBeNull()
  })

  test('an expired code cannot be consumed', async () => {
    const clientId = await makeClient()
    const user = await seedUser(db)
    const codeHash = `code-${randomUUID()}`
    await insertAuthorizationCode(db, {
      codeHash,
      clientId,
      userId: user.id,
      redirectUri: 'https://app.test/auth/callback',
      scope: 'openid',
      nonce: 'n-2',
      codeChallenge: 'challenge-2',
      expiresAt: new Date(Date.now() - 1_000),
    })
    expect(await consumeAuthorizationCode(db, codeHash)).toBeNull()
  })

  test('deleteExpiredCodes removes codes that expired before the cutoff', async () => {
    const clientId = await makeClient()
    const user = await seedUser(db)
    const codeHash = `code-${randomUUID()}`
    await insertAuthorizationCode(db, {
      codeHash,
      clientId,
      userId: user.id,
      redirectUri: 'https://app.test/auth/callback',
      scope: 'openid',
      nonce: 'n-3',
      codeChallenge: 'challenge-3',
      expiresAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
    })
    await deleteExpiredCodes(db, new Date(Date.now() - 24 * 3600 * 1000))
    const rows = await db`SELECT 1 FROM oidc_authorization_codes WHERE code_hash = ${codeHash}`
    expect(rows.length).toBe(0)
  })
})
