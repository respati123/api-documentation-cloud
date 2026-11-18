import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import type { Backlog, Issue } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { useSprintBoardViewModel } from '@/features/projects/viewmodels/use-sprint-board.viewmodel'
import { ApiError } from '@/shared/services/api-client'

vi.mock('@/features/projects/services/issues.service', () => ({
  issuesService: { backlog: vi.fn(), subtasks: vi.fn(), epics: vi.fn(), update: vi.fn() },
}))

function issue(id: string, over: Partial<Issue> = {}): Issue {
  return {
    id,
    projectId: 'p1',
    number: 1,
    key: `PARI-${id}`,
    type: 'task',
    parentId: null,
    title: `Item ${id}`,
    description: '',
    acceptanceCriteria: '',
    userStoryRole: '',
    userStoryAction: '',
    userStoryBenefit: '',
    flow: '',
    status: 'todo',
    points: 3,
    priority: 'medium',
    rank: 1024,
    sprintId: 's1',
    role: null,
    assigneeId: null,
    assigneeEmail: null,
    dueDate: null,
    sourceDocumentId: null,
    sourceVersion: null,
    sourceSection: null,
    sourceReviewedVersion: null,
    sourceOutdated: null,
    designApprovedBy: null,
    designApprovedAt: null,
    testCaseId: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
    createdBy: 'u1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  }
}

const sprint = (over = {}) => ({
  id: 's1',
  projectId: 'p1',
  name: 'Sprint 1',
  goal: 'Ship checkout',
  startsOn: '2026-07-01',
  endsOn: '2026-07-15',
  status: 'active' as const,
  startedAt: null,
  closedAt: null,
  createdBy: 'u1',
  createdAt: '2026-07-01T00:00:00.000Z',
  issues: [] as Issue[],
  ...over,
})

let client: QueryClient
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

function reply(sprints: Backlog['sprints'], subtasks: Issue[] = [], epics: Issue[] = []) {
  vi.mocked(issuesService.backlog).mockResolvedValue({ sprints, backlog: { items: [], nextCursor: null } })
  vi.mocked(issuesService.subtasks).mockResolvedValue({ items: subtasks, nextCursor: null })
  vi.mocked(issuesService.epics).mockResolvedValue({ items: epics, nextCursor: null })
}

async function render(enabled = true, canEdit = true) {
  const hook = renderHook(() => useSprintBoardViewModel('w1', 'p1', enabled, canEdit), { wrapper: Wrapper })
  if (enabled) await waitFor(() => expect(hook.result.current.status).not.toBe('loading'))
  return hook
}

const cardsOf = (lane: { columns: Array<{ id: string; cards: Array<{ id: string }> }> }, column: string) =>
  lane.columns.find((item) => item.id === column)?.cards.map((card) => card.id)

beforeEach(async () => {
  await i18next.changeLanguage('en')
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthSessionStore.setState({ signedIn: true, userId: 'me', token: 't' })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useSprintBoardViewModel', () => {
  test('describes the active sprint and puts the sub-tasks of each item in their columns', async () => {
    const story = issue('st', { type: 'story', status: 'in_progress', points: 5 })
    reply(
      [sprint({ issues: [story] })],
      [
        issue('a', { type: 'subtask', parentId: 'st', status: 'todo', sprintId: null }),
        issue('b', { type: 'subtask', parentId: 'st', status: 'in_review', sprintId: null, assigneeEmail: 'rani@test.dev' }),
        issue('c', { type: 'subtask', parentId: 'st', status: 'done', sprintId: null }),
        issue('x', { type: 'subtask', parentId: 'other', sprintId: null }),
      ],
    )
    const { result } = await render()

    expect(result.current.sprint).toMatchObject({ name: 'Sprint 1', goal: 'Ship checkout', totals: '0 done, 0 points done' })
    const [lane] = result.current.lanes
    expect(lane.lead).toMatchObject({ key: 'PARI-st', typeLabel: 'Story' })
    expect(lane.progress).toBe('1 of 3 done')
    expect(cardsOf(lane, 'todo')).toEqual(['a'])
    expect(cardsOf(lane, 'in_progress')).toEqual(['b'])
    expect(cardsOf(lane, 'done')).toEqual(['c'])
    expect(lane.columns[1].cards[0]).toMatchObject({ assignee: 'rani', statusLabel: 'In review' })
  })

  test('has no sprint when none is active, and reads no sub-tasks then', async () => {
    reply([sprint({ status: 'planned' })])
    const { result } = await render()
    expect(result.current.sprint).toBeNull()
    expect(issuesService.subtasks).not.toHaveBeenCalled()
  })

  test('a story moves through the story statuses and a task through the work statuses', async () => {
    reply([sprint({ issues: [issue('st', { type: 'story', status: 'ready' }), issue('t', { type: 'task' })] })])
    const { result } = await render()
    const [story, task] = result.current.lanes.map((lane) => lane.columns.flatMap((column) => column.cards)[0])
    expect(story.statusOptions.map((option) => option.value)).toEqual(['draft', 'in_design', 'ready', 'in_progress', 'in_qa', 'done'])
    expect(task.statusOptions.map((option) => option.value)).toEqual(['todo', 'in_progress', 'in_review', 'done'])
  })

  test('only an editor may move a card', async () => {
    reply([sprint({ issues: [issue('t')] })])
    const { result } = await render(true, false)
    expect(result.current.lanes[0].columns[0].cards[0].canMove).toBe(false)
  })

  test('search and My work narrow the cards, and lanes with nothing left disappear', async () => {
    reply([sprint({ issues: [issue('a', { title: 'Cart', assigneeId: 'me' }), issue('b', { title: 'Payment' })] })])
    const { result } = await render()
    expect(result.current.lanes).toHaveLength(2)
    act(() => result.current.setSearch('pay'))
    expect(result.current.lanes.map((lane) => lane.id)).toEqual(['b'])
    expect(result.current.filtering).toBe(true)
    act(() => result.current.setSearch(''))
    act(() => result.current.toggleMine())
    expect(result.current.lanes.map((lane) => lane.id)).toEqual(['a'])
  })

  test('grouping by epic loads the epics and shows one lane for each', async () => {
    const epic = issue('e1', { type: 'epic', status: null, points: null, title: 'Payment', sprintId: null })
    reply([sprint({ issues: [issue('a', { parentId: 'e1' }), issue('b')] })], [], [epic])
    const { result } = await render()
    act(() => result.current.setGroup('epic'))
    await waitFor(() => expect(result.current.lanes.map((lane) => lane.id)).toEqual(['e1', 'none']))
    expect(result.current.lanes[1].title).toBe('No epic')
  })

  test('moving a card sends the status, and a refusal shows the words of the server', async () => {
    reply([sprint({ issues: [issue('t')] })])
    vi.mocked(issuesService.update).mockRejectedValueOnce(new ApiError('A sub-task is not done.', 409, { code: 'ISSUE_OPEN_SUBTASKS' }))
    const { result } = await render()
    act(() => result.current.move('t', 'done'))
    await waitFor(() => expect(result.current.moveError).toBe('A sub-task is not done.'))
    expect(issuesService.update).toHaveBeenCalledWith('t', 'w1', 'p1', 't', { status: 'done' })
  })

  test('shows the message of the server when the board cannot load', async () => {
    vi.mocked(issuesService.backlog).mockRejectedValue(new ApiError('You may not read this project.', 403, { code: 'FORBIDDEN' }))
    const { result } = await render()
    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('You may not read this project.')
  })

  test('reads nothing while it is not shown', async () => {
    reply([sprint()])
    await render(false)
    expect(issuesService.backlog).not.toHaveBeenCalled()
  })
})
