import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import type { Project, Task } from '@/features/projects/models/project.model'
import { projectsService } from '@/features/projects/services/projects.service'
import { DONE_PREVIEW, useProjectsViewModel } from '@/features/projects/viewmodels/use-projects.viewmodel'
import { ApiError } from '@/shared/services/api-client'

vi.mock('@/features/projects/services/projects.service', () => ({
  projectsService: { list: vi.fn(), tasks: vi.fn(), members: vi.fn(), moveTask: vi.fn() },
}))
vi.mock('@/features/projects/viewmodels/use-planning.viewmodel', () => ({
  usePlanningViewModel: () => ({ access: { canManage: false, canApprove: false }, codes: {}, activityFor: () => [] }),
}))
vi.mock('@/features/projects/viewmodels/use-planning-comments.viewmodel', () => ({
  usePlanningCommentsViewModel: () => ({}),
}))
vi.mock('@/features/projects/viewmodels/use-task-extras.viewmodel', () => ({
  useTaskExtrasViewModel: () => ({}),
}))

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    projectId: 'p-1',
    title: id,
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    assigneeEmail: null,
    dueDate: null,
    position: '1',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
    ...overrides,
  }
}

let client: QueryClient

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

async function renderBoard(tasks: Task[], canEdit = true) {
  vi.mocked(projectsService.tasks).mockResolvedValue(tasks)
  const hook = renderHook(() => useProjectsViewModel('w-1', 'Workspace', canEdit, true), { wrapper: Wrapper })
  await waitFor(() => expect(hook.result.current.totalCount).toBe(tasks.length))
  return hook
}

const column = (result: { current: ReturnType<typeof useProjectsViewModel> }, status: Task['status']) =>
  result.current.columns.find((entry) => entry.status === status)

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthSessionStore.setState({ signedIn: true, userId: 'me', token: 't' })
  vi.mocked(projectsService.list).mockResolvedValue([{ id: 'p-1' } as Project])
  vi.mocked(projectsService.members).mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useProjectsViewModel board', () => {
  test('the Done column shows a few tasks until it is expanded, then can collapse again', async () => {
    const done = Array.from({ length: DONE_PREVIEW + 2 }, (_, index) => task(`done-${index}`, { status: 'done' }))
    const { result } = await renderBoard(done)

    expect(column(result, 'done')).toMatchObject({ total: DONE_PREVIEW + 2, hiddenCount: 2, canCollapse: false })
    expect(column(result, 'done')?.items).toHaveLength(DONE_PREVIEW)

    act(() => result.current.onToggleDone())

    expect(column(result, 'done')).toMatchObject({ hiddenCount: 0, canCollapse: true })
    expect(column(result, 'done')?.items).toHaveLength(DONE_PREVIEW + 2)
  })

  test('a locked task cannot be dragged, and nothing can be dragged without edit rights', async () => {
    const tasks = [task('open'), task('locked', { locked: true })]
    const editable = await renderBoard(tasks)
    const draggable = Object.fromEntries((column(editable.result, 'todo')?.items ?? []).map((item) => [item.id, item.draggable]))
    expect(draggable).toEqual({ open: true, locked: false })
    editable.unmount()

    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const readOnly = await renderBoard(tasks, false)
    expect(column(readOnly.result, 'todo')?.items.every((item) => !item.draggable)).toBe(true)
  })

  test('a move shows at once, and goes back with the server message when the server refuses it', async () => {
    let refuse!: (error: Error) => void
    vi.mocked(projectsService.moveTask).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          refuse = reject
        }),
    )
    const { result } = await renderBoard([task('t-1', { status: 'backlog' })])

    act(() => result.current.onMoveTask('t-1', 'in_progress'))

    await waitFor(() => expect(column(result, 'in_progress')?.items.map((item) => item.id)).toEqual(['t-1']))
    expect(column(result, 'backlog')?.items).toHaveLength(0)

    await act(async () => refuse(new ApiError('The design of this story is not approved yet.', 409)))

    await waitFor(() => expect(column(result, 'backlog')?.items.map((item) => item.id)).toEqual(['t-1']))
    expect(column(result, 'in_progress')?.items).toHaveLength(0)
    expect(result.current.error).toBe('The design of this story is not approved yet.')
  })

  test('dropping a task on its own column sends nothing', async () => {
    const { result } = await renderBoard([task('t-1')])

    act(() => result.current.onMoveTask('t-1', 'todo'))

    expect(projectsService.moveTask).not.toHaveBeenCalled()
  })
})
