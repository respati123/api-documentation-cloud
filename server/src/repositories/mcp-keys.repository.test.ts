import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { findMcpKeyAuth, insertMcpKeyWithinLimit, listAllMcpKeys, listUserMcpKeys, revokeMcpKeyWithoutMembership, revokeUserMcpKey } from '@/repositories/mcp-keys.repository'
import { deleteMembership } from '@/repositories/memberships.repository'
import { databaseEnabled, openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'

describe.skipIf(!databaseEnabled)('mcp keys repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  function newKey(userId: string, overrides: Partial<{ expiresAt: Date | null; limit: number }> = {}) {
    const hash = `hash-${randomUUID()}`
    return { id: randomUUID(), userId, name: 'Laptop', keyHash: hash, keySuffix: 'ab12', validDays: 30, expiresAt: overrides.expiresAt === undefined ? new Date(Date.now() + 86_400_000) : overrides.expiresAt, limit: overrides.limit ?? 10 }
  }

  test('a member holds several keys, and a new one is refused at the limit', async () => {
    const member = await seedUser(db)
    const first = await insertMcpKeyWithinLimit(db, newKey(member.id, { limit: 2 }))
    const second = await insertMcpKeyWithinLimit(db, newKey(member.id, { limit: 2 }))

    const third = await insertMcpKeyWithinLimit(db, newKey(member.id, { limit: 2 }))

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(third).toBeUndefined()
    expect((await listUserMcpKeys(db, member.id)).map((key) => key.id).sort()).toEqual([first?.id ?? '', second?.id ?? ''].sort())
  })

  test('a revoked or expired key does not count toward the limit', async () => {
    const member = await seedUser(db)
    const revoked = await insertMcpKeyWithinLimit(db, newKey(member.id, { limit: 1 }))
    await revokeUserMcpKey(db, member.id, revoked?.id ?? '')
    await db`UPDATE mcp_keys SET revoked_at = NULL, expires_at = now() - interval '1 day' WHERE id = ${revoked?.id ?? ''}`

    expect(await insertMcpKeyWithinLimit(db, newKey(member.id, { limit: 1 }))).toBeDefined()
  })

  test('a key without an expiry date authenticates, and an expired or revoked key does not', async () => {
    const member = await seedUser(db)
    const forever = newKey(member.id, { expiresAt: null })
    const past = newKey(member.id, { expiresAt: new Date(Date.now() - 1000) })
    const gone = newKey(member.id)
    await insertMcpKeyWithinLimit(db, forever)
    await insertMcpKeyWithinLimit(db, past)
    await insertMcpKeyWithinLimit(db, gone)
    await revokeUserMcpKey(db, member.id, gone.id)

    expect((await findMcpKeyAuth(db, forever.keyHash))?.keyId).toBe(forever.id)
    expect(await findMcpKeyAuth(db, past.keyHash)).toBeUndefined()
    expect(await findMcpKeyAuth(db, gone.keyHash)).toBeUndefined()
  })

  test('a member revokes only their own keys', async () => {
    const member = await seedUser(db)
    const other = await seedUser(db)
    const key = await insertMcpKeyWithinLimit(db, newKey(member.id))

    expect(await revokeUserMcpKey(db, other.id, key?.id ?? '')).toBe(false)
    expect(await revokeUserMcpKey(db, member.id, key?.id ?? '')).toBe(true)
    expect(await revokeUserMcpKey(db, member.id, key?.id ?? '')).toBe(false)
  })

  test('the admin list carries the owner email and pages newest first', async () => {
    const member = await seedUser(db)
    const older = await insertMcpKeyWithinLimit(db, newKey(member.id))
    const newer = await insertMcpKeyWithinLimit(db, newKey(member.id))
    await db`UPDATE mcp_keys SET created_at = now() - interval '1 hour' WHERE id = ${older?.id ?? ''}`

    const page = await listAllMcpKeys(db, { query: member.email, after: null, limit: 1 })
    const next = await listAllMcpKeys(db, { query: member.email, after: { sortAt: page[0]?.sortAt ?? '', id: page[0]?.id ?? '' }, limit: 5 })

    expect(page.map((row) => [row.id, row.email])).toEqual([[newer?.id ?? '', member.email]])
    expect(next.map((row) => row.id)).toEqual([older?.id ?? ''])
  })

  test('the keys of a member who left every workspace are revoked', async () => {
    const owner = await seedUser(db)
    const member = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)
    await db`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${workspaceId}, ${member.id}, 'editor')`
    const key = newKey(member.id)
    await insertMcpKeyWithinLimit(db, key)

    await revokeMcpKeyWithoutMembership(db, member.id)
    expect(await findMcpKeyAuth(db, key.keyHash)).toBeDefined()

    await deleteMembership(db, workspaceId, member.id)
    await revokeMcpKeyWithoutMembership(db, member.id)
    expect(await findMcpKeyAuth(db, key.keyHash)).toBeUndefined()
  })
})
