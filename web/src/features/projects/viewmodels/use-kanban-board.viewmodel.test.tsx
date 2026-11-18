import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import type { Issue } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { useKanbanBoardViewModel } from '@/features/projects/viewmodels/use-kanban-board.viewmodel'
import { ApiError } from '@/shared/services/api-client'

vi.mock('@/features/projects/services/issues.service', () => ({
  issuesService: { backlog: vi.fn(), wipLimits: vi.fn(), setWipLimit: vi.fn(), update: vi.fn() },
}))

const service = vi.mocked(issuesService)

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

function reply(items: Issue[], limits: Array<{ status: string; limit: number }> = [], nextCursor: string | null = null) {
  service.backlog.mockResolvedValue({ sprints: [], backlog: { items, nextCursor } })
  service.wipLimits.mockResolvedValue(limits)
}

async function render(canEdit = true, canApprove = true, enabled = true) {
  const hook = renderHook(() => useKanbanBoardViewModel('w1', 'p1', enabled, { canEdit, canApprove }), { wrapper: Wrapper })
  if (enabled) await waitFor(() => expect(hook.result.current.status).not.toBe('loading'))
  return hook
}

const column = (hook: { result: { current: ReturnType<typeof useKanbanBoardViewModel> } }, status: string) =>
  hook.result.current.columns.find((item) => item.status === status)

beforeEach(async () => {
  await i18next.changeLanguage('en')
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  useAuthSessionStore.setState({ signedIn: true, userId: 'me', token: 't' })
})
afterEach(() => vi.resetAllMocks())

describe('useKanbanBoardViewModel', () => {
  test('puts the open items in the column of their status, with a count and the limit', async () => {
    reply([issue('a', { status: 'in_progress' }), issue('b', { status: 'in_progress' }), issue('c')], [{ status: 'in_progress', limit: 1 }])
    const board = await render()
    expect(column(board, 'in_progress')).toMatchObject({ label: 'In progress', count: 2, limitLabel: '2 / 1', over: true })
    expect(column(board, 'in_progress')?.cards.map((card) => card.id)).toEqual(['a', 'b'])
    expect(column(board, 'todo')).toMatchObject({ count: 1, limitLabel: '1', over: false })
  })

  test('only the PM and the tech lead may set a limit', async () => {
    reply([issue('a')])
    const lead = await render(true, true)
    expect(column(lead, 'in_progress')?.canSetLimit).toBe(true)
    const member = await render(true, false)
    expect(column(member, 'in_progress')?.canSetLimit).toBe(false)
  })

  test('sets a limit from the dialog, and clears it', async () => {
    reply([issue('a', { status: 'in_progress' })])
    service.setWipLimit.mockResolvedValue([{ status: 'in_progress', limit: 3 }])
    const board = await render()
    act(() => board.result.current.limitDialog.onOpen('in_progress'))
    expect(board.result.current.limitDialog).toMatchObject({ open: true, canSubmit: false })
    act(() => board.result.current.limitDialog.setValue('3'))
    expect(board.result.current.limitDialog.canSubmit).toBe(true)
    act(() => board.result.current.limitDialog.onSubmit())
    await waitFor(() => expect(service.setWipLimit).toHaveBeenCalledWith('t', 'w1', 'p1', 'in_progress', 3))
    await waitFor(() => expect(board.result.current.limitDialog.open).toBe(false))
    act(() => board.result.current.limitDialog.onOpen('in_progress'))
    act(() => board.result.current.limitDialog.onClear())
    await waitFor(() => expect(service.setWipLimit).toHaveBeenLastCalledWith('t', 'w1', 'p1', 'in_progress', null))
  })

  test('refuses a limit that is not a whole number above zero before it asks the server', async () => {
    reply([])
    const board = await render()
    act(() => board.result.current.limitDialog.onOpen('in_progress'))
    for (const bad of ['0', '-2', '1.5', 'abc', '']) {
      act(() => board.result.current.limitDialog.setValue(bad))
      expect(board.result.current.limitDialog.canSubmit).toBe(false)
    }
  })

  test('shows the words of the server when a limit is refused', async () => {
    reply([])
    service.setWipLimit.mockRejectedValue(new ApiError('Only the PM may set a limit.', 403, { code: 'ROLE_NOT_ALLOWED' }))
    const board = await render()
    act(() => board.result.current.limitDialog.onOpen('in_progress'))
    act(() => board.result.current.limitDialog.setValue('2'))
    act(() => board.result.current.limitDialog.onSubmit())
    await waitFor(() => expect(board.result.current.limitDialog.error).toBe('Only the PM may set a limit.'))
  })

  test('moving a card sends the status, and a refusal shows the words of the server', async () => {
    reply([issue('a')])
    service.update.mockRejectedValueOnce(new ApiError('A sub-task is not done.', 409, { code: 'ISSUE_OPEN_SUBTASKS' }))
    const board = await render()
    act(() => board.result.current.move('a', 'done'))
    await waitFor(() => expect(board.result.current.moveError).toBe('A sub-task is not done.'))
    expect(service.update).toHaveBeenCalledWith('t', 'w1', 'p1', 'a', { status: 'done' })
  })

  test('search and My work narrow the cards but keep the counts of the columns honest', async () => {
    reply([issue('a', { title: 'Cart', assigneeId: 'me' }), issue('b', { title: 'Payment' })])
    const board = await render()
    act(() => board.result.current.setSearch('pay'))
    expect(column(board, 'todo')?.cards.map((card) => card.id)).toEqual(['b'])
    expect(column(board, 'todo')?.count).toBe(2)
    act(() => board.result.current.setSearch(''))
    act(() => board.result.current.toggleMine())
    expect(column(board, 'todo')?.cards.map((card) => card.id)).toEqual(['a'])
  })

  test('offers more items when the backlog has another page', async () => {
    reply([issue('a')], [], 'next')
    const board = await render()
    expect(board.result.current.hasMore).toBe(true)
  })

  test('shows the message of the server when the board cannot load, and reads nothing while hidden', async () => {
    service.backlog.mockRejectedValue(new ApiError('You may not read this project.', 403, { code: 'FORBIDDEN' }))
    service.wipLimits.mockResolvedValue([])
    const board = await render()
    expect(board.result.current.status).toBe('error')
    expect(board.result.current.error).toBe('You may not read this project.')
    vi.resetAllMocks()
    await render(true, true, false)
    expect(service.backlog).not.toHaveBeenCalled()
  })
})
