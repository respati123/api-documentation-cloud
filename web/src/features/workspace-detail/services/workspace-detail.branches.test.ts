import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiCall } from '@/shared/services/api-client'
import { workspaceDetailService } from './workspace-detail.service'

vi.mock('@/shared/services/api-client', () => ({
  apiCall: vi.fn(),
  apiPage: vi.fn(),
}))

const folder = (id: string) => ({ id, kind: 'folder', name: id, children: [] })
const snapshot = {
  workspace: {
    id: 'ws-1',
    name: 'Payments',
    role: 'owner',
    headCommitId: 'c-1',
    createdAt: '2026-10-28T00:00:00Z',
    updatedAt: null,
    tree: [folder('stale')],
    usesBranches: true,
  },
}

beforeEach(() => {
  vi.mocked(apiCall).mockReset()
})

describe('workspace detail with collection branches', () => {
  test('pull says that the workspace syncs by branches', async () => {
    vi.mocked(apiCall).mockResolvedValue(snapshot)
    expect((await workspaceDetailService.pull('t', 'ws-1'))?.usesBranches).toBe(true)
  })

  test('the tree comes from each branch head, in branch order, and not from the old workspace head', async () => {
    vi.mocked(apiCall)
      .mockResolvedValueOnce({
        branches: [
          { id: 'b1', collectionKey: 'users', name: 'main', headCommitId: 'c2', createdBy: 'u1', createdAt: '2026-10-28T00:00:00Z' },
          { id: 'b2', collectionKey: 'orders', name: 'main', headCommitId: 'c3', createdBy: 'u1', createdAt: '2026-10-28T00:00:00Z' },
        ],
      })
      .mockResolvedValueOnce({ branch: { id: 'b1', collectionKey: 'users', name: 'main' }, headCommitId: 'c2', tree: [folder('users')] })
      .mockResolvedValueOnce({ branch: { id: 'b2', collectionKey: 'orders', name: 'main' }, headCommitId: 'c3', tree: [folder('orders')] })

    const tree = await workspaceDetailService.branchTree('t', 'ws-1')
    expect(tree.map((node) => node.id)).toEqual(['users', 'orders'])
    expect(vi.mocked(apiCall).mock.calls[0][0]).toBe('/api/workspaces/ws-1/branches')
  })
})
