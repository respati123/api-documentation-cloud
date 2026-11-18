import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import type { Issue } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import type { BacklogAccess } from '@/features/projects/viewmodels/use-backlog-actions.viewmodel'
import { useIssueDetailViewModel } from '@/features/projects/viewmodels/use-issue-detail.viewmodel'
import { ApiError } from '@/shared/services/api-client'

vi.mock('@/features/projects/services/issues.service', () => ({
  issuesService: {
    issue: vi.fn(),
    children: vi.fn(),
    checklist: vi.fn(),
    links: vi.fn(),
    sprints: vi.fn(),
    update: vi.fn(),
    markSourceReviewed: vi.fn(),
    addChecklistItem: vi.fn(),
    setChecklistItemDone: vi.fn(),
    deleteChecklistItem: vi.fn(),
  },
}))

const service = vi.mocked(issuesService)
const PM: BacklogAccess = { canEdit: true, canApprove: true, canManage: true }
const VIEWER: BacklogAccess = { canEdit: false, canApprove: false, canManage: false }

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

function reply(main: Issue, extra: { parent?: Issue; children?: Issue[] } = {}) {
  service.issue.mockImplementation(async (_t, _w, _p, ref) => (extra.parent && ref === extra.parent.id ? extra.parent : main))
  service.children.mockResolvedValue({ items: extra.children ?? [], nextCursor: null })
  service.checklist.mockResolvedValue([
    { id: 'c1', issueId: main.id, title: 'Write the test', done: true, position: 1 },
    { id: 'c2', issueId: main.id, title: 'Review', done: false, position: 2 },
  ])
  service.links.mockResolvedValue([{ id: 'l1', kind: 'blocks', direction: 'in', issueId: 'x', issueKey: 'PARI-9', issueTitle: 'Login' }])
  service.sprints.mockResolvedValue([])
  service.update.mockResolvedValue(main)
  service.markSourceReviewed.mockResolvedValue(main)
}

async function open(access: BacklogAccess = PM, ref = 'a') {
  const hook = renderHook(() => useIssueDetailViewModel('w1', 'p1', access), { wrapper: Wrapper })
  act(() => hook.result.current.open(ref))
  await waitFor(() => expect(hook.result.current.status).toBe('ready'))
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

describe('useIssueDetailViewModel', () => {
  test('reads nothing until an issue is opened, and closes again', async () => {
    reply(issue('a'))
    const { result } = renderHook(() => useIssueDetailViewModel('w1', 'p1', PM), { wrapper: Wrapper })
    expect(result.current.isOpen).toBe(false)
    expect(service.issue).not.toHaveBeenCalled()
    act(() => result.current.open('a'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.close())
    expect(result.current.isOpen).toBe(false)
  })

  test('describes the issue, its parent, its checklist, and its links', async () => {
    const epic = issue('e1', { type: 'epic', status: null, title: 'Payment', sprintId: null })
    reply(issue('a', { type: 'story', status: 'ready', points: 5, parentId: 'e1', assigneeEmail: 'rani@test.dev' }), { parent: epic })
    const { result } = await open()
    await waitFor(() => expect(result.current.issue?.parent).toEqual({ key: 'PARI-e1', title: 'Payment' }))
    expect(result.current.issue).toMatchObject({
      key: 'PARI-a',
      typeLabel: 'Story',
      statusLabel: 'Ready',
      pointsLabel: '5 pts',
      assignee: 'rani',
    })
    expect(result.current.checklist.progress).toBe('1 of 2 done')
    expect(result.current.links).toEqual([{ id: 'l1', label: 'Blocked by', key: 'PARI-9', title: 'Login' }])
  })

  test('lists the sub-tasks of an item under their heading', async () => {
    reply(issue('a', { type: 'story' }), { children: [issue('s1', { type: 'subtask', status: 'in_review' })] })
    const story = await open()
    await waitFor(() => expect(story.result.current.children.rows).toHaveLength(1))
    expect(story.result.current.childrenHeading).toBe('Sub-tasks')
    expect(story.result.current.children.rows[0]).toMatchObject({ key: 'PARI-s1', statusLabel: 'In review' })
  })

  test('lists the items of an epic under their own heading, and the epic has no status or points to set', async () => {
    reply(issue('a', { type: 'epic', status: null }))
    const epic = await open()
    expect(epic.result.current.childrenHeading).toBe('Items')
    expect(epic.result.current.issue?.canSetStatus).toBe(false)
    expect(epic.result.current.issue?.showPoints).toBe(false)
  })

  test('a sub-task has no children and no points', async () => {
    reply(issue('a', { type: 'subtask', status: 'todo' }))
    const { result } = await open()
    expect(result.current.showChildren).toBe(false)
    expect(result.current.issue?.showPoints).toBe(false)
    expect(service.children).not.toHaveBeenCalled()
  })

  test('a viewer may change nothing', async () => {
    reply(issue('a', { type: 'story' }))
    const { result } = await open(VIEWER)
    expect(result.current.issue).toMatchObject({ canSetStatus: false, canSetPoints: false, canReview: false })
    expect(result.current.checklist.canEdit).toBe(false)
  })

  test('sets the status and the points, and clears the points with an empty value', async () => {
    reply(issue('a', { type: 'story', status: 'ready', points: 3 }))
    const { result } = await open()
    act(() => result.current.issue?.setStatus('in_progress'))
    await waitFor(() => expect(service.update).toHaveBeenCalledWith('t', 'w1', 'p1', 'a', { status: 'in_progress' }))
    act(() => result.current.issue?.setPoints(''))
    await waitFor(() => expect(service.update).toHaveBeenCalledWith('t', 'w1', 'p1', 'a', { points: null }))
  })

  test('shows the words of the server when a change is refused', async () => {
    reply(issue('a', { type: 'story', status: 'in_progress' }))
    service.update.mockRejectedValueOnce(new ApiError('A sub-task is not done.', 409, { code: 'ISSUE_OPEN_SUBTASKS' }))
    const { result } = await open()
    act(() => result.current.issue?.setStatus('done'))
    await waitFor(() => expect(result.current.actionError).toBe('A sub-task is not done.'))
  })

  test('adds, ticks, and deletes checklist items', async () => {
    reply(issue('a'))
    service.addChecklistItem.mockResolvedValue({ id: 'c3', issueId: 'a', title: 'Deploy', done: false, position: 3 })
    service.setChecklistItemDone.mockResolvedValue({ id: 'c2', issueId: 'a', title: 'Review', done: true, position: 2 })
    service.deleteChecklistItem.mockResolvedValue(undefined)
    const { result } = await open()
    expect(result.current.checklist.canAdd).toBe(false)
    act(() => result.current.checklist.setNewItem('  Deploy  '))
    expect(result.current.checklist.canAdd).toBe(true)
    act(() => result.current.checklist.add())
    await waitFor(() => expect(service.addChecklistItem).toHaveBeenCalledWith('t', 'w1', 'p1', 'a', 'Deploy'))
    expect(result.current.checklist.newItem).toBe('')
    act(() => result.current.checklist.toggle('c2', true))
    await waitFor(() => expect(service.setChecklistItemDone).toHaveBeenCalledWith('t', 'w1', 'p1', 'a', 'c2', true))
    act(() => result.current.checklist.remove('c1'))
    await waitFor(() => expect(service.deleteChecklistItem).toHaveBeenCalledWith('t', 'w1', 'p1', 'a', 'c1'))
  })

  test('warns that the PRD changed, and more strongly when the sprint is running', async () => {
    reply(issue('a', { sourceOutdated: true, sprintId: null }))
    const plain = await open()
    expect(plain.result.current.issue?.outdated).toBe('plain')

    reply(issue('a', { sourceOutdated: true, sprintId: 's1' }))
    service.sprints.mockResolvedValue([{ id: 's1', status: 'active' } as never])
    const running = await open()
    await waitFor(() => expect(running.result.current.issue?.outdated).toBe('sprint'))
    act(() => running.result.current.issue?.markReviewed())
    await waitFor(() => expect(service.markSourceReviewed).toHaveBeenCalledWith('t', 'w1', 'p1', 'a'))
  })

  test('shows the message of the server when the issue cannot be read', async () => {
    service.issue.mockRejectedValue(new ApiError('You may not read this project.', 403, { code: 'FORBIDDEN' }))
    service.children.mockResolvedValue({ items: [], nextCursor: null })
    const { result } = renderHook(() => useIssueDetailViewModel('w1', 'p1', PM), { wrapper: Wrapper })
    act(() => result.current.open('a'))
    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBe('You may not read this project.')
  })
})
