import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import '@/shared/i18n'
import { useAuthSessionStore } from '@/features/auth'
import type { CommitDetail } from '@/features/workspace-detail/models/commit-detail.model'
import { workspaceDetailService } from '@/features/workspace-detail/services/workspace-detail.service'
import {
  useWorkspaceHistoryViewModel,
  type WorkspaceHistoryInput,
} from '@/features/workspace-detail/viewmodels/use-workspace-history.viewmodel'
import type { CloudCommit, RequestNode } from '@/shared/models/cloud-workspace.model'

vi.mock('@/features/workspace-detail/services/workspace-detail.service', () => ({
  workspaceDetailService: { commitDetail: vi.fn() },
}))

const request = (id: string, url: string): RequestNode => ({ id, kind: 'request', name: id, method: 'GET', url, body: '' })

const commits: CloudCommit[] = [
  { id: 'c3', parentIds: ['c2'], message: 'Rename paths', createdAt: '2026-11-07T10:00:00Z', authorEmail: 'ada@test.dev' },
  { id: 'c2', parentIds: [], message: 'First', createdAt: '2026-11-03T10:00:00Z', authorEmail: 'ada@test.dev' },
]

const details: Record<string, CommitDetail> = {
  c3: {
    id: 'c3',
    parentIds: ['c2'],
    message: 'Rename paths',
    createdAt: '2026-11-07T10:00:00Z',
    authorEmail: 'ada@test.dev',
    tree: [request('a', '/v2/a'), request('b', '/v2/b')],
  },
  c2: {
    id: 'c2',
    parentIds: [],
    message: 'First',
    createdAt: '2026-11-03T10:00:00Z',
    tree: [request('a', '/v1/a'), request('b', '/v1/b')],
  },
  orphan: {
    id: 'orphan',
    parentIds: ['c2'],
    message: 'Shared link',
    createdAt: '2026-11-01T10:00:00Z',
    authorEmail: 'bo@test.dev',
    tree: [request('a', '/v1/a')],
  },
}

let client: QueryClient

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderHistory(overrides: Partial<WorkspaceHistoryInput> = {}) {
  const input: WorkspaceHistoryInput = {
    workspaceId: 'w-1',
    commits,
    enabled: true,
    commitId: 'c3',
    canRestore: true,
    onOpenCommit: vi.fn(),
    onOpenList: vi.fn(),
    onRestore: vi.fn(),
    ...overrides,
  }
  return renderHook((props: WorkspaceHistoryInput) => useWorkspaceHistoryViewModel(props), { wrapper: Wrapper, initialProps: input })
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  useAuthSessionStore.setState({ signedIn: true, userId: 'me', token: 't' })
  vi.mocked(workspaceDetailService.commitDetail).mockImplementation(async (_token, _workspace, id) => details[id])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useWorkspaceHistoryViewModel', () => {
  test('lists commits grouped by day when no commit is open', () => {
    const { result } = renderHistory({ commitId: undefined })

    expect(result.current.mode).toBe('list')
    expect(result.current.dayGroups.map((group) => group.commits.map((commit) => commit.id))).toEqual([['c3'], ['c2']])
    expect(result.current.dayGroups[0].commits[0].isLatest).toBe(true)
    expect(workspaceDetailService.commitDetail).not.toHaveBeenCalled()
  })

  test('compares an open commit with its parent', async () => {
    const { result } = renderHistory()

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.files.map((file) => file.id)).toEqual(['a', 'b'])
    expect(result.current.totals).toMatchObject({ files: 2, added: 2, removed: 2 })
    expect(result.current.commit).toMatchObject({ shortId: 'c3', parentShortId: 'c2', isLatest: true })
  })

  test('finds breaking changes against the parent', async () => {
    const { result } = renderHistory()

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.breakingChanges.map((change) => [change.nodeId, change.reason])).toEqual([
      ['a', 'path-changed'],
      ['b', 'path-changed'],
    ])
    expect(result.current.breakingFileIds).toEqual(['a', 'b'])
  })

  test('opens a shared commit that is not in the loaded list, with its author from the detail', async () => {
    const { result } = renderHistory({ commitId: 'orphan' })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.commit).toMatchObject({ message: 'Shared link', authorEmail: 'bo@test.dev', isLatest: false })
    expect(result.current.files.map((file) => file.id)).toEqual(['b'])
  })

  test('marking an item viewed folds it, and clearing the mark opens it again', async () => {
    const { result } = renderHistory()
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.toggleViewed('a'))
    expect(result.current.viewedIds).toEqual(['a'])
    expect(result.current.collapsedIds).toEqual(['a'])

    act(() => result.current.toggleViewed('a'))
    expect(result.current.viewedIds).toEqual([])
    expect(result.current.collapsedIds).toEqual([])
  })

  test('starts fresh when another commit opens', async () => {
    const { result, rerender } = renderHistory()
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => {
      result.current.toggleViewed('a')
      result.current.expandGap('b', 'gap-0')
    })

    rerender({
      workspaceId: 'w-1',
      commits,
      enabled: true,
      commitId: 'c2',
      canRestore: true,
      onOpenCommit: vi.fn(),
      onOpenList: vi.fn(),
      onRestore: vi.fn(),
    })

    expect(result.current.viewedIds).toEqual([])
    expect(result.current.expandedGapKeys).toEqual([])
  })

  test('restores the open commit', async () => {
    const onRestore = vi.fn()
    const { result } = renderHistory({ commitId: 'c2', onRestore })

    act(() => result.current.onRestore())

    expect(onRestore).toHaveBeenCalledWith('c2')
  })

  test('shows the backend message when a commit cannot be read', async () => {
    vi.mocked(workspaceDetailService.commitDetail).mockRejectedValue(new Error('Commit not found'))
    const { result } = renderHistory()

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.error).toBeTruthy()
  })
})
