import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { claimMcpKey, findMcpPrincipal, findOpenMcpKey, listMcpKeyMembers, replaceOpenMcpKey, revokeMcpKey, revokeMcpKeyWithoutMembership } from '@/repositories/mcp-keys.repository'
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

  function newKey(userId: string, createdBy: string, overrides: Partial<{ claimExpiresAt: Date }> = {}) {
    return { id: randomUUID(), userId, createdBy, name: 'Laptop', role: 'backend' as const, tools: ['workspaces_list' as const], validDays: 30, claimExpiresAt: overrides.claimExpiresAt ?? new Date(Date.now() + 60_000) }
  }

  test('replaceOpenMcpKey revokes the open key of the member before adding the new one', async () => {
    const admin = await seedUser(db)
    const member = await seedUser(db)
    const first = await replaceOpenMcpKey(db, newKey(member.id, admin.id))

    const second = await replaceOpenMcpKey(db, newKey(member.id, admin.id))

    expect((await findOpenMcpKey(db, member.id))?.id).toBe(second.id)
    const [old] = await db`SELECT revoked_at FROM mcp_keys WHERE id = ${first.id}`
    expect(old.revoked_at).not.toBeNull()
  })

  test('claimMcpKey stores the hash and expiry once, only for the member and only inside the claim window', async () => {
    const admin = await seedUser(db)
    const member = await seedUser(db)
    const other = await seedUser(db)
    const key = await replaceOpenMcpKey(db, newKey(member.id, admin.id))
    const expiresAt = new Date(Date.now() + 86_400_000)

    expect(await claimMcpKey(db, { keyId: key.id, userId: other.id, keyHash: `h-${randomUUID()}`, expiresAt })).toBeUndefined()
    const claimed = await claimMcpKey(db, { keyId: key.id, userId: member.id, keyHash: `h-${randomUUID()}`, expiresAt })
    expect(claimed?.claimedAt).toBeInstanceOf(Date)
    expect(await claimMcpKey(db, { keyId: key.id, userId: member.id, keyHash: `h-${randomUUID()}`, expiresAt })).toBeUndefined()

    const late = await replaceOpenMcpKey(db, newKey(other.id, admin.id, { claimExpiresAt: new Date(Date.now() - 1000) }))
    expect(await claimMcpKey(db, { keyId: late.id, userId: other.id, keyHash: `h-${randomUUID()}`, expiresAt })).toBeUndefined()
  })

  test('findMcpPrincipal finds only a claimed key that is not revoked or expired', async () => {
    const admin = await seedUser(db)
    const member = await seedUser(db)
    const key = await replaceOpenMcpKey(db, newKey(member.id, admin.id))
    const keyHash = `h-${randomUUID()}`
    await claimMcpKey(db, { keyId: key.id, userId: member.id, keyHash, expiresAt: new Date(Date.now() + 86_400_000) })

    expect(await findMcpPrincipal(db, keyHash)).toEqual({ keyId: key.id, userId: member.id, role: 'backend', tools: ['workspaces_list'], guideVersion: null, guideReadAt: null })

    await revokeMcpKey(db, key.id)
    expect(await findMcpPrincipal(db, keyHash)).toBeUndefined()
  })

  test('revokeMcpKeyWithoutMembership revokes the key only after the last workspace is left', async () => {
    const admin = await seedUser(db)
    const member = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, member.id)
    await replaceOpenMcpKey(db, newKey(member.id, admin.id))

    await revokeMcpKeyWithoutMembership(db, member.id)
    expect(await findOpenMcpKey(db, member.id)).toBeDefined()

    await deleteMembership(db, workspaceId, member.id)
    await revokeMcpKeyWithoutMembership(db, member.id)
    expect(await findOpenMcpKey(db, member.id)).toBeUndefined()
  })

  test('listMcpKeyMembers lists workspace members with their latest key and filters by email', async () => {
    const admin = await seedUser(db)
    const member = await seedUser(db)
    await seedWorkspace(db, member.id)
    const key = await replaceOpenMcpKey(db, newKey(member.id, admin.id))

    const rows = await listMcpKeyMembers(db, { query: member.email, after: null, limit: 10 })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ userId: member.id, email: member.email, workspaceCount: 1 })
    expect(rows[0].key?.id).toBe(key.id)
  })
})
