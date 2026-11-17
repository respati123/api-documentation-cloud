import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import type { Backlog, Issue } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { useBacklogViewModel } from '@/features/projects/viewmodels/use-backlog.viewmodel'
import { ApiError } from '@/shared/services/api-client'

vi.mock('@/features/projects/services/issues.service', () => ({
  issuesService: { backlog: vi.fn(), epics: vi.fn() },
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
    sprintId: null,
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

const epic = issue('e1', { type: 'epic', status: null, points: null, title: 'Payment' })

let client: QueryClient
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

function reply(pages: Backlog[]) {
  const mock = vi.mocked(issuesService.backlog)
  for (const page of pages) mock.mockResolvedValueOnce(page)
  vi.mocked(issuesService.epics).mockResolvedValue({ items: [epic], nextCursor: null })
}

// A null project id means the workspace has no project yet.
async function render(enabled = true, projectId: string | null = 'p1') {
  const hook = renderHook(() => useBacklogViewModel('w1', projectId ?? undefined, 'Halve checkout time', enabled), { wrapper: Wrapper })
  if (enabled && projectId) await waitFor(() => expect(hook.result.current.status).not.toBe('loading'))
  return hook
}

beforeEach(async () => {
  await i18next.changeLanguage('en')
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthSessionStore.setState({ signedIn: true, userId: 'me', token: 't' })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useBacklogViewModel', () => {
  test('lists the open sprints with their items and totals, then the loose items', async () => {
    reply([
      {
        sprints: [
          sprint({
            issues: [issue('a', { points: 5, status: 'done' }), issue('b', { points: 3, parentId: 'e1', assigneeEmail: 'rani@test.dev' })],
          }),
        ],
        backlog: { items: [issue('c', { points: null })], nextCursor: null },
      },
    ])
    const { result } = await render()

    const [first] = result.current.sprints
    expect(first).toMatchObject({
      name: 'Sprint 1',
      goal: 'Ship checkout',
      isActive: true,
      statusLabel: 'Active',
      totals: '2 items, 8 points',
      progress: '1 done, 5 points done',
    })
    expect(first.rows.map((row) => row.key)).toEqual(['PARI-a', 'PARI-b'])
    expect(first.rows[1]).toMatchObject({
      epicKey: 'PARI-e1',
      assignee: 'rani',
      pointsLabel: '3 pts',
      typeLabel: 'Task',
      statusLabel: 'To do',
    })
    expect(result.current.backlog.rows.map((row) => row.key)).toEqual(['PARI-c'])
    expect(result.current.backlog.rows[0]).toMatchObject({ pointsLabel: 'No points', ready: false })
    expect(result.current.productGoal).toBe('Halve checkout time')
  })

  test('shows why an item is not ready for a sprint, and which drafts are drafts', async () => {
    reply([
      {
        sprints: [],
        backlog: {
          items: [
            issue('s', { type: 'story', status: 'draft', points: null, publishedAt: null, sourceOutdated: true }),
            issue('r', { type: 'story', status: 'ready', points: 5 }),
          ],
          nextCursor: null,
        },
      },
    ])
    const { result } = await render()
    const [notReady, ready] = result.current.backlog.rows
    expect(notReady.gaps.map((gap) => gap.label)).toEqual(['Not ready', 'Needs points'])
    expect(notReady).toMatchObject({ ready: false, isDraft: true, outdated: true })
    expect(ready).toMatchObject({ ready: true, gaps: [], isDraft: false })
  })

  test('an epic filters the sprints and the loose items, and picking it again clears the filter', async () => {
    reply([
      {
        sprints: [sprint({ issues: [issue('a', { parentId: 'e1' }), issue('b')] })],
        backlog: { items: [issue('c', { parentId: 'e1' }), issue('d')], nextCursor: null },
      },
    ])
    const { result } = await render()
    expect(result.current.epics.items).toEqual([{ id: 'e1', key: 'PARI-e1', title: 'Payment', count: 2, selected: false }])
    expect(result.current.epics).toMatchObject({ withoutEpic: 2, total: 4 })

    act(() => result.current.epics.onSelect('e1'))
    expect(result.current.sprints[0].rows.map((row) => row.key)).toEqual(['PARI-a'])
    expect(result.current.backlog.rows.map((row) => row.key)).toEqual(['PARI-c'])
    expect(result.current.epics.items[0].selected).toBe(true)

    act(() => result.current.epics.onSelect('none'))
    expect(result.current.backlog.rows.map((row) => row.key)).toEqual(['PARI-d'])

    act(() => result.current.epics.onSelect('none'))
    expect(result.current.backlog.rows).toHaveLength(2)
  })

  test('the next page of loose items is added, and the sprints stay those of the first page', async () => {
    reply([
      { sprints: [sprint()], backlog: { items: [issue('a')], nextCursor: 'next' } },
      { sprints: [], backlog: { items: [issue('b')], nextCursor: null } },
    ])
    const { result } = await render()
    expect(result.current.backlog.hasMore).toBe(true)

    act(() => result.current.backlog.onLoadMore())
    await waitFor(() => expect(result.current.backlog.rows).toHaveLength(2))
    expect(result.current.backlog.hasMore).toBe(false)
    expect(result.current.sprints).toHaveLength(1)
    expect(issuesService.backlog).toHaveBeenLastCalledWith('t', 'w1', 'p1', 'next')
  })

  test('the empty states read differently with and without a filter', async () => {
    reply([{ sprints: [], backlog: { items: [], nextCursor: null } }])
    const { result } = await render()
    expect(result.current.backlog.emptyLabel).toBe('The backlog is empty.')
    act(() => result.current.epics.onSelect('e1'))
    expect(result.current.backlog.emptyLabel).toBe('Nothing here for this filter.')
  })

  test('shows the message of the server when the backlog cannot be loaded', async () => {
    vi.mocked(issuesService.backlog).mockRejectedValue(new ApiError('You may not read this project.', 403, { code: 'ROLE_NOT_ALLOWED' }))
    vi.mocked(issuesService.epics).mockResolvedValue({ items: [], nextCursor: null })
    const { result } = await render()
    expect(result.current).toMatchObject({ status: 'error', error: 'You may not read this project.' })
  })

  test('asks for nothing without a project or while it is switched off', async () => {
    await render(true, null)
    await render(false)
    expect(issuesService.backlog).not.toHaveBeenCalled()
    expect(issuesService.epics).not.toHaveBeenCalled()
  })
})
