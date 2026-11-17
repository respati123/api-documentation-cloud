import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import type { Sprint } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { reportableSprints, useReportsViewModel } from '@/features/projects/viewmodels/use-reports.viewmodel'
import { ApiError } from '@/shared/services/api-client'

vi.mock('@/features/projects/services/issues.service', () => ({
  issuesService: { sprints: vi.fn(), burndown: vi.fn(), sprintReport: vi.fn(), velocity: vi.fn(), flow: vi.fn() },
}))

const sprint = (id: string, status: Sprint['status'], startsOn: string): Sprint => ({
  id,
  projectId: 'p1',
  name: `Sprint ${id}`,
  goal: '',
  startsOn,
  endsOn: startsOn,
  status,
  startedAt: null,
  closedAt: null,
  createdBy: 'u1',
  createdAt: '2026-07-01T00:00:00.000Z',
})

const item = (id: string, points: number | null = 3) => ({
  id,
  key: `PARI-${id}`,
  title: `Item ${id}`,
  type: 'task',
  status: 'done',
  points,
})

let client: QueryClient
const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

function scrumData() {
  vi.mocked(issuesService.sprints).mockResolvedValue([
    sprint('a', 'closed', '2026-06-01'),
    sprint('b', 'active', '2026-07-01'),
    sprint('c', 'planned', '2026-07-15'),
  ])
  vi.mocked(issuesService.burndown).mockResolvedValue({
    sprintId: 'b',
    total: 8,
    days: [
      { date: '2026-07-01', remaining: 8, ideal: 8 },
      { date: '2026-07-02', remaining: 5, ideal: 4 },
      { date: '2026-07-03', remaining: null, ideal: 0 },
    ],
  })
  vi.mocked(issuesService.sprintReport).mockResolvedValue({
    sprint: sprint('b', 'active', '2026-07-01'),
    committedPoints: 8,
    completedPoints: 3,
    completed: [item('1')],
    notCompleted: [item('2', null)],
    addedAfterStart: [],
    removedAfterStart: [],
    pointsChanged: [{ ...item('3'), before: 3, after: 5 }],
  })
  vi.mocked(issuesService.velocity).mockResolvedValue({
    sprints: [
      {
        sprintId: 'a',
        name: 'Sprint a',
        startsOn: '2026-06-01',
        endsOn: '2026-06-15',
        committedPoints: 10,
        addedPoints: 0,
        completedPoints: 8,
      },
    ],
    averageCompleted: 8,
  })
}

const flowData = {
  days: 30,
  wip: {
    total: 3,
    byStatus: [
      { status: 'in_progress', count: 2, limit: 1, over: true },
      { status: 'in_review', count: 1, limit: null, over: false },
    ],
  },
  throughput: { perDay: [{ date: '2026-07-01', done: 2 }], total: 4 },
  cycleTime: { count: 4, average: 2.5, median: 2, p85: 4 },
  workItemAge: { average: 3, oldest: [{ id: 'x', key: 'PARI-9', title: 'Old one', ageDays: 6 }] },
  cumulativeFlow: [
    { date: '2026-07-01', todo: 3, in_progress: 2, done: 1 },
    { date: '2026-07-02', todo: 2, in_progress: 2, done: 2 },
  ],
}

async function render(mode: 'scrum' | 'kanban', enabled = true, projectId: string | null = 'p1') {
  const hook = renderHook(() => useReportsViewModel('w1', projectId ?? undefined, mode, enabled), { wrapper: Wrapper })
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
  vi.resetAllMocks()
})

describe('reportableSprints', () => {
  test('keeps the sprints that started, with the running one first and then the latest closed', () => {
    const list = [
      sprint('old', 'closed', '2026-05-01'),
      sprint('plan', 'planned', '2026-08-01'),
      sprint('new', 'closed', '2026-06-01'),
      sprint('run', 'active', '2026-07-01'),
    ]
    expect(reportableSprints(list).map((entry) => entry.id)).toEqual(['run', 'new', 'old'])
  })
})

describe('useReportsViewModel, scrum', () => {
  test('reports on the running sprint: the burndown, the report, and the velocity', async () => {
    scrumData()
    const { result } = await render('scrum')

    expect(result.current.sprint).toMatchObject({ selected: 'b', hasSprint: true })
    expect(result.current.sprint.options.map((option) => option.value)).toEqual(['b', 'a'])
    expect(issuesService.burndown).toHaveBeenCalledWith('t', 'w1', 'p1', 'b')
    const burn = result.current.burndown
    expect(burn?.series.map((series) => [series.id, series.values])).toEqual([
      ['ideal', [8, 4, 0]],
      ['remaining', [8, 5, null]],
    ])
    expect(burn?.ariaLabel).toBe('Burndown of Sprint b, 8 points committed')
    expect(burn?.summary).toHaveLength(2)
    expect(burn?.labels[0]).toBe('Jul 1')
    expect(result.current.report).toMatchObject({ committed: '8 points', completed: '3 points' })
    const groups = Object.fromEntries((result.current.report?.groups ?? []).map((group) => [group.id, group.rows]))
    expect(groups.finished).toEqual([{ id: '1', key: 'PARI-1', title: 'Item 1', detail: '3 points' }])
    expect(groups.notFinished[0].detail).toBe('No points')
    expect(groups.estimates[0].detail).toBe('3 to 5 points')
    expect(groups.added).toEqual([])
    expect(result.current.velocity).toMatchObject({ empty: false, average: 'Average completed: 8 points' })
    expect(result.current.velocity?.groups).toEqual([{ id: 'a', label: 'Sprint a', values: [10, 8] }])
  })

  test('picking another sprint reports on that one', async () => {
    scrumData()
    const { result } = await render('scrum')
    act(() => result.current.sprint.onSelect('a'))
    await waitFor(() => expect(issuesService.sprintReport).toHaveBeenCalledWith('t', 'w1', 'p1', 'a'))
    expect(result.current.sprint.selected).toBe('a')
  })

  test('with no sprint that started there is nothing to draw, and no velocity yet', async () => {
    vi.mocked(issuesService.sprints).mockResolvedValue([sprint('c', 'planned', '2026-07-15')])
    vi.mocked(issuesService.velocity).mockResolvedValue({ sprints: [], averageCompleted: 0 })
    const { result } = await render('scrum')
    expect(result.current.sprint.hasSprint).toBe(false)
    expect(result.current.burndown).toBeNull()
    expect(result.current.velocity?.empty).toBe(true)
    expect(issuesService.burndown).not.toHaveBeenCalled()
  })

  test('shows the message of the server when a report cannot be loaded', async () => {
    vi.mocked(issuesService.sprints).mockRejectedValue(new ApiError('You may not read this project.', 403, { code: 'ROLE_NOT_ALLOWED' }))
    vi.mocked(issuesService.velocity).mockResolvedValue({ sprints: [], averageCompleted: 0 })
    const { result } = await render('scrum')
    expect(result.current).toMatchObject({ status: 'error', error: 'You may not read this project.' })
  })
})

describe('useReportsViewModel, kanban', () => {
  test('shows the flow numbers, with the columns over their limit marked', async () => {
    vi.mocked(issuesService.flow).mockResolvedValue(flowData)
    const { result } = await render('kanban')
    const flow = result.current.flow
    expect(flow?.throughput).toBe('4 items finished')
    expect(flow?.cycleTime.tiles.map((tile) => [tile.id, tile.value])).toEqual([
      ['average', '2.5 days'],
      ['median', '2 days'],
      ['p85', '4 days'],
    ])
    expect(flow?.wip).toEqual([
      { status: 'in_progress', label: 'In progress', count: 2, limit: 'Limit 1', over: true, overLabel: 'Over the limit' },
      { status: 'in_review', label: 'In review', count: 1, limit: 'No limit', over: false, overLabel: 'Over the limit' },
    ])
    expect(flow?.oldest).toEqual([{ id: 'x', key: 'PARI-9', title: 'Old one', detail: '6 days open' }])
    expect(flow?.cumulative.series.map((series) => series.id)).toEqual(['done', 'in_progress', 'todo'])
    expect(flow?.cumulative.summary[1]).toBe('Jul 2: 2 done, 2 in progress, 2 to do')
    expect(issuesService.sprints).not.toHaveBeenCalled()
  })

  test('the period can change, and the numbers are asked again for it', async () => {
    vi.mocked(issuesService.flow).mockResolvedValue(flowData)
    const { result } = await render('kanban')
    expect(issuesService.flow).toHaveBeenLastCalledWith('t', 'w1', 'p1', 30)
    expect(result.current.flow?.period.options.map((option) => option.label)).toEqual([
      'Last 14 days',
      'Last 30 days',
      'Last 60 days',
      'Last 90 days',
    ])
    act(() => result.current.flow?.period.onSelect('60'))
    await waitFor(() => expect(issuesService.flow).toHaveBeenLastCalledWith('t', 'w1', 'p1', 60))
  })

  test('says there was nothing finished, and nothing open, when that is so', async () => {
    vi.mocked(issuesService.flow).mockResolvedValue({
      ...flowData,
      cycleTime: { count: 0, average: 0, median: 0, p85: 0 },
      workItemAge: { average: 0, oldest: [] },
      wip: { total: 0, byStatus: [] },
    })
    const { result } = await render('kanban')
    expect(result.current.flow?.cycleTime.hasData).toBe(false)
    expect(result.current.flow?.oldest).toEqual([])
    expect(result.current.flow?.wip).toEqual([])
  })
})

describe('useReportsViewModel, switched off', () => {
  test('asks for nothing without a project, or while it is off', async () => {
    await render('scrum', true, null)
    await render('kanban', false)
    expect(issuesService.sprints).not.toHaveBeenCalled()
    expect(issuesService.flow).not.toHaveBeenCalled()
  })
})
