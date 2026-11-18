import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { createIssue, updateIssue } from '@/services/issues'
import { getBurndown, getSprintReport, getVelocity } from '@/services/reports'
import { addSprintItem, closeSprint, createSprint, startSprint } from '@/services/sprints'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'

describe.skipIf(!databaseEnabled)('sprint reports', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  async function freshProject() {
    const id = randomUUID()
    const key = `RP${randomUUID().replace(/[^a-f]/g, '').toUpperCase().slice(0, 6).padEnd(4, 'Z')}`
    await world.db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${world.workspaceId}, ${key}, ${world.ownerId}, ${key})`
    await world.db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${id}, ${world.people.pm}, 'pm'), (${id}, ${world.people.lead}, 'tech_lead')`
    return { workspaceId: world.workspaceId, projectId: id }
  }
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
  const pm = () => world.as('pm')

  async function task(scope: { workspaceId: string; projectId: string }, title: string, points: number) {
    return createIssue(world.db, scope, world.as('lead'), { type: 'task', title, points })
  }

  // Sprint with tasks A (5) and B (3). B is done, C (2) is added after the start, and A is re-estimated to 8.
  async function runningSprint() {
    const scope = await freshProject()
    const sprint = await createSprint(world.db, scope, pm(), { name: 'Sprint', startsOn: day(0), endsOn: day(6) })
    const [a, b, c] = [await task(scope, 'A', 5), await task(scope, 'B', 3), await task(scope, 'C', 2)]
    await addSprintItem(world.db, scope, pm(), sprint.id, a.id)
    await addSprintItem(world.db, scope, pm(), sprint.id, b.id)
    await startSprint(world.db, scope, pm(), sprint.id)
    await updateIssue(world.db, scope, pm(), b.id, { status: 'done' })
    await addSprintItem(world.db, scope, pm(), sprint.id, c.id)
    await updateIssue(world.db, scope, world.as('plain'), a.id, { points: 8 })
    return { scope, sprint, a, b, c }
  }

  test('the burndown starts at the committed points and shows what is left today', async () => {
    const { scope, sprint } = await runningSprint()
    const result = await getBurndown(world.db, scope, world.as('plain'), sprint.id)
    expect(result.total).toBe(8)
    expect(result.days).toHaveLength(7)
    expect(result.days[0]).toMatchObject({ date: day(0), ideal: 8, remaining: 10 })
    expect(result.days[6]).toMatchObject({ date: day(6), ideal: 0, remaining: null })
    expect(result.days[3].remaining).toBeNull()
  })

  test('the report of a closed sprint lists what was finished, left over, added, and re-estimated', async () => {
    const { scope, sprint, a, b, c } = await runningSprint()
    await closeSprint(world.db, scope, pm(), sprint.id, { carryTo: 'backlog' })
    const report = await getSprintReport(world.db, scope, world.as('plain'), sprint.id)
    expect(report.committedPoints).toBe(8)
    expect(report.completedPoints).toBe(3)
    expect(report.completed.map((item) => item.id)).toEqual([b.id])
    expect(report.notCompleted.map((item) => item.id).sort()).toEqual([a.id, c.id].sort())
    expect(report.addedAfterStart.map((item) => item.id)).toEqual([c.id])
    expect(report.pointsChanged.map((item) => ({ id: item.id, before: item.before, after: item.after }))).toEqual([{ id: a.id, before: 5, after: 8 }])
    expect(report.completed[0]).toMatchObject({ key: b.key, title: 'B', type: 'task', points: 3 })
    expect(report.sprint).toMatchObject({ id: sprint.id, status: 'closed' })
  })

  test('the report of a running sprint shows its open items as not completed', async () => {
    const { scope, sprint, a, c } = await runningSprint()
    const report = await getSprintReport(world.db, scope, pm(), sprint.id)
    expect(report.notCompleted.map((item) => item.id).sort()).toEqual([a.id, c.id].sort())
    expect(report.removedAfterStart).toEqual([])
  })

  test('velocity lists the closed sprints oldest first, with the average completed', async () => {
    const scope = await freshProject()
    const run = async (name: string, startsOn: string, endsOn: string, points: number) => {
      const sprint = await createSprint(world.db, scope, pm(), { name, startsOn, endsOn })
      const item = await task(scope, name, points)
      await addSprintItem(world.db, scope, pm(), sprint.id, item.id)
      await startSprint(world.db, scope, pm(), sprint.id)
      await updateIssue(world.db, scope, pm(), item.id, { status: 'done' })
      await closeSprint(world.db, scope, pm(), sprint.id, { carryTo: 'backlog' })
    }
    await run('First', day(-30), day(-16), 5)
    await run('Second', day(-15), day(-1), 8)
    const open = await createSprint(world.db, scope, pm(), { name: 'Open', startsOn: day(0), endsOn: day(14) })
    expect(open.status).toBe('planned')

    const velocity = await getVelocity(world.db, scope, world.as('plain'), 6)
    expect(velocity.sprints.map((sprint) => [sprint.name, sprint.committedPoints, sprint.completedPoints])).toEqual([
      ['First', 5, 5],
      ['Second', 8, 8],
    ])
    expect(velocity.averageCompleted).toBe(6.5)
    expect((await getVelocity(world.db, scope, world.as('plain'), 1)).sprints.map((sprint) => sprint.name)).toEqual(['Second'])
  })

  test('a project with no closed sprint has no velocity', async () => {
    expect(await getVelocity(world.db, await freshProject(), world.as('pm'), 6)).toEqual({ sprints: [], averageCompleted: 0 })
  })

  test('only a member reads the reports, and the sprint must exist', async () => {
    const { scope, sprint } = await runningSprint()
    await world.rejectsWith(() => getBurndown(world.db, scope, world.as('outsider'), sprint.id), 'WORKSPACE_NOT_FOUND')
    await world.rejectsWith(() => getSprintReport(world.db, scope, world.as('pm'), randomUUID()), 'SPRINT_NOT_FOUND')
    await world.rejectsWith(() => getVelocity(world.db, scope, world.as('outsider'), 6), 'WORKSPACE_NOT_FOUND')
    expect((await getBurndown(world.db, scope, world.as('viewer'), sprint.id)).days.length).toBeGreaterThan(0)
  })
})
