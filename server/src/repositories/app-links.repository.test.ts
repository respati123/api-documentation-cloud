import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'
import { deleteAppLink, deleteDataModel, findAppLink, insertAppLink, insertDataModel, listAppLinks, listDataModels } from './app-links.repository'

describe.skipIf(!databaseEnabled)('app links repository', () => {
  let db: SQL
  let workspaceId: string
  let userId: string

  beforeAll(async () => {
    db = await openTestDatabase()
    const user = await seedUser(db)
    userId = user.id
    workspaceId = (await seedWorkspace(db, user.id)).workspaceId
  })

  afterAll(async () => {
    await db.close()
  })

  test('a project links once per workspace and app, and is found, listed, and unlinked', async () => {
    const appProjectId = randomUUID()
    const link = { id: randomUUID(), workspaceId, app: 'dbdesign' as const, appProjectId, appProjectName: 'Toko', createdBy: userId }
    expect(await insertAppLink(db, link)).toBe(true)
    expect(await insertAppLink(db, { ...link, id: randomUUID() })).toBe(false)
    expect(await findAppLink(db, workspaceId, 'dbdesign', appProjectId)).toMatchObject({ appProjectName: 'Toko', app: 'dbdesign' })
    expect(await findAppLink(db, workspaceId, 'stitchkit', appProjectId)).toBeNull()
    expect((await listAppLinks(db, workspaceId, 'dbdesign')).some((row) => row.appProjectId === appProjectId)).toBe(true)
    expect(await deleteAppLink(db, workspaceId, link.id)).toBe(true)
    expect(await deleteAppLink(db, workspaceId, link.id)).toBe(false)
  })

  test('a table joins a story data model once, and can be removed', async () => {
    const storyId = randomUUID()
    // A story always sits under an epic.
    const epicId = randomUUID()
    await db`INSERT INTO planning_items (id, workspace_id, kind, title, created_by) VALUES (${epicId}, ${workspaceId}, 'epic', 'Belanja', ${userId})`
    await db`INSERT INTO planning_items (id, workspace_id, kind, parent_id, title, created_by) VALUES (${storyId}, ${workspaceId}, 'story', ${epicId}, 'Checkout', ${userId})`
    const row = { id: randomUUID(), storyId, appProjectId: 'p-1', projectName: 'Toko', tableId: 't-1', tableName: 'orders', createdBy: userId, apiKeyId: null }
    expect(await insertDataModel(db, row)).toBe(true)
    expect(await insertDataModel(db, { ...row, id: randomUUID() })).toBe(false)
    expect((await listDataModels(db, storyId)).map((item) => item.tableName)).toEqual(['orders'])
    expect(await deleteDataModel(db, storyId, row.id)).toBe(true)
  })
})
