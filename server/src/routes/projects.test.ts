import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp } from '@/testing/http'

describe.skipIf(!databaseEnabled)('project member roles', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
  })

  afterAll(async () => {
    await db.close()
  })

  async function projectOf(token: string, workspaceId: string): Promise<string> {
    const response = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token })
    return (response.json.data as { projects: Array<{ id: string }> }).projects[0].id
  }

  test('the owner gives a member the tech lead role on the project', async () => {
    const owner = await http.signUp('tl-owner')
    const lead = await http.signUp('tl-lead')
    const workspaceId = await http.createWorkspace(owner, 'Tech lead roles')
    await http.inviteAndAccept(owner, workspaceId, lead, 'editor')
    const projectId = await projectOf(owner.token, workspaceId)

    const response = await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, {
      token: owner.token,
      body: { userId: lead.user.id, discipline: 'tech_lead' },
    })

    expect(response.status).toBe(200)
    expect((response.json.data as { member: { discipline: string } }).member.discipline).toBe('tech_lead')
  })

  test('an unknown role is refused', async () => {
    const owner = await http.signUp('tl-owner-bad')
    const workspaceId = await http.createWorkspace(owner, 'Unknown role')
    const projectId = await projectOf(owner.token, workspaceId)

    const response = await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, {
      token: owner.token,
      body: { userId: owner.user.id, discipline: 'architect' },
    })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('PROJECT_INPUT_INVALID')
  })

  test('the workspace member list carries each member\'s project role', async () => {
    const owner = await http.signUp('roles-owner')
    const lead = await http.signUp('roles-lead')
    const workspaceId = await http.createWorkspace(owner, 'Role list')
    await http.inviteAndAccept(owner, workspaceId, lead, 'editor')
    const projectId = await projectOf(owner.token, workspaceId)
    await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: lead.user.id, discipline: 'tech_lead' } })

    const response = await http.call('GET', `/api/workspaces/${workspaceId}/project-members`, { token: owner.token })

    const members = (response.json.data as { members: Array<{ id: string; discipline: string | null }> }).members
    expect(members.find((member) => member.id === lead.user.id)?.discipline).toBe('tech_lead')
    expect(members.find((member) => member.id === owner.user.id)?.discipline).toBe('pm')
  })
})
