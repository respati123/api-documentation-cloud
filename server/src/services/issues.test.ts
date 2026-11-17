import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { insertMembership } from '@/repositories/memberships.repository'
import { createIssue, getIssue, listProjectIssues, updateIssue } from '@/services/issues'
import { databaseEnabled, openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'

describe.skipIf(!databaseEnabled)('issues service', () => {
  let db: SQL
  let workspaceId: string
  let projectId: string
  let otherProjectId: string
  let ownerId: string
  const people = {} as Record<'pm' | 'lead' | 'dev' | 'qa' | 'plain' | 'viewer' | 'outsider', string>
  let keyId: string

  const scope = () => ({ workspaceId, projectId })
  const as = (who: keyof typeof people) => ({ userId: people[who] })
  const agent = (who: keyof typeof people) => ({ userId: people[who], apiKeyId: keyId })
  const rejectsWith = async (run: () => Promise<unknown>, code: string) => {
    await expect(run()).rejects.toMatchObject({ code })
  }

  async function addMember(workspaceRole: 'editor' | 'viewer', discipline: string | null) {
    const user = await seedUser(db)
    await insertMembership(db, { workspaceId, userId: user.id, role: workspaceRole })
    if (discipline) await db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${projectId}, ${user.id}, ${discipline})`
    return user.id
  }
  async function addProject(key: string) {
    const id = randomUUID()
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${workspaceId}, ${key}, ${ownerId}, ${key})`
    return id
  }

  beforeAll(async () => {
    db = await openTestDatabase()
    ownerId = (await seedUser(db)).id
    workspaceId = (await seedWorkspace(db, ownerId)).workspaceId
    projectId = await addProject('TEST')
    otherProjectId = await addProject('OTHR')
    people.pm = await addMember('editor', 'pm')
    people.lead = await addMember('editor', 'tech_lead')
    people.dev = await addMember('editor', 'backend')
    people.qa = await addMember('editor', 'qa')
    people.plain = await addMember('editor', null)
    people.viewer = await addMember('viewer', 'pm')
    people.outsider = (await seedUser(db)).id
    keyId = randomUUID()
    await db`INSERT INTO mcp_keys (id, user_id, name, role, valid_days, claim_expires_at, key_hash) VALUES (${keyId}, ${people.pm}, 'test key', 'pm', 30, now() + interval '1 day', ${randomUUID()})`
  })

  afterAll(async () => {
    await db.close()
  })

  describe('create', () => {
    test('a PM creates an epic that starts as a draft with no status and the next number', async () => {
      const epic = await createIssue(db, scope(), as('pm'), { type: 'epic', title: 'Checkout' })
      expect(epic).toMatchObject({ type: 'epic', status: null, points: null, rank: null, publishedAt: null, parentId: null })
      expect(epic.key).toBe(`TEST-${epic.number}`)
    })

    test('numbers count up inside a project and each project counts on its own', async () => {
      const a = await createIssue(db, scope(), as('pm'), { type: 'epic', title: 'A' })
      const b = await createIssue(db, scope(), as('pm'), { type: 'epic', title: 'B' })
      const other = await createIssue(db, { workspaceId, projectId: otherProjectId }, { userId: ownerId }, { type: 'epic', title: 'C' })
      expect(b.number).toBe(a.number + 1)
      expect(other).toMatchObject({ number: 1, key: 'OTHR-1' })
      // The PM of one project has no say in another one.
      await rejectsWith(() => createIssue(db, { workspaceId, projectId: otherProjectId }, as('pm'), { type: 'epic', title: 'D' }), 'ROLE_NOT_ALLOWED')
    })

    test('a story is a ranked draft, and later backlog items rank after it', async () => {
      const epic = await createIssue(db, scope(), as('pm'), { type: 'epic', title: 'Epic' })
      const first = await createIssue(db, scope(), as('pm'), { type: 'story', title: 'S1', parentId: epic.id })
      const second = await createIssue(db, scope(), as('lead'), { type: 'story', title: 'S2', parentId: epic.id })
      expect(first).toMatchObject({ status: 'draft', publishedAt: null, parentId: epic.id })
      expect(first.rank).not.toBeNull()
      expect(second.rank as number).toBeGreaterThan(first.rank as number)
    })

    test('a task made by a person is published at once, with the status todo', async () => {
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'T', points: 3, priority: 'high' })
      expect(task).toMatchObject({ status: 'todo', points: 3, priority: 'high' })
      expect(task.publishedAt).not.toBeNull()
    })

    test('any member can file a bug, and it lands at the end of the backlog', async () => {
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'Before' })
      const bug = await createIssue(db, scope(), as('plain'), { type: 'bug', title: 'Broken' })
      expect(bug.publishedAt).not.toBeNull()
      expect(bug.rank as number).toBeGreaterThan(task.rank as number)
    })

    test('only the PM and the tech lead create epics, stories, and tasks', async () => {
      for (const type of ['epic', 'story', 'task'] as const) {
        await rejectsWith(() => createIssue(db, scope(), as('plain'), { type, title: 'No' }), 'ROLE_NOT_ALLOWED')
        await rejectsWith(() => createIssue(db, scope(), as('dev'), { type, title: 'No' }), 'ROLE_NOT_ALLOWED')
      }
      await createIssue(db, scope(), as('lead'), { type: 'task', title: 'Yes' })
    })

    test('a viewer, an outsider, and an issue in a project of another workspace are refused', async () => {
      await rejectsWith(() => createIssue(db, scope(), as('viewer'), { type: 'bug', title: 'No' }), 'ROLE_NOT_ALLOWED')
      await rejectsWith(() => createIssue(db, scope(), as('outsider'), { type: 'bug', title: 'No' }), 'WORKSPACE_NOT_FOUND')
      await rejectsWith(() => createIssue(db, { workspaceId, projectId: randomUUID() }, as('pm'), { type: 'bug', title: 'No' }), 'PROJECT_NOT_FOUND')
    })

    test('a sub-task needs a parent that is a story, task, or bug, and a work role', async () => {
      const epic = await createIssue(db, scope(), as('pm'), { type: 'epic', title: 'E' })
      const story = await createIssue(db, scope(), as('pm'), { type: 'story', title: 'S', parentId: epic.id })
      const sub = await createIssue(db, scope(), as('lead'), { type: 'subtask', title: 'Do it', parentId: story.id, role: 'backend' })
      expect(sub).toMatchObject({ type: 'subtask', status: 'todo', role: 'backend', rank: null, parentId: story.id })
      const invalid = (input: Record<string, unknown>) =>
        rejectsWith(() => createIssue(db, scope(), as('lead'), { type: 'subtask', title: 'Bad', ...input } as never), 'ISSUE_INPUT_INVALID')
      await invalid({ role: 'backend' })
      await invalid({ parentId: epic.id, role: 'backend' })
      await invalid({ parentId: sub.id, role: 'backend' })
      await invalid({ parentId: story.id })
      await invalid({ parentId: story.id, role: 'devops' })
    })

    test('a member whose role matches may add a sub-task, and one whose role does not may not', async () => {
      const story = await createIssue(db, scope(), as('pm'), { type: 'story', title: 'S' })
      await createIssue(db, scope(), as('dev'), { type: 'subtask', title: 'Mine', parentId: story.id, role: 'backend' })
      await rejectsWith(() => createIssue(db, scope(), as('dev'), { type: 'subtask', title: 'Not mine', parentId: story.id, role: 'qa' }), 'ROLE_NOT_ALLOWED')
      await rejectsWith(() => createIssue(db, scope(), as('plain'), { type: 'subtask', title: 'Nobody', parentId: story.id, role: 'backend' }), 'ROLE_NOT_ALLOWED')
    })

    test('an AI agent key only makes drafts', async () => {
      for (const type of ['story', 'task', 'bug'] as const) {
        const issue = await createIssue(db, scope(), agent('pm'), { type, title: `Agent ${type}` })
        expect(issue.publishedAt).toBeNull()
      }
    })

    test('bad input is refused', async () => {
      const invalid = (input: Record<string, unknown>) =>
        rejectsWith(() => createIssue(db, scope(), as('pm'), { type: 'task', title: 'Ok', ...input } as never), 'ISSUE_INPUT_INVALID')
      await invalid({ title: '   ' })
      await invalid({ title: 'x'.repeat(181) })
      await invalid({ points: 4 })
      await invalid({ priority: 'asap' })
      await invalid({ dueDate: 'tomorrow' })
      await invalid({ assigneeId: people.outsider })
      await invalid({ parentId: randomUUID() })
      await rejectsWith(() => createIssue(db, scope(), as('pm'), { type: 'epic', title: 'E', points: 3 }), 'ISSUE_INPUT_INVALID')
      await rejectsWith(() => createIssue(db, scope(), as('pm'), { type: 'bogus', title: 'E' } as never), 'ISSUE_INPUT_INVALID')
    })
  })

  describe('read', () => {
    test('an issue is read by id or by its key, and only inside its own project', async () => {
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'Find me' })
      expect((await getIssue(db, scope(), as('plain'), task.id)).id).toBe(task.id)
      expect((await getIssue(db, scope(), as('plain'), task.key)).id).toBe(task.id)
      expect((await getIssue(db, scope(), as('plain'), task.key.toLowerCase())).id).toBe(task.id)
      await rejectsWith(() => getIssue(db, { workspaceId, projectId: otherProjectId }, as('pm'), task.id), 'ISSUE_NOT_FOUND')
      await rejectsWith(() => getIssue(db, scope(), as('pm'), 'TEST-99999'), 'ISSUE_NOT_FOUND')
    })

    test('a draft is hidden from other members but shown to the PM, the tech lead, and its creator', async () => {
      const draft = await createIssue(db, scope(), as('pm'), { type: 'story', title: 'Hidden' })
      await rejectsWith(() => getIssue(db, scope(), as('plain'), draft.id), 'ISSUE_NOT_FOUND')
      await rejectsWith(() => getIssue(db, scope(), as('dev'), draft.key), 'ISSUE_NOT_FOUND')
      await getIssue(db, scope(), as('pm'), draft.id)
      await getIssue(db, scope(), as('lead'), draft.id)
      const own = await createIssue(db, scope(), agent('dev'), { type: 'bug', title: 'Filed by an agent for dev' })
      expect(own.publishedAt).toBeNull()
      await getIssue(db, scope(), as('dev'), own.id)
      await rejectsWith(() => getIssue(db, scope(), as('plain'), own.id), 'ISSUE_NOT_FOUND')
    })

    test('the list hides drafts from other members and filters by type', async () => {
      const marker = `list-${randomUUID().slice(0, 8)}`
      await createIssue(db, scope(), as('pm'), { type: 'story', title: `${marker} draft` })
      await createIssue(db, scope(), as('pm'), { type: 'task', title: `${marker} task` })
      const titles = (issues: Array<{ title: string }>) => issues.filter((issue) => issue.title.startsWith(marker)).map((issue) => issue.title).sort()
      expect(titles(await listProjectIssues(db, scope(), as('pm'), {}))).toEqual([`${marker} draft`, `${marker} task`])
      expect(titles(await listProjectIssues(db, scope(), as('plain'), {}))).toEqual([`${marker} task`])
      expect(titles(await listProjectIssues(db, scope(), as('pm'), { type: 'story' }))).toEqual([`${marker} draft`])
    })
  })

  describe('update', () => {
    test('any member can set points on a backlog item, but only a Fibonacci value', async () => {
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'Estimate me' })
      expect((await updateIssue(db, scope(), as('plain'), task.id, { points: 8 })).points).toBe(8)
      expect((await updateIssue(db, scope(), as('plain'), task.id, { points: null })).points).toBeNull()
      await rejectsWith(() => updateIssue(db, scope(), as('plain'), task.id, { points: 4 }), 'ISSUE_INPUT_INVALID')
      const epic = await createIssue(db, scope(), as('pm'), { type: 'epic', title: 'No points' })
      await rejectsWith(() => updateIssue(db, scope(), as('pm'), epic.id, { points: 3 }), 'ISSUE_INPUT_INVALID')
    })

    test('the PM edits the content, and a member without a say does not', async () => {
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'Old' })
      expect((await updateIssue(db, scope(), as('pm'), task.id, { title: 'New', description: 'Why', priority: 'urgent' }))).toMatchObject({
        title: 'New',
        description: 'Why',
        priority: 'urgent',
      })
      await rejectsWith(() => updateIssue(db, scope(), as('plain'), task.id, { title: 'Hijack' }), 'ROLE_NOT_ALLOWED')
      await rejectsWith(() => updateIssue(db, scope(), as('viewer'), task.id, { points: 3 }), 'ROLE_NOT_ALLOWED')
    })

    test('the person who filed a bug can edit it', async () => {
      const bug = await createIssue(db, scope(), as('plain'), { type: 'bug', title: 'Mine' })
      expect((await updateIssue(db, scope(), as('plain'), bug.id, { title: 'Still mine' })).title).toBe('Still mine')
      await rejectsWith(() => updateIssue(db, scope(), as('dev'), bug.id, { title: 'Not yours' }), 'ROLE_NOT_ALLOWED')
    })

    test('a status must belong to the type, and an epic has none to set', async () => {
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'T' })
      await rejectsWith(() => updateIssue(db, scope(), as('pm'), task.id, { status: 'draft' }), 'ISSUE_STATUS_NOT_ALLOWED')
      const epic = await createIssue(db, scope(), as('pm'), { type: 'epic', title: 'E' })
      await rejectsWith(() => updateIssue(db, scope(), as('pm'), epic.id, { status: 'done' }), 'ISSUE_STATUS_NOT_ALLOWED')
      expect((await updateIssue(db, scope(), as('pm'), task.id, { status: 'in_review' })).status).toBe('in_review')
    })

    test('a story is Ready only with acceptance criteria and an approved design', async () => {
      const story = await createIssue(db, scope(), as('pm'), { type: 'story', title: 'S' })
      await rejectsWith(() => updateIssue(db, scope(), as('pm'), story.id, { status: 'ready' }), 'ISSUE_NOT_READY')
      await updateIssue(db, scope(), as('pm'), story.id, { acceptanceCriteria: 'It works' })
      await rejectsWith(() => updateIssue(db, scope(), as('pm'), story.id, { status: 'ready' }), 'ISSUE_NOT_READY')
      await db`UPDATE issues SET design_approved_at = now(), design_approved_by = ${people.lead} WHERE id = ${story.id}`
      expect((await updateIssue(db, scope(), as('pm'), story.id, { status: 'ready' })).status).toBe('ready')
    })

    async function readyStory() {
      const story = await createIssue(db, scope(), as('pm'), { type: 'story', title: 'Ready story' })
      await db`UPDATE issues SET acceptance_criteria = 'ok', design_approved_at = now(), design_approved_by = ${people.lead}, status = 'ready', published_at = now() WHERE id = ${story.id}`
      return story
    }

    test('starting the first sub-task moves a Ready story to In Progress', async () => {
      const story = await readyStory()
      const sub = await createIssue(db, scope(), as('lead'), { type: 'subtask', title: 'Go', parentId: story.id, role: 'backend', assigneeId: people.dev })
      await updateIssue(db, scope(), as('dev'), sub.id, { status: 'in_progress' })
      expect((await getIssue(db, scope(), as('pm'), story.id)).status).toBe('in_progress')
      const events = await db`SELECT to_status FROM issue_status_events WHERE issue_id = ${story.id}`
      expect(events.map((row: { to_status: string }) => row.to_status)).toEqual(['in_progress'])
    })

    test('a story that is not Ready stays where it is when a sub-task starts', async () => {
      const story = await createIssue(db, scope(), as('pm'), { type: 'story', title: 'Not ready' })
      const sub = await createIssue(db, scope(), as('lead'), { type: 'subtask', title: 'Early', parentId: story.id, role: 'backend' })
      await updateIssue(db, scope(), as('lead'), sub.id, { status: 'in_progress' })
      expect((await getIssue(db, scope(), as('pm'), story.id)).status).toBe('draft')
    })

    test('a story cannot be Done while a sub-task is open, and can be once all are done', async () => {
      const story = await readyStory()
      const sub = await createIssue(db, scope(), as('lead'), { type: 'subtask', title: 'Open', parentId: story.id, role: 'backend' })
      await rejectsWith(() => updateIssue(db, scope(), as('pm'), story.id, { status: 'done' }), 'ISSUE_SUBTASKS_OPEN')
      await updateIssue(db, scope(), as('lead'), sub.id, { status: 'done' })
      expect((await updateIssue(db, scope(), as('pm'), story.id, { status: 'done' })).status).toBe('done')
    })

    test('only a PM or QA accepts a story as Done', async () => {
      const story = await readyStory()
      await rejectsWith(() => updateIssue(db, scope(), as('dev'), story.id, { status: 'done' }), 'ROLE_NOT_ALLOWED')
      await rejectsWith(() => updateIssue(db, scope(), as('lead'), story.id, { status: 'done' }), 'ROLE_NOT_ALLOWED')
      expect((await updateIssue(db, scope(), as('qa'), story.id, { status: 'done' })).status).toBe('done')
    })

    test('a task is moved by its assignee, a matching role, or the PM or tech lead', async () => {
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'Mine', assigneeId: people.dev })
      await updateIssue(db, scope(), as('dev'), task.id, { status: 'in_progress' })
      await rejectsWith(() => updateIssue(db, scope(), as('plain'), task.id, { status: 'done' }), 'ROLE_NOT_ALLOWED')
      await updateIssue(db, scope(), as('lead'), task.id, { status: 'in_review' })
    })

    test('a status change leaves an event, and changing nothing leaves none', async () => {
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'Events' })
      await updateIssue(db, scope(), as('pm'), task.id, { status: 'in_progress' })
      await updateIssue(db, scope(), as('pm'), task.id, { status: 'in_progress' })
      await updateIssue(db, scope(), as('pm'), task.id, { title: 'Events 2' })
      const events = await db`SELECT from_status, to_status FROM issue_status_events WHERE issue_id = ${task.id}`
      expect(events).toEqual([{ from_status: 'todo', to_status: 'in_progress' }])
    })

    test('an AI agent cannot accept a story, and moves only a sub-task assigned to its owner', async () => {
      const story = await readyStory()
      await rejectsWith(() => updateIssue(db, scope(), agent('pm'), story.id, { status: 'done' }), 'ISSUE_AGENT_FORBIDDEN')
      const task = await createIssue(db, scope(), as('pm'), { type: 'task', title: 'Not a sub-task' })
      await rejectsWith(() => updateIssue(db, scope(), agent('pm'), task.id, { status: 'in_progress' }), 'ISSUE_AGENT_FORBIDDEN')
      const own = await createIssue(db, scope(), as('lead'), { type: 'subtask', title: 'Own', parentId: story.id, role: 'backend', assigneeId: people.pm })
      expect((await updateIssue(db, scope(), agent('pm'), own.id, { status: 'in_progress' })).status).toBe('in_progress')
      const foreign = await createIssue(db, scope(), as('lead'), { type: 'subtask', title: 'Foreign', parentId: story.id, role: 'backend', assigneeId: people.dev })
      await rejectsWith(() => updateIssue(db, scope(), agent('pm'), foreign.id, { status: 'in_progress' }), 'ISSUE_AGENT_FORBIDDEN')
    })

    test('an unknown issue is not found', async () => {
      await rejectsWith(() => updateIssue(db, scope(), as('pm'), randomUUID(), { title: 'x' }), 'ISSUE_NOT_FOUND')
    })
  })
})
