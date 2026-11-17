import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { decodeCursor } from '@/lib/pagination'
import { readBacklog } from '@/services/issue-backlog'
import { createIssue, listIssuePage, updateIssue } from '@/services/issues'
import { addSprintItem, closeSprint, createSprint, startSprint } from '@/services/sprints'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'

describe.skipIf(!databaseEnabled)('reading the backlog and listing issues', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  async function freshProject() {
    const id = randomUUID()
    const key = `RD${randomUUID().replace(/[^a-f]/g, '').toUpperCase().slice(0, 6).padEnd(4, 'Z')}`
    await world.db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${world.workspaceId}, ${key}, ${world.ownerId}, ${key})`
    await world.db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${id}, ${world.people.pm}, 'pm'), (${id}, ${world.people.lead}, 'tech_lead')`
    return { workspaceId: world.workspaceId, projectId: id }
  }
  const day = (offset: number) => new Date(Date.UTC(2026, 6, 1 + offset)).toISOString().slice(0, 10)
  const titles = (items: Array<{ title: string }>) => items.map((item) => item.title)

  // Sprint One holds t1 and t2 and Sprint Two holds t3. The backlog is t4, a bug, and a draft story. d1 is done and loose.
  async function seed() {
    const scope = await freshProject()
    const make = (type: 'task' | 'bug' | 'story', title: string) => createIssue(world.db, scope, world.as('lead'), { type, title, points: 3 })
    const [t1, t2, t3, t4] = [await make('task', 't1'), await make('task', 't2'), await make('task', 't3'), await make('task', 't4')]
    const bug = await make('bug', 'b1')
    await make('story', 'draft story')
    const done = await make('task', 'd1')
    await updateIssue(world.db, scope, world.as('pm'), done.id, { status: 'done' })
    const one = await createSprint(world.db, scope, world.as('pm'), { name: 'Sprint One', startsOn: day(0), endsOn: day(14) })
    const two = await createSprint(world.db, scope, world.as('pm'), { name: 'Sprint Two', startsOn: day(15), endsOn: day(29) })
    await addSprintItem(world.db, scope, world.as('pm'), one.id, t2.id)
    await addSprintItem(world.db, scope, world.as('pm'), one.id, t1.id)
    await addSprintItem(world.db, scope, world.as('pm'), two.id, t3.id)
    return { scope, one, two, t4, bug }
  }

  test('the backlog lists the open sprints with their items, then the loose items, all by rank', async () => {
    const { scope } = await seed()
    const result = await readBacklog(world.db, scope, world.as('pm'), { limit: 100, cursor: null })
    expect(result.sprints.map((sprint) => sprint.name)).toEqual(['Sprint One', 'Sprint Two'])
    expect(titles(result.sprints[0].issues)).toEqual(['t1', 't2'])
    expect(titles(result.sprints[1].issues)).toEqual(['t3'])
    expect(titles(result.backlog.items)).toEqual(['t4', 'b1', 'draft story'])
    expect(result.backlog.nextCursor).toBeNull()
  })

  test('a member who may not read drafts does not see them, and finished loose items are left out', async () => {
    const { scope } = await seed()
    const result = await readBacklog(world.db, scope, world.as('plain'), { limit: 100, cursor: null })
    expect(titles(result.backlog.items)).toEqual(['t4', 'b1'])
  })

  test('a closed sprint is not listed, and its unfinished items are in the next sprint or the backlog', async () => {
    const { scope, one, two } = await seed()
    await startSprint(world.db, scope, world.as('pm'), one.id)
    await closeSprint(world.db, scope, world.as('pm'), one.id, { carryTo: two.id })
    const result = await readBacklog(world.db, scope, world.as('pm'), { limit: 100, cursor: null })
    expect(result.sprints.map((sprint) => sprint.name)).toEqual(['Sprint Two'])
    expect(titles(result.sprints[0].issues).sort()).toEqual(['t1', 't2', 't3'])
  })

  test('the loose items come in pages, and the pages add up to the whole backlog', async () => {
    const { scope } = await seed()
    const first = await readBacklog(world.db, scope, world.as('pm'), { limit: 2, cursor: null })
    expect(titles(first.backlog.items)).toEqual(['t4', 'b1'])
    expect(first.backlog.nextCursor).not.toBeNull()
    const second = await readBacklog(world.db, scope, world.as('pm'), { limit: 2, cursor: decodeCursor(first.backlog.nextCursor) })
    expect(titles(second.backlog.items)).toEqual(['draft story'])
    expect(second.backlog.nextCursor).toBeNull()
  })

  test('a cursor from another list is refused', async () => {
    const { scope } = await seed()
    await world.rejectsWith(() => readBacklog(world.db, scope, world.as('pm'), { limit: 2, cursor: { x: 'y' } }), 'PAGINATION_INVALID')
  })

  test('the issue list is paged by number, filtered by type, and hides drafts from other members', async () => {
    const { scope } = await seed()
    const all = await listIssuePage(world.db, scope, world.as('pm'), {}, { limit: 100, cursor: null })
    expect(all.items.map((issue) => issue.number)).toEqual([...all.items.map((issue) => issue.number)].sort((a, b) => a - b))
    expect(titles(all.items)).toEqual(['t1', 't2', 't3', 't4', 'b1', 'draft story', 'd1'])
    const first = await listIssuePage(world.db, scope, world.as('pm'), {}, { limit: 3, cursor: null })
    const second = await listIssuePage(world.db, scope, world.as('pm'), {}, { limit: 3, cursor: decodeCursor(first.nextCursor) })
    expect(titles([...first.items, ...second.items])).toEqual(['t1', 't2', 't3', 't4', 'b1', 'draft story'])
    expect(titles((await listIssuePage(world.db, scope, world.as('plain'), {}, { limit: 100, cursor: null })).items)).not.toContain('draft story')
    expect(titles((await listIssuePage(world.db, scope, world.as('pm'), { type: 'bug' }, { limit: 100, cursor: null })).items)).toEqual(['b1'])
  })
})
