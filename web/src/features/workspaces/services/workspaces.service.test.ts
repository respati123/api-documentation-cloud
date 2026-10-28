import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiCall, apiPage } from '@/shared/services/api-client'
import { workspacesService } from './workspaces.service'

vi.mock('@/shared/services/api-client', () => ({
  apiCall: vi.fn(),
  apiPage: vi.fn(),
}))

const ref = { id: 'ws-1', name: 'Payments API', role: 'owner', headCommitId: 'c-1', createdAt: '2026-10-28T00:00:00Z', updatedAt: null }

beforeEach(() => {
  vi.mocked(apiCall).mockReset()
  vi.mocked(apiPage).mockReset()
})

describe('workspacesService.listPage', () => {
  test('requests the first page with the bearer token and returns the rows, next cursor, and counts', async () => {
    vi.mocked(apiPage).mockResolvedValue({ data: { workspaces: [ref], counts: { total: 4, owned: 1 } }, nextCursor: 'next-1' })

    await expect(workspacesService.listPage('token-1', null)).resolves.toEqual({
      items: [ref],
      nextCursor: 'next-1',
      counts: { total: 4, owned: 1 },
    })
    expect(apiPage).toHaveBeenCalledWith('/api/workspaces?limit=50', { token: 'token-1' })
  })

  test('sends the cursor for the next page', async () => {
    vi.mocked(apiPage).mockResolvedValue({ data: { workspaces: [], counts: { total: 0, owned: 0 } }, nextCursor: null })

    await workspacesService.listPage('token-1', 'next-1')
    expect(apiPage).toHaveBeenCalledWith('/api/workspaces?limit=50&cursor=next-1', { token: 'token-1' })
  })

  test('rejects a row with an unknown role', async () => {
    vi.mocked(apiPage).mockResolvedValue({
      data: { workspaces: [{ ...ref, role: 'admin' }], counts: { total: 1, owned: 0 } },
      nextCursor: null,
    })

    await expect(workspacesService.listPage('token-1', null)).rejects.toThrow()
  })
})

describe('workspacesService.create', () => {
  test('posts an empty workspace with the given name', async () => {
    vi.mocked(apiCall).mockResolvedValue({ workspace: { id: 'ws-2', name: 'Billing API' } })

    await expect(workspacesService.create('token-1', 'Billing API')).resolves.toEqual({ id: 'ws-2', name: 'Billing API' })
    expect(apiCall).toHaveBeenCalledWith('/api/workspaces', {
      method: 'POST',
      token: 'token-1',
      body: { name: 'Billing API', tree: [], variables: { globals: [], environments: [] } },
    })
  })
})
