import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

describe.skipIf(!databaseEnabled)('planning approvals', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
  })

  afterAll(async () => {
    await db.close()
  })

  async function withRole(owner: TestAccount, workspaceId: string, label: string, discipline: string) {
    const member = await http.signUp(label)
    await http.inviteAndAccept(owner, workspaceId, member, 'editor')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: member.user.id, discipline } })
    return member
  }

  // Owner writes a BRD and a PRD and moves the PRD to team review, where it waits for approval.
  async function prdInTeamReview(owner: TestAccount, workspaceId: string): Promise<string> {
    const brd = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents`, { token: owner.token, body: { kind: 'brd', title: 'BRD', content: 'Needs' } })
    const brdId = (brd.json.data as { document: { id: string } }).document.id
    const prd = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents`, { token: owner.token, body: { kind: 'prd', title: 'PRD', content: 'Product', sourceDocumentId: brdId } })
    const prdId = (prd.json.data as { document: { id: string } }).document.id
    for (const status of ['review_pm', 'review_team']) await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents/${prdId}/status`, { token: owner.token, body: { status } })
    return prdId
  }

  test('a tech lead approves a PRD', async () => {
    const owner = await http.signUp('approve-owner')
    const workspaceId = await http.createWorkspace(owner, 'Approvals')
    const lead = await withRole(owner, workspaceId, 'approve-lead', 'tech_lead')
    const prdId = await prdInTeamReview(owner, workspaceId)

    const response = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents/${prdId}/status`, { token: lead.token, body: { status: 'approved' } })

    expect(response.status).toBe(200)
    expect((response.json.data as { document: { status: string } }).document.status).toBe('approved')
  })

  test('a backend member cannot approve a PRD', async () => {
    const owner = await http.signUp('refuse-owner')
    const workspaceId = await http.createWorkspace(owner, 'Refusals')
    const backend = await withRole(owner, workspaceId, 'refuse-backend', 'backend')
    const prdId = await prdInTeamReview(owner, workspaceId)

    const response = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents/${prdId}/status`, { token: backend.token, body: { status: 'approved' } })

    expect(response.status).toBe(403)
    expect(response.json.code).toBe('ROLE_NOT_ALLOWED')
  })

  test('a tech lead approves but does not move a PRD through the other review steps', async () => {
    const owner = await http.signUp('steps-owner')
    const workspaceId = await http.createWorkspace(owner, 'Steps')
    const lead = await withRole(owner, workspaceId, 'steps-lead', 'tech_lead')
    const prdId = await prdInTeamReview(owner, workspaceId)

    const response = await http.call('POST', `/api/workspaces/${workspaceId}/planning/documents/${prdId}/status`, { token: lead.token, body: { status: 'draft' } })

    expect(response.status).toBe(403)
  })

  test('a QA member cannot publish an epic', async () => {
    const owner = await http.signUp('publish-owner')
    const workspaceId = await http.createWorkspace(owner, 'Publishing')
    const qa = await withRole(owner, workspaceId, 'publish-qa', 'qa')

    const response = await http.call('POST', `/api/workspaces/${workspaceId}/planning/items/any-epic/publish`, { token: qa.token })

    expect(response.status).toBe(403)
    expect(response.json.code).toBe('ROLE_NOT_ALLOWED')
  })

  test('the document list tells a tech lead they may approve but not manage', async () => {
    const owner = await http.signUp('flags-owner')
    const workspaceId = await http.createWorkspace(owner, 'Flags')
    const lead = await withRole(owner, workspaceId, 'flags-lead', 'tech_lead')
    const backend = await withRole(owner, workspaceId, 'flags-backend', 'backend')

    const leadFlags = (await http.call('GET', `/api/workspaces/${workspaceId}/planning/documents`, { token: lead.token })).json.data
    const backendFlags = (await http.call('GET', `/api/workspaces/${workspaceId}/planning/documents`, { token: backend.token })).json.data

    expect(leadFlags).toMatchObject({ canManage: false, canApprove: true })
    expect(backendFlags).toMatchObject({ canManage: false, canApprove: false })
  })

  test('mentioning a member in a comment notifies them, and an outsider is skipped', async () => {
    const owner = await http.signUp('mention-owner')
    const workspaceId = await http.createWorkspace(owner, 'Mentions')
    const lead = await withRole(owner, workspaceId, 'mention-lead', 'tech_lead')
    const outsider = await http.signUp('mention-outsider')
    const prdId = await prdInTeamReview(owner, workspaceId)

    const posted = await http.call('POST', `/api/workspaces/${workspaceId}/planning/document/${prdId}/comments`, {
      token: owner.token,
      body: { body: '@lead tolong cek batasnya', mentionIds: [lead.user.id, outsider.user.id] },
    })
    expect(posted.status).toBe(201)

    const leadInbox = (await http.call('GET', '/api/me/notifications', { token: lead.token })).json.data as { notifications: Array<{ kind: string; link: string }> }
    const outsiderInbox = (await http.call('GET', '/api/me/notifications', { token: outsider.token })).json.data as { notifications: unknown[] }
    expect(leadInbox.notifications[0]).toMatchObject({ kind: 'comment_mention', link: `/w/${workspaceId}/projects` })
    expect(outsiderInbox.notifications).toHaveLength(0)
  })
})
