import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import type { Issue } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { useSprintSummaryViewModel } from '@/features/projects/viewmodels/use-sprint-summary.viewmodel'

vi.mock('@/features/projects/services/issues.service', () => ({ issuesService: { backlog: vi.fn() } }))

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

let client: QueryClient
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

beforeEach(async () => {
  await i18next.changeLanguage('en')
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthSessionStore.setState({ signedIn: true, userId: 'me', token: 't' })
})
afterEach(() => vi.clearAllMocks())

const reply = (sprints: Array<{ status: 'active' | 'planned'; issues: Issue[] }>) =>
  vi.mocked(issuesService.backlog).mockResolvedValue({
    sprints: sprints.map((item, index) => ({
      ...sprint(item.status, index),
      issues: item.issues,
    })),
    backlog: { items: [], nextCursor: null },
  })

const sprint = (status: 'active' | 'planned', index: number) => ({
  id: `s${index}`,
  projectId: 'p1',
  name: `Sprint ${index + 1}`,
  goal: 'Ship checkout',
  startsOn: '2026-07-01',
  endsOn: '2099-07-15',
  status,
  startedAt: null,
  closedAt: null,
  createdBy: 'u1',
  createdAt: '2026-07-01T00:00:00.000Z',
})

async function render(enabled = true) {
  const hook = renderHook(() => useSprintSummaryViewModel('w1', 'p1', enabled), { wrapper: Wrapper })
  if (enabled) await waitFor(() => expect(hook.result.current.status).not.toBe('loading'))
  return hook
}

describe('useSprintSummaryViewModel', () => {
  test('sums the committed and the done points of the active sprint', async () => {
    reply([
      { status: 'planned', issues: [issue('p', { points: 13 })] },
      {
        status: 'active',
        issues: [issue('a', { points: 5, status: 'done' }), issue('b', { points: 3 }), issue('c', { points: null, status: 'done' })],
      },
    ])
    const { result } = await render()
    expect(result.current.sprint).toMatchObject({
      name: 'Sprint 2',
      goal: 'Ship checkout',
      committed: 8,
      done: 5,
      percent: 63,
      items: '2 of 3 items done',
    })
  })

  test('has no sprint when none is active', async () => {
    reply([{ status: 'planned', issues: [] }])
    const { result } = await render()
    expect(result.current.sprint).toBeNull()
  })

  test('an active sprint with no points shows no progress rather than a division by zero', async () => {
    reply([{ status: 'active', issues: [issue('a', { points: null })] }])
    const { result } = await render()
    expect(result.current.sprint?.percent).toBe(0)
  })

  test('reads nothing while it is not shown', async () => {
    reply([])
    await render(false)
    expect(issuesService.backlog).not.toHaveBeenCalled()
  })
})
