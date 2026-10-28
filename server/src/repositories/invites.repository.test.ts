import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import {
  deleteInvite,
  deleteUnusedInvitesForEmail,
  insertInvite,
  listActiveInvites,
  lockActiveInvite,
  markInviteUsed,
} from '@/repositories/invites.repository'
import { databaseEnabled, openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'

const hour = 60 * 60 * 1000

describe.skipIf(!databaseEnabled)('invites repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('listActiveInvites hides used and expired invites', async () => {
    const owner = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)
    const active = randomUUID()
    const used = randomUUID()
    const expired = randomUUID()
    await insertInvite(db, { id: active, workspaceId, email: 'active@test.dev', tokenHash: randomUUID(), role: 'viewer', expiresAt: new Date(Date.now() + hour), createdBy: owner.id })
    await insertInvite(db, { id: used, workspaceId, email: 'used@test.dev', tokenHash: randomUUID(), role: 'viewer', expiresAt: new Date(Date.now() + hour), createdBy: owner.id })
    await insertInvite(db, { id: expired, workspaceId, email: 'expired@test.dev', tokenHash: randomUUID(), role: 'viewer', expiresAt: new Date(Date.now() - hour), createdBy: owner.id })
    await markInviteUsed(db, used)

    const rows = await listActiveInvites(db, { workspaceId, after: null, limit: 10 })

    expect(rows.map((row) => row.id)).toEqual([active])
    expect(rows[0].createdByEmail).toBe(owner.email)
  })

  test('deleteUnusedInvitesForEmail removes pending invites for that email and keeps used ones', async () => {
    const owner = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)
    const pending = randomUUID()
    const used = randomUUID()
    await insertInvite(db, { id: pending, workspaceId, email: 'repeat@test.dev', tokenHash: randomUUID(), role: 'editor', expiresAt: new Date(Date.now() + hour), createdBy: owner.id })
    await insertInvite(db, { id: used, workspaceId, email: 'repeat@test.dev', tokenHash: randomUUID(), role: 'editor', expiresAt: new Date(Date.now() + hour), createdBy: owner.id })
    await markInviteUsed(db, used)

    await deleteUnusedInvitesForEmail(db, workspaceId, 'repeat@test.dev')

    const remaining = await db`SELECT id FROM invites WHERE workspace_id = ${workspaceId} AND email = 'repeat@test.dev'`
    expect(remaining.map((row: { id: string }) => row.id)).toEqual([used])
  })

  test('lockActiveInvite finds an unused, unexpired invite by its token hash only', async () => {
    const owner = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)
    const id = randomUUID()
    const tokenHash = randomUUID()
    await insertInvite(db, { id, workspaceId, email: 'lock@test.dev', tokenHash, role: 'editor', expiresAt: new Date(Date.now() + hour), createdBy: owner.id })

    expect(await lockActiveInvite(db, tokenHash)).toEqual({ id, workspaceId, email: 'lock@test.dev', role: 'editor' })

    await markInviteUsed(db, id)
    expect(await lockActiveInvite(db, tokenHash)).toBeUndefined()
  })

  test('deleteInvite removes only an invite of the given workspace', async () => {
    const owner = await seedUser(db)
    const first = await seedWorkspace(db, owner.id)
    const second = await seedWorkspace(db, owner.id)
    const id = randomUUID()
    await insertInvite(db, { id, workspaceId: first.workspaceId, email: 'delete@test.dev', tokenHash: randomUUID(), role: 'viewer', expiresAt: new Date(Date.now() + hour), createdBy: owner.id })

    await deleteInvite(db, second.workspaceId, id)
    expect((await listActiveInvites(db, { workspaceId: first.workspaceId, after: null, limit: 10 })).map((row) => row.id)).toEqual([id])

    await deleteInvite(db, first.workspaceId, id)
    expect(await listActiveInvites(db, { workspaceId: first.workspaceId, after: null, limit: 10 })).toEqual([])
  })
})
