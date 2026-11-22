import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { EPIC_DOCUMENT_SECTIONS } from '@/models/epic-document'
import { GUIDE_VERSION } from '@/services/mcp-guides'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

type Body = Record<string, any>

const sections = (kind: 'spec' | 'design' | 'contract') => Object.fromEntries(EPIC_DOCUMENT_SECTIONS[kind].map((name) => [name, `${name} text`]))

// CLOUD-001 PR 4: the agents of each role work through the standard flow over MCP, and people approve in the web app.
describe.skipIf(!databaseEnabled)('MCP tools of the team standard', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let owner: TestAccount
  let pm: TestAccount
  let lead: TestAccount
  let dev: TestAccount
  let qa: TestAccount
  let workspaceId: string
  let projectId: string
  const keys: Record<'pm' | 'lead' | 'dev' | 'qa', string> = { pm: '', lead: '', dev: '', qa: '' }

  const api = (method: string, path: string, body?: unknown) => http.call(method, `/api/workspaces/${workspaceId}/projects/${projectId}${path}`, { token: owner.token, body })

  async function keyOf(member: TestAccount, name: string) {
    const created = await http.call('POST', '/api/me/mcp-keys', { token: member.token, body: { name, validDays: 30 } })
    const secret = (created.json.data as { secret: string }).secret
    await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
    return secret
  }
  async function call(key: string, name: string, args: Body = {}) {
    const response = await http.mcp(key, 'tools/call', { name, arguments: { workspaceId, ...args } })
    const result = response.json.result as { content: Array<{ text: string }>; isError: boolean } | undefined
    return { isError: result?.isError ?? true, value: result ? JSON.parse(result.content[0].text) : response.json.error }
  }

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    owner = await http.signUp('ms-owner')
    pm = await http.signUp('ms-pm')
    lead = await http.signUp('ms-lead')
    dev = await http.signUp('ms-dev')
    qa = await http.signUp('ms-qa')
    workspaceId = await http.createWorkspace(owner, 'MCP standard')
    for (const who of [pm, lead, dev, qa]) await http.inviteAndAccept(owner, workspaceId, who, 'editor')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    const members = `/api/workspaces/${workspaceId}/projects/${projectId}/members`
    for (const [who, discipline] of [[pm, 'pm'], [lead, 'tech_lead'], [dev, 'backend'], [qa, 'qa']] as const) {
      await http.call('POST', members, { token: owner.token, body: { userId: who.user.id, disciplines: [discipline] } })
    }
    keys.pm = await keyOf(pm, 'pm agent')
    keys.lead = await keyOf(lead, 'lead agent')
    keys.dev = await keyOf(dev, 'dev agent')
    keys.qa = await keyOf(qa, 'qa agent')
  })

  afterAll(async () => {
    await db.close()
  })

  const approve = async (documentId: string) => expect((await api('POST', `/issues/AUTH-001/documents/${documentId}/approve`)).status).toBe(200)

  test('the whole flow: PM spec and criteria, tech lead design, contract and ticket, engineer sub-task, QA test case', async () => {
    // PM agent: the epic, its spec, and two criteria.
    const epic = await call(keys.pm, 'issue_draft', { type: 'epic', title: 'Sign in', featurePrefix: 'AUTH' })
    expect(epic.value).toMatchObject({ featureCode: 'AUTH-001' })
    await api('POST', `/issues/${epic.value.id}/publish`)
    const spec = await call(keys.pm, 'epic_document_draft', { epicId: 'AUTH-001', kind: 'spec', sections: sections('spec'), clientRequestId: 'spec-1' })
    expect(spec.isError).toBe(false)
    for (const title of ['Signs up', 'Locked after failures']) {
      const added = await call(keys.pm, 'acceptance_criterion_add', { epicId: 'AUTH-001', flow: 'Sign in', title, given: 'rina@contoh.id', when: 'the user acts', then: ['the result shows'] })
      expect(added.isError).toBe(false)
    }
    // An agent never approves: the owner does it in the web app.
    await approve(spec.value.id)

    // Tech lead agent: design with a mapping, then the contract.
    const design = await call(keys.lead, 'epic_document_draft', { epicId: 'AUTH-001', kind: 'design', sections: sections('design') })
    expect(design.isError).toBe(false)
    expect((await call(keys.lead, 'acceptance_criterion_map', { epicId: 'AUTH-001', number: 1, entries: [{ repo: 'backend', component: 'POST /v1/auth/register', testLevel: 'integration' }] })).value.coverage.inDesign).toBe(true)
    await approve(design.value.id)
    const contract = await call(keys.lead, 'epic_document_draft', { epicId: 'AUTH-001', kind: 'contract', sections: sections('contract') })
    await approve(contract.value.id)

    // Tech lead agent: two tickets, the second depending on the first.
    const ticketFields = {
      repo: 'expenses-backend',
      goal: 'Sign up with email.',
      scope: 'Register endpoint.',
      designNotes: '201, 409 EMAIL_TAKEN.',
      codeFollow: 'src/modules/expenses/',
      codeTouch: 'src/modules/auth/',
      ticketAcs: [{ given: 'a new email', when: 'POST /v1/auth/register', then: ['201'] }],
      requiredTests: [
        { case: 'register succeeds', unhappy: false },
        { case: 'duplicate email returns 409', unhappy: true },
      ],
      outOfScope: 'Login: AUTH-001-BE-2.',
      skills: ['api-endpoint'],
      size: 'M',
    }
    const first = await call(keys.lead, 'ticket_draft', { epicId: 'AUTH-001', title: 'Register endpoint', role: 'backend', acNumbers: [1], ...ticketFields, clientRequestId: 'ticket-1' })
    expect(first.value.issue.ticketCode).toBe('AUTH-001-BE-1')
    expect(first.value.readiness).toEqual({ ready: true, failing: [] })
    const second = await call(keys.lead, 'ticket_draft', { epicId: 'AUTH-001', title: 'Login endpoint', role: 'backend', acNumbers: [2], dependsOn: ['AUTH-001-BE-1'], ...ticketFields })
    expect(second.value.issue.ticketCode).toBe('AUTH-001-BE-2')
    // A dependency back the other way would close a loop.
    expect((await call(keys.lead, 'ticket_update', { ticketId: 'AUTH-001-BE-1', dependsOn: ['AUTH-001-BE-2'] })).value.code).toBe('ISSUE_INPUT_INVALID')
    const split = await call(keys.lead, 'ticket_update', { ticketId: 'AUTH-001-BE-2', size: 'L' })
    expect(split.value.readiness.failing.map((miss: Body) => miss.item)).toEqual([8])

    // The owner publishes the ticket and gives it to the developer.
    await api('POST', `/issues/${first.value.issue.id}/publish`)
    await api('PATCH', `/issues/${first.value.issue.id}`, { assigneeId: dev.user.id })

    // Developer agent: reads the ticket, adds a step, moves it.
    const read = await call(keys.dev, 'ticket_read', { ticketId: 'AUTH-001-BE-1' })
    expect(read.value.criteria.map((item: Body) => item.code)).toEqual(['AC1'])
    expect(read.value.contract).toMatchObject({ status: 'approved' })
    const step = await call(keys.dev, 'subtask_add', { ticketId: 'AUTH-001-BE-1', title: 'Write the migration', clientRequestId: 'step-1' })
    expect(step.value).toMatchObject({ assigneeId: dev.user.id, role: null })
    expect(step.value.publishedAt).not.toBeNull()
    expect((await call(keys.dev, 'subtask_update_status', { subtaskId: step.value.id, status: 'in_progress' })).isError).toBe(false)

    // QA agent: a test case for criterion 1.
    const testCase = await call(keys.qa, 'criterion_test_case_write', { epicId: 'AUTH-001', number: 1, title: 'Register', steps: ['send the form'], expected: ['201'] })
    expect(testCase.value.coverage.hasTestCase).toBe(true)
  })

  test('a refused write tells the agent what to fix', async () => {
    const missing = await call(keys.pm, 'epic_document_draft', { epicId: 'AUTH-001', kind: 'spec', sections: { problem: 'x' } })
    expect(missing.value.code).toBe('EPIC_DOCUMENT_INCOMPLETE')
    expect(missing.value.details.missing).toContain('goals')
    const blocked = await call(keys.pm, 'acceptance_criterion_add', { epicId: 'AUTH-001', title: 'Late', given: 'g', when: 'w', then: ['t'] })
    expect(blocked.value).toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED', details: { needs: 'spec_draft' } })
  })

  test('CLOUD-001 AC15: the PM key cannot draft tickets, and a developer key cannot write documents', async () => {
    expect((await call(keys.pm, 'ticket_draft', { epicId: 'AUTH-001', title: 'x', role: 'backend' })).value.code).toBe('MCP_PERMISSION_DENIED')
    expect((await call(keys.pm, 'planning_draft_task', { storyId: 'x', title: 'x', role: 'backend' })).value.code).toBe('MCP_PERMISSION_DENIED')
    expect((await call(keys.dev, 'epic_document_draft', { epicId: 'AUTH-001', kind: 'spec', sections: {} })).value.code).toBe('MCP_PERMISSION_DENIED')
  })

  test('the tools are listed for the roles that hold them', async () => {
    const names = async (key: string) => ((await http.mcp(key, 'tools/list')).json.result as { tools: Array<{ name: string }> }).tools.map((tool) => tool.name)
    const devTools = await names(keys.dev)
    for (const tool of ['ticket_read', 'ticket_readiness', 'subtask_add', 'epic_documents_read', 'acceptance_criteria_list']) expect(devTools).toContain(tool)
    expect(devTools).not.toContain('ticket_draft')
    expect(await names(keys.lead)).toContain('ticket_draft')
  })

  test('CLOUD-001 AC18: a key that read an older guide must read the new one before it writes', async () => {
    const stale = await keyOf(lead, 'stale agent')
    await db`UPDATE mcp_keys SET guide_version = '2026-11-18.3' WHERE name = 'stale agent'`
    const refused = await call(stale, 'ticket_update', { ticketId: 'AUTH-001-BE-2', size: 'M' })
    expect(refused.value.code).toBe('MCP_GUIDE_REQUIRED')
    expect(refused.value.guide.version).toBe(GUIDE_VERSION)
    // The refusal carried the guide, which counts as reading it.
    expect((await call(stale, 'ticket_update', { ticketId: 'AUTH-001-BE-2', size: 'M' })).isError).toBe(false)
  })
})
