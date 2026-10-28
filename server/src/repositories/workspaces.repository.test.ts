import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import {
  findWorkspaceForMember,
  findWorkspaceSummary,
  insertWorkspace,
  listWorkspacesPage,
  renameWorkspace,
  setWorkspaceHead,
} from '@/repositories/workspaces.repository'
import { insertMembership } from '@/repositories/memberships.repository'
import { databaseEnabled, openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'

describe.skipIf(!databaseEnabled)('workspaces repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('listWorkspacesPage returns the newest workspace first and resumes after a cursor', async () => {
    const owner = await seedUser(db)
    const older = await seedWorkspace(db, owner.id)
    const newer = await seedWorkspace(db, owner.id)

    const first = await listWorkspacesPage(db, { userId: owner.id, after: null, limit: 1 })
    const mine = [older.workspaceId, newer.workspaceId]
    expect(mine).toContain(first[0].id)

    const last = first[0]
    const rest = await listWorkspacesPage(db, {
      userId: owner.id,
      after: { sortAt: last.sortAt, id: last.id },
      limit: 10,
    })
    expect(rest.map((row) => row.id)).not.toContain(last.id)
    expect([first[0].id, ...rest.map((row) => row.id)].sort()).toEqual([...mine].sort())
  })

  test('listWorkspacesPage only returns workspaces the user is a member of', async () => {
    const owner = await seedUser(db)
    const stranger = await seedUser(db)
    const { workspaceId } = await seedWorkspace(db, owner.id)

    const rows = await listWorkspacesPage(db, { userId: stranger.id, after: null, limit: 100 })

    expect(rows.map((row) => row.id)).not.toContain(workspaceId)
  })

  test('findWorkspaceForMember returns the workspace for a member and undefined for a stranger', async () => {
    const owner = await seedUser(db)
    const stranger = await seedUser(db)
    const { workspaceId, commitId } = await seedWorkspace(db, owner.id)

    const found = await findWorkspaceForMember(db, workspaceId, owner.id)
    expect(found?.role).toBe('owner')
    expect(found?.headCommitId).toBe(commitId)
    expect(await findWorkspaceForMember(db, workspaceId, stranger.id)).toBeUndefined()
  })

  test('insertWorkspace, renameWorkspace, and setWorkspaceHead update the stored row', async () => {
    const owner = await seedUser(db)
    const workspaceId = randomUUID()
    const commitId = randomUUID()
    const nextCommitId = randomUUID()
    await insertWorkspace(db, { id: workspaceId, name: 'Before', ownerId: owner.id, headCommitId: commitId })
    await insertMembership(db, { workspaceId, userId: owner.id, role: 'owner' })

    await renameWorkspace(db, workspaceId, 'After')
    await setWorkspaceHead(db, workspaceId, nextCommitId)

    expect(await findWorkspaceSummary(db, workspaceId)).toEqual({ id: workspaceId, name: 'After', headCommitId: nextCommitId })
  })

  test('findWorkspaceSummary returns undefined for an unknown workspace', async () => {
    expect(await findWorkspaceSummary(db, randomUUID())).toBeUndefined()
  })
})
