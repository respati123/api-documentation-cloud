import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import {
  deleteMembership,
  findRole,
  hasMemberWithEmail,
  insertMembership,
  listMemberIds,
  listMembersPage,
  updateRole,
} from '@/repositories/memberships.repository'
import { databaseEnabled, openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'

describe.skipIf(!databaseEnabled)('memberships repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('findRole returns the role of a member and undefined for a stranger', async () => {
    const owner = await seedUser(db)
    const stranger = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)

    expect(await findRole(db, workspaceId, owner.id)).toBe('owner')
    expect(await findRole(db, workspaceId, stranger.id)).toBeUndefined()
  })

  test('insertMembership keeps the existing role when the member is already present', async () => {
    const owner = await seedUser(db)
    const member = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)
    await insertMembership(db, { workspaceId, userId: member.id, role: 'viewer' })

    await insertMembership(db, { workspaceId, userId: member.id, role: 'editor' })

    expect(await findRole(db, workspaceId, member.id)).toBe('viewer')
  })

  test('updateRole and deleteMembership change only the given member', async () => {
    const owner = await seedUser(db)
    const editor = await seedUser(db)
    const viewer = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)
    await insertMembership(db, { workspaceId, userId: editor.id, role: 'editor' })
    await insertMembership(db, { workspaceId, userId: viewer.id, role: 'viewer' })

    await updateRole(db, workspaceId, editor.id, 'viewer')
    await deleteMembership(db, workspaceId, viewer.id)

    expect(await findRole(db, workspaceId, editor.id)).toBe('viewer')
    expect(await findRole(db, workspaceId, viewer.id)).toBeUndefined()
    expect((await listMemberIds(db, workspaceId)).sort()).toEqual([owner.id, editor.id].sort())
  })

  test('hasMemberWithEmail ignores letter case', async () => {
    const owner = await seedUser(db)
    const member = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)
    await insertMembership(db, { workspaceId, userId: member.id, role: 'viewer' })

    expect(await hasMemberWithEmail(db, workspaceId, member.email.toUpperCase())).toBe(true)
    expect(await hasMemberWithEmail(db, workspaceId, 'nobody@test.dev')).toBe(false)
  })

  test('listMembersPage orders owners first, then editors, then viewers, and resumes after a cursor', async () => {
    const owner = await seedUser(db)
    const editor = await seedUser(db)
    const viewer = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)
    await insertMembership(db, { workspaceId, userId: editor.id, role: 'editor' })
    await insertMembership(db, { workspaceId, userId: viewer.id, role: 'viewer' })

    const first = await listMembersPage(db, { workspaceId, after: null, limit: 1 })
    expect(first.map((row) => row.id)).toEqual([owner.id])

    const last = first[0]
    const second = await listMembersPage(db, {
      workspaceId,
      after: { rank: last.rank, sortAt: last.sortAt, id: last.id },
      limit: 2,
    })
    expect(second.map((row) => row.id)).toEqual([editor.id, viewer.id])
    expect(second.map((row) => row.role)).toEqual(['editor', 'viewer'])
  })
})
