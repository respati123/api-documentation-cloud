import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { readBacklog } from '@/services/issue-backlog'
import { createIssue, updateIssue } from '@/services/issues'
import { getFlowMetrics, listWipLimits, setWipLimit } from '@/services/kanban'
import { updateProjectSettings } from '@/services/project-settings'
import { addSprintItem, closeSprint, createSprint, listSprints, startSprint, updateSprint } from '@/services/sprints'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'

describe.skipIf(!databaseEnabled)('kanban mode', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  async function freshProject() {
    const id = randomUUID()
    const key = `KB${randomUUID().replace(/[^a-f]/g, '').toUpperCase().slice(0, 6).padEnd(4, 'Z')}`
    await world.db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${world.workspaceId}, ${key}, ${world.ownerId}, ${key})`
    await world.db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${id}, ${world.people.pm}, 'pm'), (${id}, ${world.people.lead}, 'tech_lead')`
    return { workspaceId: world.workspaceId, projectId: id }
  }
  const pm = () => world.as('pm')
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
  const kanban = (scope: { workspaceId: string; projectId: string }) => updateProjectSettings(world.db, scope, pm(), { mode: 'kanban' })

  describe('the mode', () => {
    test('a Kanban project refuses every change to a sprint, but still lists them', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, pm(), { name: 'Before', startsOn: day(0), endsOn: day(7) })
      await kanban(scope)
      const refused = (run: () => Promise<unknown>) => world.rejectsWith(run, 'SPRINT_NOT_AVAILABLE')
      await refused(() => createSprint(world.db, scope, pm(), { name: 'No', startsOn: day(0), endsOn: day(7) }))
      await refused(() => updateSprint(world.db, scope, pm(), sprint.id, { name: 'No' }))
      await refused(() => startSprint(world.db, scope, pm(), sprint.id))
      await refused(() => closeSprint(world.db, scope, pm(), sprint.id, { carryTo: 'backlog' }))
      const task = await createIssue(world.db, scope, pm(), { type: 'task', title: 'T', points: 2 })
      await refused(() => addSprintItem(world.db, scope, pm(), sprint.id, task.id))
      expect((await listSprints(world.db, scope, world.as('plain'))).map((item) => item.name)).toEqual(['Before'])
    })

    test('the backlog of a Kanban project has no sprints, only the ranked items', async () => {
      const scope = await freshProject()
      await createSprint(world.db, scope, pm(), { name: 'Hidden', startsOn: day(0), endsOn: day(7) })
      await createIssue(world.db, scope, pm(), { type: 'task', title: 'Loose', points: 1 })
      await kanban(scope)
      const result = await readBacklog(world.db, scope, pm(), { limit: 100, cursor: null })
      expect(result.sprints).toEqual([])
      expect(result.backlog.items.map((item) => item.title)).toEqual(['Loose'])
    })

    test('an item left in a planned sprint when the project goes to Kanban stays in the backlog', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, pm(), { name: 'Planned', startsOn: day(0), endsOn: day(7) })
      const planned = await createIssue(world.db, scope, pm(), { type: 'task', title: 'In a plan', points: 2 })
      await addSprintItem(world.db, scope, pm(), sprint.id, planned.id)
      await createIssue(world.db, scope, pm(), { type: 'task', title: 'Loose', points: 1 })
      await kanban(scope)
      const result = await readBacklog(world.db, scope, pm(), { limit: 100, cursor: null })
      expect(result.backlog.items.map((item) => item.title).sort()).toEqual(['In a plan', 'Loose'])
    })

    test('a project cannot go to Kanban while a sprint is running, and can go back to Scrum', async () => {
      const scope = await freshProject()
      const sprint = await createSprint(world.db, scope, pm(), { name: 'Running', startsOn: day(0), endsOn: day(7) })
      await startSprint(world.db, scope, pm(), sprint.id)
      await world.rejectsWith(() => kanban(scope), 'SPRINT_RUNNING')
      await closeSprint(world.db, scope, pm(), sprint.id, { carryTo: 'backlog' })
      expect((await kanban(scope)).mode).toBe('kanban')
      expect((await updateProjectSettings(world.db, scope, pm(), { mode: 'scrum' })).mode).toBe('scrum')
      await createSprint(world.db, scope, pm(), { name: 'Again', startsOn: day(8), endsOn: day(15) })
    })
  })

  describe('limits on the columns', () => {
    test('the PM sets, changes, and removes a limit, and the list follows', async () => {
      const scope = await freshProject()
      expect(await setWipLimit(world.db, scope, pm(), 'in_progress', 3)).toEqual([{ status: 'in_progress', limit: 3 }])
      await setWipLimit(world.db, scope, world.as('lead'), 'in_review', 2)
      await setWipLimit(world.db, scope, pm(), 'in_progress', 5)
      expect(await listWipLimits(world.db, scope, world.as('plain'))).toEqual([
        { status: 'in_progress', limit: 5 },
        { status: 'in_review', limit: 2 },
      ])
      expect(await setWipLimit(world.db, scope, pm(), 'in_review', null)).toEqual([{ status: 'in_progress', limit: 5 }])
    })

    test('a limit is a whole number from 1 to 100 on a column that is not the end of the flow', async () => {
      const scope = await freshProject()
      for (const limit of [0, 101, 1.5, -2]) await world.rejectsWith(() => setWipLimit(world.db, scope, pm(), 'in_progress', limit), 'PROJECT_INPUT_INVALID')
      for (const status of ['done', 'nonsense', '']) await world.rejectsWith(() => setWipLimit(world.db, scope, pm(), status, 2), 'PROJECT_INPUT_INVALID')
    })

    test('only the PM and the tech lead set limits, and an AI agent key does not', async () => {
      const scope = await freshProject()
      await world.rejectsWith(() => setWipLimit(world.db, scope, world.as('plain'), 'in_progress', 2), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => setWipLimit(world.db, scope, world.as('viewer'), 'in_progress', 2), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => setWipLimit(world.db, scope, world.agent('pm'), 'in_progress', 2), 'ISSUE_AGENT_FORBIDDEN')
      await world.rejectsWith(() => listWipLimits(world.db, scope, world.as('outsider')), 'WORKSPACE_NOT_FOUND')
    })
  })

  describe('flow metrics', () => {
    // Five tasks made 10 days ago. t1 started 4 days ago, t2 and t5 are in review since yesterday, t3 ran from 5 days to
    // 2 days ago and is done, t4 has not started.
    async function seededFlow() {
      const scope = await freshProject()
      const make = async (title: string) => {
        const issue = await createIssue(world.db, scope, pm(), { type: 'task', title })
        await world.db`UPDATE issues SET created_at = now() - interval '10 days' WHERE id = ${issue.id}`
        return issue
      }
      const [t1, t2, t3, t4, t5] = [await make('t1'), await make('t2'), await make('t3'), await make('t4'), await make('t5')]
      const move = (id: string, status: string) => updateIssue(world.db, scope, pm(), id, { status })
      await move(t1.id, 'in_progress')
      await move(t2.id, 'in_review')
      await move(t5.id, 'in_review')
      await move(t3.id, 'in_progress')
      await move(t3.id, 'done')
      const ago = (id: string, status: string, days: number) =>
        world.db`UPDATE issue_status_events SET created_at = now() - make_interval(days => ${days}) WHERE issue_id = ${id} AND to_status = ${status}`
      await ago(t1.id, 'in_progress', 4)
      await ago(t2.id, 'in_review', 1)
      await ago(t5.id, 'in_review', 1)
      await ago(t3.id, 'in_progress', 5)
      await ago(t3.id, 'done', 2)
      return { scope, t1, t2, t3, t4, t5 }
    }

    test('work in progress is counted per column against its limit, and a column over its limit says so', async () => {
      const { scope } = await seededFlow()
      await setWipLimit(world.db, scope, pm(), 'in_review', 1)
      await setWipLimit(world.db, scope, pm(), 'in_progress', 3)
      const { wip } = await getFlowMetrics(world.db, scope, world.as('plain'))
      expect(wip.total).toBe(3)
      expect(wip.byStatus.find((column) => column.status === 'in_review')).toEqual({ status: 'in_review', count: 2, limit: 1, over: true })
      expect(wip.byStatus.find((column) => column.status === 'in_progress')).toEqual({ status: 'in_progress', count: 1, limit: 3, over: false })
    })

    test('throughput counts the items finished in the window, by day', async () => {
      const { scope } = await seededFlow()
      const { throughput, days } = await getFlowMetrics(world.db, scope, pm())
      expect(days).toBe(30)
      expect(throughput.total).toBe(1)
      expect(throughput.perDay).toHaveLength(30)
      expect(throughput.perDay.find((entry) => entry.date === day(-2))).toEqual({ date: day(-2), done: 1 })
    })

    test('cycle time runs from the first start to done', async () => {
      const { scope } = await seededFlow()
      const { cycleTime } = await getFlowMetrics(world.db, scope, pm())
      expect(cycleTime).toMatchObject({ count: 1, average: 3, median: 3, p85: 3 })
    })

    test('the oldest open items come first with their age', async () => {
      const { scope, t1 } = await seededFlow()
      const { workItemAge } = await getFlowMetrics(world.db, scope, pm())
      expect(workItemAge.oldest).toHaveLength(3)
      expect(workItemAge.oldest[0]).toMatchObject({ id: t1.id, key: t1.key, title: 't1' })
      expect(workItemAge.oldest[0].ageDays).toBeGreaterThan(3.9)
      expect(workItemAge.oldest[0].ageDays).toBeLessThan(4.1)
      expect(workItemAge.oldest[2].ageDays).toBeLessThan(1.1)
    })

    test('the cumulative flow follows the items through the columns, and ends on what is true today', async () => {
      const { scope } = await seededFlow()
      const { cumulativeFlow } = await getFlowMetrics(world.db, scope, pm(), { days: 14 })
      expect(cumulativeFlow).toHaveLength(14)
      expect(cumulativeFlow.at(-1)).toEqual({ date: day(0), todo: 1, in_progress: 3, done: 1 })
      expect(cumulativeFlow.find((entry) => entry.date === day(-6))).toMatchObject({ todo: 5, in_progress: 0, done: 0 })
      expect(cumulativeFlow.find((entry) => entry.date === day(-3))).toMatchObject({ todo: 3, in_progress: 2, done: 0 })
    })

    test('the window is kept between 7 and 90 days, and a member reads it', async () => {
      const scope = await freshProject()
      expect((await getFlowMetrics(world.db, scope, pm(), { days: 1 })).days).toBe(7)
      expect((await getFlowMetrics(world.db, scope, pm(), { days: 365 })).days).toBe(90)
      expect((await getFlowMetrics(world.db, scope, world.as('viewer'))).cycleTime.count).toBe(0)
      await world.rejectsWith(() => getFlowMetrics(world.db, scope, world.as('outsider')), 'WORKSPACE_NOT_FOUND')
    })

    test('drafts are left out of the numbers', async () => {
      const scope = await freshProject()
      await createIssue(world.db, scope, world.agent('pm'), { type: 'task', title: 'Agent draft' })
      const { cumulativeFlow } = await getFlowMetrics(world.db, scope, pm())
      expect(cumulativeFlow.at(-1)).toEqual({ date: day(0), todo: 0, in_progress: 0, done: 0 })
    })
  })
})
