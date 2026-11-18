import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createIssue, getIssue, updateIssue } from '@/services/issues'
import { addSprintItem, closeSprint, createSprint, listSprints, removeSprintItem, startSprint, updateSprint } from '@/services/sprints'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'

describe.skipIf(!databaseEnabled)('sprints service', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  // Only one sprint can be active in a project, so each test works in a project of its own.
  async function freshProject() {
    const id = randomUUID()
    const key = `KP${randomUUID().replace(/[^a-f]/g, '').toUpperCase().slice(0, 6)}`
    await world.db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${world.workspaceId}, ${key}, ${world.ownerId}, ${key})`
    for (const who of ['pm', 'lead', 'dev', 'qa'] as const) {
      const discipline = { pm: 'pm', lead: 'tech_lead', dev: 'backend', qa: 'qa' }[who]
      await world.db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${id}, ${world.people[who]}, ${discipline})`
    }
    return { workspaceId: world.workspaceId, projectId: id }
  }

  const days = (offset: number) => new Date(Date.UTC(2026, 5, 1 + offset)).toISOString().slice(0, 10)
  const sprintInput = (extra: Record<string, unknown> = {}) => ({ name: 'Sprint 1', startsOn: days(0), endsOn: days(14), ...extra })
  const events = async (sprintId: string) =>
    (await world.db`SELECT action, after_start, points_before, points_after, override_reason FROM sprint_scope_events WHERE sprint_id = ${sprintId} ORDER BY created_at, id`) as Array<{
      action: string
      after_start: boolean
      points_before: number | null
      points_after: number | null
      override_reason: string | null
    }>

  async function work(scope: { workspaceId: string; projectId: string }, type: 'task' | 'bug', points: number | null = 3) {
    return createIssue(world.db, scope, world.as('lead'), { type, title: `${type} ${randomUUID().slice(0, 6)}`, points })
  }
  async function readyStory(scope: { workspaceId: string; projectId: string }, points: number | null = 5) {
    const story = await createIssue(world.db, scope, world.as('lead'), { type: 'story', title: 'Story', points })
    await world.db`UPDATE issues SET acceptance_criteria = 'ok', design_approved_at = now(), design_approved_by = ${world.people.lead}, status = 'ready', published_at = now() WHERE id = ${story.id}`
    return story
  }

  describe('create and edit', () => {
    test('the PM and the tech lead create planned sprints, listed by start date', async () => {
      const scope = await freshProject()
      const later = await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'Later', startsOn: days(15), endsOn: days(28) }))
      const first = await createSprint(world.db, scope, world.as('lead'), sprintInput({ name: 'First', goal: 'Ship checkout' }))
      expect(first).toMatchObject({ name: 'First', goal: 'Ship checkout', status: 'planned', startsOn: days(0), endsOn: days(14), startedAt: null })
      expect((await listSprints(world.db, scope, world.as('plain'))).map((sprint) => sprint.name)).toEqual(['First', 'Later'])
      expect(later.status).toBe('planned')
    })

    test('a member without a say, a viewer, and an AI agent key do not create sprints', async () => {
      const scope = await freshProject()
      await world.rejectsWith(() => createSprint(world.db, scope, world.as('dev'), sprintInput()), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => createSprint(world.db, scope, world.as('plain'), sprintInput()), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => createSprint(world.db, scope, world.as('viewer'), sprintInput()), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => createSprint(world.db, scope, world.agent('pm'), sprintInput()), 'ISSUE_AGENT_FORBIDDEN')
    })

    test('a sprint has a name and lasts from one day to four weeks', async () => {
      const scope = await freshProject()
      const bad = (extra: Record<string, unknown>) => world.rejectsWith(() => createSprint(world.db, scope, world.as('pm'), sprintInput(extra) as never), 'SPRINT_INPUT_INVALID')
      await bad({ name: '  ' })
      await bad({ name: 'x'.repeat(101) })
      await bad({ goal: 'x'.repeat(1001) })
      await bad({ endsOn: days(0) })
      await bad({ endsOn: days(-1) })
      await bad({ endsOn: days(29) })
      await bad({ startsOn: 'soon' })
      await bad({ startsOn: '2026-02-30', endsOn: '2026-03-10' })
      await bad({ startsOn: '2026-03-01', endsOn: '2026-04-31' })
      await createSprint(world.db, scope, world.as('pm'), sprintInput({ endsOn: days(28) }))
    })

    test('a planned or active sprint can be edited, and a closed one cannot', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const edited = await updateSprint(world.db, scope, world.as('lead'), sprint.id, { name: 'Renamed', goal: 'New goal', endsOn: days(7) })
      expect(edited).toMatchObject({ name: 'Renamed', goal: 'New goal', endsOn: days(7) })
      await world.rejectsWith(() => updateSprint(world.db, scope, world.as('pm'), sprint.id, { endsOn: days(40) }), 'SPRINT_INPUT_INVALID')
      await world.rejectsWith(() => updateSprint(world.db, scope, world.as('dev'), sprint.id, { name: 'No' }), 'ROLE_NOT_ALLOWED')
      await startSprint(world.db, scope, world.as('pm'), sprint.id)
      await updateSprint(world.db, scope, world.as('pm'), sprint.id, { goal: 'Still editable' })
      await closeSprint(world.db, scope, world.as('pm'), sprint.id, { carryTo: 'backlog' })
      await world.rejectsWith(() => updateSprint(world.db, scope, world.as('pm'), sprint.id, { name: 'Late' }), 'SPRINT_NOT_EDITABLE')
      await world.rejectsWith(() => updateSprint(world.db, scope, world.as('pm'), randomUUID(), { name: 'Ghost' }), 'SPRINT_NOT_FOUND')
    })
  })

  describe('items', () => {
    test('a task or bug with points enters a sprint, and one without points does not', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const task = await work(scope, 'task')
      const bug = await work(scope, 'bug')
      const unestimated = await work(scope, 'task', null)
      await addSprintItem(world.db, scope, world.as('pm'), sprint.id, task.id)
      await addSprintItem(world.db, scope, world.as('lead'), sprint.id, bug.key)
      expect((await getIssue(world.db, scope, world.as('pm'), task.id)).sprintId).toBe(sprint.id)
      await expect(addSprintItem(world.db, scope, world.as('pm'), sprint.id, unestimated.id)).rejects.toMatchObject({
        code: 'SPRINT_ITEM_NOT_READY',
        details: { missing: ['points'] },
      })
    })

    test('a story must be Ready and have points', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const notReady = await createIssue(world.db, scope, world.as('lead'), { type: 'story', title: 'Not ready', points: 3 })
      await world.db`UPDATE issues SET published_at = now() WHERE id = ${notReady.id}`
      await expect(addSprintItem(world.db, scope, world.as('pm'), sprint.id, notReady.id)).rejects.toMatchObject({ code: 'SPRINT_ITEM_NOT_READY', details: { missing: ['status'] } })
      const noPoints = await readyStory(scope, null)
      await expect(addSprintItem(world.db, scope, world.as('pm'), sprint.id, noPoints.id)).rejects.toMatchObject({ details: { missing: ['points'] } })
      await addSprintItem(world.db, scope, world.as('pm'), sprint.id, (await readyStory(scope)).id)
    })

    test('the PM can override the gate with a reason that is kept, and the tech lead cannot', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const story = await createIssue(world.db, scope, world.as('lead'), { type: 'story', title: 'Urgent' })
      await world.db`UPDATE issues SET published_at = now(), status = 'in_design' WHERE id = ${story.id}`
      await world.rejectsWith(() => addSprintItem(world.db, scope, world.as('pm'), sprint.id, story.id, { overrideReason: '   ' }), 'SPRINT_ITEM_NOT_READY')
      await world.rejectsWith(() => addSprintItem(world.db, scope, world.as('lead'), sprint.id, story.id, { overrideReason: 'Customer asked' }), 'ROLE_NOT_ALLOWED')
      await addSprintItem(world.db, scope, world.as('pm'), sprint.id, story.id, { overrideReason: 'Customer asked' })
      expect((await events(sprint.id)).map((event) => [event.action, event.override_reason])).toEqual([['added', 'Customer asked']])
    })

    test('an override reason does nothing when the gate is already met', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const task = await work(scope, 'task')
      await addSprintItem(world.db, scope, world.as('lead'), sprint.id, task.id, { overrideReason: 'Not needed' })
      expect((await events(sprint.id))[0].override_reason).toBeNull()
    })

    test('an epic, a sub-task, a draft, and a finished item cannot enter a sprint', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const epic = await createIssue(world.db, scope, world.as('pm'), { type: 'epic', title: 'E' })
      const parent = await work(scope, 'task')
      const sub = await createIssue(world.db, scope, world.as('lead'), { type: 'subtask', title: 'S', parentId: parent.id, role: 'backend' })
      const draft = await createIssue(world.db, scope, world.agent('pm'), { type: 'task', title: 'Draft', points: 2 })
      const done = await work(scope, 'task')
      await updateIssue(world.db, scope, world.as('pm'), done.id, { status: 'done' })
      for (const issue of [epic, sub, draft, done]) {
        await world.rejectsWith(() => addSprintItem(world.db, scope, world.as('pm'), sprint.id, issue.id), 'ISSUE_INPUT_INVALID')
      }
    })

    test('an item moves between planned sprints and back to the backlog, and each step is recorded', async () => {
      const scope = await freshProject()
      const [a, b] = [await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'A' })), await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'B', startsOn: days(15), endsOn: days(29) }))]
      const task = await work(scope, 'task')
      await addSprintItem(world.db, scope, world.as('pm'), a.id, task.id)
      await addSprintItem(world.db, scope, world.as('pm'), b.id, task.id)
      expect((await getIssue(world.db, scope, world.as('pm'), task.id)).sprintId).toBe(b.id)
      expect((await events(a.id)).map((event) => event.action)).toEqual(['added', 'removed'])
      await removeSprintItem(world.db, scope, world.as('pm'), b.id, task.id)
      expect((await getIssue(world.db, scope, world.as('pm'), task.id)).sprintId).toBeNull()
      await world.rejectsWith(() => removeSprintItem(world.db, scope, world.as('pm'), b.id, task.id), 'ISSUE_INPUT_INVALID')
    })

    test('only the PM and the tech lead plan a sprint, and an AI agent key does not', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const task = await work(scope, 'task')
      await world.rejectsWith(() => addSprintItem(world.db, scope, world.as('dev'), sprint.id, task.id), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => addSprintItem(world.db, scope, world.agent('pm'), sprint.id, task.id), 'ISSUE_AGENT_FORBIDDEN')
      await world.rejectsWith(() => removeSprintItem(world.db, scope, world.as('qa'), sprint.id, task.id), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => addSprintItem(world.db, scope, world.as('pm'), randomUUID(), task.id), 'SPRINT_NOT_FOUND')
    })
  })

  describe('start and close', () => {
    test('starting a sprint commits its items and allows only one active sprint', async () => {
      const scope = await freshProject()
      const [one, two] = [await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'One' })), await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'Two', startsOn: days(15), endsOn: days(29) }))]
      const [a, b] = [await work(scope, 'task', 3), await work(scope, 'bug', 8)]
      await addSprintItem(world.db, scope, world.as('pm'), one.id, a.id)
      await addSprintItem(world.db, scope, world.as('pm'), one.id, b.id)
      const started = await startSprint(world.db, scope, world.as('lead'), one.id)
      expect(started.status).toBe('active')
      expect(started.startedAt).not.toBeNull()
      const committed = (await events(one.id)).filter((event) => event.action === 'committed')
      expect(committed.map((event) => event.points_after).sort()).toEqual([3, 8])
      expect(committed.every((event) => !event.after_start)).toBe(true)
      await world.rejectsWith(() => startSprint(world.db, scope, world.as('pm'), two.id), 'SPRINT_ALREADY_ACTIVE')
      await world.rejectsWith(() => startSprint(world.db, scope, world.as('pm'), one.id), 'SPRINT_NOT_EDITABLE')
      await world.rejectsWith(() => startSprint(world.db, scope, world.as('dev'), two.id), 'ROLE_NOT_ALLOWED')
    })

    test('two sprints started at the same moment leave one active', async () => {
      const scope = await freshProject()
      const [one, two] = [await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'One' })), await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'Two', startsOn: days(15), endsOn: days(29) }))]
      const results = await Promise.allSettled([startSprint(world.db, scope, world.as('pm'), one.id), startSprint(world.db, scope, world.as('lead'), two.id)])
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
      const failed = results.find((result) => result.status === 'rejected') as PromiseRejectedResult
      expect(failed.reason).toMatchObject({ code: 'SPRINT_ALREADY_ACTIVE' })
      expect((await listSprints(world.db, scope, world.as('pm'))).filter((sprint) => sprint.status === 'active')).toHaveLength(1)
    })

    test('items added to or removed from a running sprint are marked as after the start', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      await startSprint(world.db, scope, world.as('pm'), sprint.id)
      const task = await work(scope, 'task')
      await addSprintItem(world.db, scope, world.as('pm'), sprint.id, task.id)
      await removeSprintItem(world.db, scope, world.as('pm'), sprint.id, task.id)
      expect((await events(sprint.id)).map((event) => [event.action, event.after_start])).toEqual([
        ['added', true],
        ['removed', true],
      ])
    })

    test('a points change on an item in a sprint is recorded, and one outside a sprint is not', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const inside = await work(scope, 'task', 3)
      const outside = await work(scope, 'task', 3)
      await addSprintItem(world.db, scope, world.as('pm'), sprint.id, inside.id)
      await updateIssue(world.db, scope, world.as('plain'), inside.id, { points: 5 })
      await startSprint(world.db, scope, world.as('pm'), sprint.id)
      await updateIssue(world.db, scope, world.as('plain'), inside.id, { points: 8 })
      await updateIssue(world.db, scope, world.as('plain'), inside.id, { points: 8 })
      await updateIssue(world.db, scope, world.as('plain'), outside.id, { points: 13 })
      const changes = (await events(sprint.id)).filter((event) => event.action === 'points_changed')
      expect(changes.map((event) => [event.points_before, event.points_after, event.after_start])).toEqual([
        [3, 5, false],
        [5, 8, true],
      ])
    })

    test('closing carries unfinished items to the next sprint, and finished ones stay', async () => {
      const scope = await freshProject()
      const [one, two] = [await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'One' })), await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'Two', startsOn: days(15), endsOn: days(29) }))]
      const [finished, unfinished] = [await work(scope, 'task'), await work(scope, 'task')]
      await addSprintItem(world.db, scope, world.as('pm'), one.id, finished.id)
      await addSprintItem(world.db, scope, world.as('pm'), one.id, unfinished.id)
      await startSprint(world.db, scope, world.as('pm'), one.id)
      await updateIssue(world.db, scope, world.as('pm'), finished.id, { status: 'done' })
      const closed = await closeSprint(world.db, scope, world.as('lead'), one.id, { carryTo: two.id })
      expect(closed.status).toBe('closed')
      expect(closed.closedAt).not.toBeNull()
      expect((await getIssue(world.db, scope, world.as('pm'), finished.id)).sprintId).toBe(one.id)
      expect((await getIssue(world.db, scope, world.as('pm'), unfinished.id)).sprintId).toBe(two.id)
      expect((await events(one.id)).filter((event) => event.action === 'carried_over')).toHaveLength(1)
      await startSprint(world.db, scope, world.as('pm'), two.id)
    })

    test('closing can send unfinished items back to the backlog', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const task = await work(scope, 'task')
      await addSprintItem(world.db, scope, world.as('pm'), sprint.id, task.id)
      await startSprint(world.db, scope, world.as('pm'), sprint.id)
      await closeSprint(world.db, scope, world.as('pm'), sprint.id, { carryTo: 'backlog' })
      expect((await getIssue(world.db, scope, world.as('pm'), task.id)).sprintId).toBeNull()
    })

    test('only an active sprint closes, and it must say where unfinished items go', async () => {
      const scope = await freshProject()
      const [one, two] = [await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'One' })), await createSprint(world.db, scope, world.as('pm'), sprintInput({ name: 'Two', startsOn: days(15), endsOn: days(29) }))]
      await world.rejectsWith(() => closeSprint(world.db, scope, world.as('pm'), one.id, { carryTo: 'backlog' }), 'SPRINT_NOT_EDITABLE')
      await startSprint(world.db, scope, world.as('pm'), one.id)
      const close = (carryTo: unknown) => () => closeSprint(world.db, scope, world.as('pm'), one.id, { carryTo } as never)
      await world.rejectsWith(close(undefined), 'SPRINT_INPUT_INVALID')
      await world.rejectsWith(close(one.id), 'SPRINT_INPUT_INVALID')
      await world.rejectsWith(close(randomUUID()), 'SPRINT_INPUT_INVALID')
      await world.rejectsWith(() => closeSprint(world.db, scope, world.as('dev'), one.id, { carryTo: two.id }), 'ROLE_NOT_ALLOWED')
      await closeSprint(world.db, scope, world.as('pm'), one.id, { carryTo: two.id })
      await world.rejectsWith(close(two.id), 'SPRINT_NOT_EDITABLE')
    })

    test('a closed sprint takes no new items and gives none up', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, world.as('pm'), sprintInput())
      const task = await work(scope, 'task')
      await addSprintItem(world.db, scope, world.as('pm'), sprint.id, task.id)
      await startSprint(world.db, scope, world.as('pm'), sprint.id)
      await closeSprint(world.db, scope, world.as('pm'), sprint.id, { carryTo: 'backlog' })
      const other = await work(scope, 'task')
      await world.rejectsWith(() => addSprintItem(world.db, scope, world.as('pm'), sprint.id, other.id), 'SPRINT_NOT_EDITABLE')
      await world.rejectsWith(() => removeSprintItem(world.db, scope, world.as('pm'), sprint.id, task.id), 'SPRINT_NOT_EDITABLE')
    })
  })
})
