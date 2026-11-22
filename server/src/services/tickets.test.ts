import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { EPIC_DOCUMENT_SECTIONS } from '@/models/epic-document'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'
import { addEpicCriterion, setIssueCriteria } from '@/services/acceptance-criteria'
import { approveEpicDocument, createEpicDocument, listEpicDocuments, reviseEpicDocument } from '@/services/epic-documents'
import { publishIssue } from '@/services/issue-backlog'
import { addLink } from '@/services/issue-details'
import { createIssue, getIssue, listIssuePage, updateIssue } from '@/services/issues'
import { addSprintItem, createSprint, startSprint } from '@/services/sprints'
import { getReadiness, getTicket, saveTicket } from '@/services/tickets'

const sections = (kind: 'spec' | 'design' | 'contract') => Object.fromEntries(EPIC_DOCUMENT_SECTIONS[kind].map((name) => [name, `${name} text`]))

const complete = {
  role: 'backend',
  repo: 'expenses-backend',
  goal: 'Users sign up and sign in with email.',
  scope: 'Register and login endpoints.',
  designNotes: 'POST /v1/auth/register: 201, 409 EMAIL_TAKEN.',
  codeFollow: 'src/modules/expenses/',
  codeTouch: 'src/modules/auth/',
  ticketAcs: [{ given: 'rina@contoh.id is new', when: 'POST /v1/auth/register', then: ['201 with accessToken and refreshToken'] }],
  requiredTests: [
    { case: 'register succeeds', unhappy: false },
    { case: 'duplicate email returns 409', unhappy: true },
  ],
  outOfScope: 'Google sign-in: AUTH-001-BE-3.',
  skills: ['api-endpoint', 'auth-access'],
  size: 'M',
}

// CLOUD-001 AC11 to AC14, AC19 and AC22: tickets, their codes, the Definition of Ready, the sprint gate and sub-tasks.
describe.skipIf(!databaseEnabled)('tickets', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  // An epic whose spec (with one criterion), design and contract are approved.
  const approvedEpic = async (prefix: string) => {
    const epic = await createIssue(world.db, world.scope, world.as('pm'), { type: 'epic', title: `Epic ${prefix}`, featurePrefix: prefix })
    await publishIssue(world.db, world.scope, world.as('pm'), epic.id)
    const spec = await createEpicDocument(world.db, world.scope, world.as('pm'), epic.id, { kind: 'spec', sections: sections('spec') })
    await addEpicCriterion(world.db, world.scope, world.as('pm'), epic.id, { title: 'Signs up', given: 'a new email', when: 'the user signs up', then: ['the home page opens'] })
    await approveEpicDocument(world.db, world.scope, world.as('pm'), epic.id, spec.id)
    for (const kind of ['design', 'contract'] as const) {
      const document = await createEpicDocument(world.db, world.scope, world.as('lead'), epic.id, { kind, sections: sections(kind) })
      await approveEpicDocument(world.db, world.scope, world.as('lead'), epic.id, document.id)
    }
    return epic
  }
  const newTask = async (epicId: string, title = 'Endpoint') => (await createIssue(world.db, world.scope, world.as('lead'), { type: 'task', title, parentId: epicId })).id
  const readyTicket = async (epicId: string, title = 'Endpoint') => {
    const id = await newTask(epicId, title)
    await setIssueCriteria(world.db, world.scope, world.as('lead'), id, [1])
    return saveTicket(world.db, world.scope, world.as('lead'), id, complete)
  }

  test('AC11: a partial ticket is saved as a draft and the readiness lists what is missing, by number', async () => {
    const epic = await approvedEpic('PART')
    const id = await newTask(epic.id)
    const draft = await saveTicket(world.db, world.scope, world.as('lead'), id, { role: 'backend', goal: 'Sign in works.' })
    expect(draft.details.goal).toBe('Sign in works.')
    expect(draft.readiness.ready).toBe(false)
    expect(draft.readiness.failing.map((miss) => miss.item)).toEqual([1, 2, 5, 6, 7, 8])
    expect(draft.readiness.failing[0].rule).toContain('Goal, scope')
  })

  test('AC12: a complete ticket is Ready, and size L always fails item 8', async () => {
    const epic = await approvedEpic('READY')
    const ticket = await readyTicket(epic.id)
    expect(ticket.readiness).toEqual({ ready: true, failing: [] })
    const split = await saveTicket(world.db, world.scope, world.as('lead'), ticket.issue.id, { size: 'L' })
    expect(split.readiness.failing).toEqual([{ item: 8, rule: expect.any(String), reason: 'size L, split the ticket' }])
  })

  test('the size fills the points: S is 1, M is 3', async () => {
    const epic = await approvedEpic('SIZE')
    const ticket = await readyTicket(epic.id)
    expect(ticket.issue.points).toBe(3)
    expect((await saveTicket(world.db, world.scope, world.as('lead'), ticket.issue.id, { size: 'S' })).issue.points).toBe(1)
  })

  test('AC14: tickets get codes per role, open by code, and are found by search', async () => {
    const epic = await approvedEpic('CODE')
    const first = await readyTicket(epic.id, 'First')
    const second = await readyTicket(epic.id, 'Second')
    expect([first.issue.ticketCode, second.issue.ticketCode]).toEqual(['CODE-001-BE-1', 'CODE-001-BE-2'])
    const web = await saveTicket(world.db, world.scope, world.as('lead'), second.issue.id, { role: 'frontend' })
    expect(web.issue.ticketCode).toBe('CODE-001-FE-1')
    expect((await getIssue(world.db, world.scope, world.as('dev'), 'code-001-fe-1')).id).toBe(second.issue.id)
    const found = await listIssuePage(world.db, world.scope, world.as('pm'), { q: 'CODE-001-BE-1' }, { limit: 10, cursor: null })
    expect(found.items.map((issue) => issue.id)).toEqual([first.issue.id])
    expect((await listIssuePage(world.db, world.scope, world.as('pm'), { q: 'CODE-001-QA-9' }, { limit: 10, cursor: null })).items).toEqual([])
  })

  test('only the tech lead writes ticket fields; an agent key drafts for its tech lead owner', async () => {
    const epic = await approvedEpic('WHO')
    const id = await newTask(epic.id)
    await world.rejectsWith(() => saveTicket(world.db, world.scope, world.as('pm'), id, { goal: 'x' }), 'ROLE_NOT_ALLOWED')
    await world.rejectsWith(() => saveTicket(world.db, world.scope, world.as('dev'), id, { goal: 'x' }), 'ROLE_NOT_ALLOWED')
    expect((await saveTicket(world.db, world.scope, world.agent('lead'), id, { goal: 'by agent' })).details.goal).toBe('by agent')
    const loose = await createIssue(world.db, world.scope, world.as('lead'), { type: 'task', title: 'No epic' })
    await world.rejectsWith(() => saveTicket(world.db, world.scope, world.as('lead'), loose.id, { goal: 'x' }), 'ISSUE_INPUT_INVALID')
  })

  test('readiness follows the documents: a stale design takes the ticket back out of Ready', async () => {
    const epic = await approvedEpic('DOCS')
    const ticket = await readyTicket(epic.id)
    const spec = (await listEpicDocuments(world.db, world.scope, world.as('pm'), epic.id)).documents.find((document) => document.kind === 'spec')
    await reviseEpicDocument(world.db, world.scope, world.as('pm'), epic.id, spec?.id as string, { expectedVersion: 1, sections: sections('spec') })
    expect((await getReadiness(world.db, world.scope, world.as('lead'), ticket.issue.id)).failing.map((miss) => miss.item)).toEqual([3])
  })

  test('AC13: a dependency that closes a cycle is refused', async () => {
    const epic = await approvedEpic('CYCLE')
    const a = await newTask(epic.id, 'A')
    const b = await newTask(epic.id, 'B')
    const c = await newTask(epic.id, 'C')
    await addLink(world.db, world.scope, world.as('lead'), a, b, 'blocks')
    await addLink(world.db, world.scope, world.as('lead'), b, c, 'blocks')
    await world.rejectsWith(() => addLink(world.db, world.scope, world.as('lead'), c, a, 'blocks'), 'ISSUE_INPUT_INVALID')
  })

  test('AC19: a ticket that is not Ready stays out of a sprint, with no override, and a sprint holding one does not start', async () => {
    const epic = await approvedEpic('SPRINT')
    const draftId = await newTask(epic.id, 'Draft')
    await saveTicket(world.db, world.scope, world.as('lead'), draftId, { role: 'backend' })
    const sprint = await createSprint(world.db, world.scope, world.as('pm'), { name: 'Sprint 14', startsOn: '2026-12-01', endsOn: '2026-12-12' })
    await expect(addSprintItem(world.db, world.scope, world.as('pm'), sprint.id, draftId, { overrideReason: 'please' })).rejects.toMatchObject({
      code: 'SPRINT_ITEM_NOT_READY',
      details: { failing: expect.arrayContaining([expect.objectContaining({ item: 1 })]) },
    })

    const ready = await readyTicket(epic.id, 'Ready one')
    await addSprintItem(world.db, world.scope, world.as('pm'), sprint.id, ready.issue.id)
    await saveTicket(world.db, world.scope, world.as('lead'), ready.issue.id, { size: 'L' })
    await expect(startSprint(world.db, world.scope, world.as('pm'), sprint.id)).rejects.toMatchObject({
      code: 'SPRINT_ITEM_NOT_READY',
      details: { issues: [expect.objectContaining({ issue: ready.issue.key })] },
    })
    await saveTicket(world.db, world.scope, world.as('lead'), ready.issue.id, { size: 'M' })
    expect((await startSprint(world.db, world.scope, world.as('pm'), sprint.id)).status).toBe('active')
  })

  test('AC22: the engineer adds sub-tasks to a ticket, they go to them, and finishing them does not finish the ticket', async () => {
    const epic = await approvedEpic('SUB')
    const ticket = await readyTicket(epic.id)
    const step = await createIssue(world.db, world.scope, world.as('dev'), { type: 'subtask', title: 'Refresh token rotation', parentId: ticket.issue.id })
    expect(step).toMatchObject({ role: null, assigneeId: world.people.dev, status: 'todo' })
    await updateIssue(world.db, world.scope, world.as('dev'), step.id, { status: 'done' })
    expect((await getTicket(world.db, world.scope, world.as('lead'), ticket.issue.id)).issue.status).toBe('todo')
    // QA has no say on a backend ticket it is not assigned to.
    await world.rejectsWith(() => createIssue(world.db, world.scope, world.as('qa'), { type: 'subtask', title: 'Not mine', parentId: ticket.issue.id }), 'ROLE_NOT_ALLOWED')
  })

  test('a ticket with an open sub-task cannot be done', async () => {
    const epic = await approvedEpic('OPEN')
    const ticket = await readyTicket(epic.id)
    await createIssue(world.db, world.scope, world.as('dev'), { type: 'subtask', title: 'Still open', parentId: ticket.issue.id })
    await world.rejectsWith(() => updateIssue(world.db, world.scope, world.as('lead'), ticket.issue.id, { status: 'done' }), 'ISSUE_SUBTASKS_OPEN')
  })
})
