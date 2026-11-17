import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { RANK_STEP } from '@/models/issue'
import { createIssue, getIssue, listProjectIssues } from '@/services/issues'
import { publishIssue, rankIssue } from '@/services/issue-backlog'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'

describe.skipIf(!databaseEnabled)('issue backlog order and publishing', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  const task = (title: string) => createIssue(world.db, world.scope, world.as('pm'), { type: 'task', title })
  // The titles of the tasks of one test, from the top of the backlog down.
  const order = async (marker: string) =>
    (await listProjectIssues(world.db, world.scope, world.as('pm'), {})).filter((issue) => issue.title.startsWith(marker)).map((issue) => issue.title.slice(marker.length))
  const marker = () => `${randomUUID().slice(0, 8)}:`

  describe('rank', () => {
    test('an item dropped between two others sits between them', async () => {
      const m = marker()
      const [a, b, c] = [await task(`${m}A`), await task(`${m}B`), await task(`${m}C`)]
      await rankIssue(world.db, world.scope, world.as('pm'), c.id, { afterId: a.id, beforeId: b.id })
      expect(await order(m)).toEqual(['A', 'C', 'B'])
    })

    test('an item can go to the top, and to the bottom', async () => {
      const m = marker()
      const [a, b, c] = [await task(`${m}A`), await task(`${m}B`), await task(`${m}C`)]
      await rankIssue(world.db, world.scope, world.as('lead'), c.id, { beforeId: a.id })
      expect(await order(m)).toEqual(['C', 'A', 'B'])
      await rankIssue(world.db, world.scope, world.as('lead'), c.id, { afterId: b.id })
      expect(await order(m)).toEqual(['A', 'B', 'C'])
    })

    test('the backlog is renumbered when two neighbours leave no room between them', async () => {
      const m = marker()
      const [a, b, c] = [await task(`${m}A`), await task(`${m}B`), await task(`${m}C`)]
      await world.db`UPDATE issues SET rank = 5000 WHERE id = ${a.id}`
      await world.db`UPDATE issues SET rank = 5001 WHERE id = ${b.id}`
      const moved = await rankIssue(world.db, world.scope, world.as('pm'), c.id, { afterId: a.id, beforeId: b.id })
      expect(await order(m)).toEqual(['A', 'C', 'B'])
      expect(moved.rank).toBeGreaterThan(0)
      const [{ gap }] = await world.db`SELECT (SELECT rank FROM issues WHERE id = ${b.id}) - (SELECT rank FROM issues WHERE id = ${a.id}) AS gap`
      expect(Number(gap)).toBeGreaterThanOrEqual(RANK_STEP)
    })

    test('only a backlog item can be ranked, and only next to other backlog items', async () => {
      const epic = await createIssue(world.db, world.scope, world.as('pm'), { type: 'epic', title: 'E' })
      const a = await task('plain')
      const other = (input: { afterId?: string | null; beforeId?: string | null }, id = a.id) => () =>
        rankIssue(world.db, world.scope, world.as('pm'), id, input)
      await world.rejectsWith(other({ afterId: a.id }, epic.id), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(other({ afterId: epic.id }), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(other({ beforeId: a.id }), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(other({ afterId: randomUUID() }), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(other({}), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(other({ afterId: null, beforeId: null }), 'ISSUE_INPUT_INVALID')
    })

    test('only the PM and the tech lead rank, and an AI agent key does not', async () => {
      const [a, b] = [await task('x'), await task('y')]
      const rank = (actor: ReturnType<IssueWorld['as']>) => () => rankIssue(world.db, world.scope, actor, b.id, { afterId: a.id })
      await world.rejectsWith(rank(world.as('plain')), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(rank(world.as('dev')), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(rank(world.as('viewer')), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(rank(world.agent('pm')), 'ISSUE_AGENT_FORBIDDEN')
      await rank(world.as('lead'))()
    })
  })

  describe('publish', () => {
    test('the PM publishes a draft and other members can then see it', async () => {
      const story = await createIssue(world.db, world.scope, world.as('pm'), { type: 'story', title: 'Publish me' })
      await world.rejectsWith(() => getIssue(world.db, world.scope, world.as('plain'), story.id), 'ISSUE_NOT_FOUND')
      const published = await publishIssue(world.db, world.scope, world.as('pm'), story.id)
      expect(published.publishedAt).not.toBeNull()
      expect((await getIssue(world.db, world.scope, world.as('plain'), story.id)).id).toBe(story.id)
    })

    test('publishing twice keeps the first time', async () => {
      const epic = await createIssue(world.db, world.scope, world.as('lead'), { type: 'epic', title: 'Twice' })
      const first = await publishIssue(world.db, world.scope, world.as('lead'), epic.id)
      const second = await publishIssue(world.db, world.scope, world.as('pm'), epic.id)
      expect(second.publishedAt).toEqual(first.publishedAt)
    })

    test('a member without a say, a viewer, and an agent key cannot publish', async () => {
      const story = await createIssue(world.db, world.scope, world.as('pm'), { type: 'story', title: 'Not yours' })
      await world.rejectsWith(() => publishIssue(world.db, world.scope, world.as('plain'), story.id), 'ISSUE_NOT_FOUND')
      await world.rejectsWith(() => publishIssue(world.db, world.scope, world.as('viewer'), story.id), 'ISSUE_NOT_FOUND')
      const agentDraft = await createIssue(world.db, world.scope, world.agent('dev'), { type: 'bug', title: 'Agent bug' })
      await world.rejectsWith(() => publishIssue(world.db, world.scope, world.as('dev'), agentDraft.id), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => publishIssue(world.db, world.scope, world.agent('pm'), story.id), 'ISSUE_AGENT_FORBIDDEN')
    })
  })
})
