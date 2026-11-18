import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { insertMembership } from '@/repositories/memberships.repository'
import { resolveProjectRoles } from '@/services/project-roles'
import { databaseEnabled, openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'

describe.skipIf(!databaseEnabled)('project roles', () => {
  let db: SQL
  let workspaceId: string
  let projectA: string
  let projectB: string
  let owner: string

  const member = async (role: 'owner' | 'editor' | 'viewer', disciplines: Array<[string, string]> = []) => {
    const user = await seedUser(db)
    await insertMembership(db, { workspaceId, userId: user.id, role })
    for (const [projectId, discipline] of disciplines) {
      await db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${projectId}, ${user.id}, ${discipline})`
    }
    return user.id
  }
  const roles = (userId: string, projectId = projectA) => resolveProjectRoles(db, workspaceId, projectId, userId)
  const project = async (key: string) => {
    const id = randomUUID()
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${workspaceId}, ${key}, ${owner}, ${key})`
    return id
  }

  beforeAll(async () => {
    db = await openTestDatabase()
    owner = (await seedUser(db)).id
    workspaceId = (await seedWorkspace(db, owner)).workspaceId
    projectA = await project('AAA')
    projectB = await project('BBB')
  })

  afterAll(async () => {
    await db.close()
  })

  test('a PM in one project is not a PM in another project of the same workspace', async () => {
    const userId = await member('editor', [[projectA, 'pm']])
    expect(await roles(userId, projectA)).toMatchObject({ disciplines: ['pm'], isPm: true, isApprover: true })
    expect(await roles(userId, projectB)).toMatchObject({ disciplines: [], isPm: false, isTechLead: false, isApprover: false })
  })

  test('a tech lead approves but does not manage', async () => {
    const userId = await member('editor', [[projectA, 'tech_lead']])
    expect(await roles(userId)).toMatchObject({ isPm: false, isTechLead: true, isApprover: true })
  })

  test('a member with several roles gets every flag they earn', async () => {
    const userId = await member('editor', [[projectA, 'backend'], [projectA, 'pm'], [projectA, 'tech_lead']])
    const result = await roles(userId)
    expect([...result.disciplines].sort()).toEqual(['backend', 'pm', 'tech_lead'])
    expect(result).toMatchObject({ isPm: true, isTechLead: true, isApprover: true })
  })

  test('other roles do not manage or approve', async () => {
    const userId = await member('editor', [[projectA, 'backend']])
    expect(await roles(userId)).toMatchObject({ isPm: false, isTechLead: false, isApprover: false })
  })

  test('the workspace owner is PM and approver in every project without a project role', async () => {
    expect(await roles(owner, projectA)).toMatchObject({ workspaceRole: 'owner', isPm: true, isTechLead: true, isApprover: true })
    expect(await roles(owner, projectB)).toMatchObject({ workspaceRole: 'owner', isPm: true, isApprover: true })
  })

  test('a viewer never manages or approves, whatever role the project gives them', async () => {
    const userId = await member('viewer', [[projectA, 'pm'], [projectA, 'tech_lead']])
    expect(await roles(userId)).toMatchObject({ workspaceRole: 'viewer', isPm: false, isTechLead: false, isApprover: false })
  })

  test('an app admin who is not a member reads as a viewer and writes nothing', async () => {
    const admin = (await seedUser(db)).id
    await db`UPDATE users SET is_admin = true WHERE id = ${admin}`
    expect(await roles(admin)).toMatchObject({ workspaceRole: 'viewer', viaAdmin: true, isPm: false, isApprover: false })
  })

  test('a stranger gets workspace not found, and a project of another workspace gets project not found', async () => {
    const stranger = (await seedUser(db)).id
    await expect(roles(stranger)).rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' })
    await expect(roles(owner, randomUUID())).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })
  })
})
