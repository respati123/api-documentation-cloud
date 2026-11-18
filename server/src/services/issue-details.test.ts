import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import {
  addChecklistItem,
  addLink,
  deleteChecklistItem,
  listChecklist,
  listLinks,
  removeLink,
  setChecklistItemDone,
} from '@/services/issue-details'
import { createIssue } from '@/services/issues'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'

describe.skipIf(!databaseEnabled)('issue checklist and links', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  const make = (type: 'epic' | 'story' | 'task' | 'bug', title: string = type, extra: Record<string, unknown> = {}) =>
    createIssue(world.db, world.scope, world.as('lead'), { type, title, ...extra })

  describe('checklist', () => {
    test('items keep the order they were added in and can be ticked and removed', async () => {
      const task = await make('task')
      const first = await addChecklistItem(world.db, world.scope, world.as('pm'), task.id, 'First')
      const second = await addChecklistItem(world.db, world.scope, world.as('pm'), task.id, 'Second')
      expect([first.position, second.position]).toEqual([1, 2])
      expect((await setChecklistItemDone(world.db, world.scope, world.as('pm'), task.id, first.id, true)).done).toBe(true)
      expect((await listChecklist(world.db, world.scope, world.as('plain'), task.id)).map((item) => [item.title, item.done])).toEqual([
        ['First', true],
        ['Second', false],
      ])
      await deleteChecklistItem(world.db, world.scope, world.as('pm'), task.id, first.id)
      expect((await listChecklist(world.db, world.scope, world.as('pm'), task.id)).map((item) => item.title)).toEqual(['Second'])
    })

    test('the assignee works on the checklist, and a member who is neither assigned nor approving does not', async () => {
      const task = await make('task', 'Assigned', { assigneeId: world.people.dev })
      const item = await addChecklistItem(world.db, world.scope, world.as('dev'), task.id, 'Mine')
      await setChecklistItemDone(world.db, world.scope, world.as('dev'), task.id, item.id, true)
      await world.rejectsWith(() => addChecklistItem(world.db, world.scope, world.as('plain'), task.id, 'No'), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => setChecklistItemDone(world.db, world.scope, world.as('qa'), task.id, item.id, false), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => addChecklistItem(world.db, world.scope, world.as('viewer'), task.id, 'No'), 'ROLE_NOT_ALLOWED')
    })

    test('a member whose role matches a sub-task works on its checklist', async () => {
      const story = await make('story')
      const sub = await createIssue(world.db, world.scope, world.as('lead'), { type: 'subtask', title: 'Backend part', parentId: story.id, role: 'backend' })
      await addChecklistItem(world.db, world.scope, world.as('dev'), sub.id, 'Write the endpoint')
      await world.rejectsWith(() => addChecklistItem(world.db, world.scope, world.as('qa'), sub.id, 'Not my part'), 'ROLE_NOT_ALLOWED')
    })

    test('a title is 1 to 300 characters', async () => {
      const task = await make('task')
      await world.rejectsWith(() => addChecklistItem(world.db, world.scope, world.as('pm'), task.id, '  '), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(() => addChecklistItem(world.db, world.scope, world.as('pm'), task.id, 'x'.repeat(301)), 'ISSUE_INPUT_INVALID')
    })

    test('an item is reached only through its own issue', async () => {
      const [a, b] = [await make('task', 'A'), await make('task', 'B')]
      const item = await addChecklistItem(world.db, world.scope, world.as('pm'), a.id, 'Of A')
      await world.rejectsWith(() => setChecklistItemDone(world.db, world.scope, world.as('pm'), b.id, item.id, true), 'ISSUE_NOT_FOUND')
      await world.rejectsWith(() => deleteChecklistItem(world.db, world.scope, world.as('pm'), a.id, randomUUID()), 'ISSUE_NOT_FOUND')
    })

    test('an AI agent key works only on an issue assigned to its owner', async () => {
      const mine = await make('task', 'Mine', { assigneeId: world.people.pm })
      const theirs = await make('task', 'Theirs', { assigneeId: world.people.dev })
      const item = await addChecklistItem(world.db, world.scope, world.agent('pm'), mine.id, 'By agent')
      await setChecklistItemDone(world.db, world.scope, world.agent('pm'), mine.id, item.id, true)
      await world.rejectsWith(() => addChecklistItem(world.db, world.scope, world.agent('pm'), theirs.id, 'No'), 'ISSUE_AGENT_FORBIDDEN')
    })
  })

  describe('links', () => {
    const as = () => world.as('pm')

    test('a link reads from both ends', async () => {
      const [a, b] = [await make('task', 'A'), await make('task', 'B')]
      await addLink(world.db, world.scope, as(), a.id, b.id, 'blocks')
      const out = await listLinks(world.db, world.scope, as(), a.id)
      expect(out).toMatchObject([{ kind: 'blocks', direction: 'out', issueId: b.id, issueKey: b.key, issueTitle: 'B' }])
      const incoming = await listLinks(world.db, world.scope, world.as('plain'), b.id)
      expect(incoming).toMatchObject([{ kind: 'blocks', direction: 'in', issueId: a.id }])
    })

    test('adding the same link twice keeps one', async () => {
      const [a, b] = [await make('task'), await make('task')]
      await addLink(world.db, world.scope, as(), a.id, b.id, 'relates')
      await addLink(world.db, world.scope, as(), a.id, b.id, 'relates')
      expect(await listLinks(world.db, world.scope, as(), a.id)).toHaveLength(1)
    })

    test('an issue cannot link to itself or to something that is not in the project', async () => {
      const a = await make('task')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), a.id, a.id, 'relates'), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), a.id, randomUUID(), 'relates'), 'ISSUE_NOT_FOUND')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), a.id, 'TEST-99999', 'relates'), 'ISSUE_NOT_FOUND')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), a.id, a.id, 'sideways' as never), 'ISSUE_INPUT_INVALID')
    })

    test('blocking cannot loop, directly or through other issues', async () => {
      const [a, b, c] = [await make('task', 'A'), await make('task', 'B'), await make('task', 'C')]
      await addLink(world.db, world.scope, as(), a.id, b.id, 'blocks')
      await addLink(world.db, world.scope, as(), b.id, c.id, 'blocks')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), b.id, a.id, 'blocks'), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), c.id, a.id, 'blocks'), 'ISSUE_INPUT_INVALID')
      await addLink(world.db, world.scope, as(), a.id, c.id, 'blocks')
    })

    test('an epic cannot block or be blocked, but it can relate to anything', async () => {
      const [epic, task] = [await make('epic'), await make('task')]
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), epic.id, task.id, 'blocks'), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), task.id, epic.id, 'blocks'), 'ISSUE_INPUT_INVALID')
      await addLink(world.db, world.scope, as(), epic.id, task.id, 'relates')
    })

    test('only a bug is found in a story', async () => {
      const [bug, story, task] = [await make('bug'), await make('story'), await make('task')]
      await addLink(world.db, world.scope, as(), bug.id, story.id, 'found_in')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), task.id, story.id, 'found_in'), 'ISSUE_INPUT_INVALID')
      await world.rejectsWith(() => addLink(world.db, world.scope, as(), bug.id, task.id, 'found_in'), 'ISSUE_INPUT_INVALID')
    })

    test('a link can be removed, but only by someone who works on its issue', async () => {
      const [a, b] = [await make('task'), await make('task')]
      await addLink(world.db, world.scope, as(), a.id, b.id, 'relates')
      const [link] = await listLinks(world.db, world.scope, as(), a.id)
      await world.rejectsWith(() => removeLink(world.db, world.scope, world.as('plain'), a.id, link.id), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => removeLink(world.db, world.scope, world.agent('pm'), a.id, link.id), 'ISSUE_AGENT_FORBIDDEN')
      await removeLink(world.db, world.scope, as(), a.id, link.id)
      expect(await listLinks(world.db, world.scope, as(), a.id)).toHaveLength(0)
      await world.rejectsWith(() => removeLink(world.db, world.scope, as(), a.id, link.id), 'ISSUE_NOT_FOUND')
    })

    test('a member without a say, a viewer, and an AI agent key cannot add links', async () => {
      const [a, b] = [await make('task'), await make('task')]
      await world.rejectsWith(() => addLink(world.db, world.scope, world.as('plain'), a.id, b.id, 'relates'), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => addLink(world.db, world.scope, world.as('viewer'), a.id, b.id, 'relates'), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => addLink(world.db, world.scope, world.agent('pm'), a.id, b.id, 'relates'), 'ISSUE_AGENT_FORBIDDEN')
    })
  })
})
