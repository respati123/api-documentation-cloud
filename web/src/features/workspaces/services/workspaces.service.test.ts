import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiCall } from '@/shared/services/api-client'
import { workspacesService } from './workspaces.service'

vi.mock('@/shared/services/api-client', () => ({
  apiCall: vi.fn(),
}))

const ref = { id: 'ws-1', name: 'Payments API', role: 'owner', headCommitId: 'c-1', createdAt: '2026-10-28T00:00:00Z', updatedAt: null }

beforeEach(() => {
  vi.mocked(apiCall).mockReset()
})

describe('workspacesService.list', () => {
  test('requests the list with the bearer token and returns parsed rows', async () => {
    vi.mocked(apiCall).mockResolvedValue({ workspaces: [ref] })

    await expect(workspacesService.list('token-1')).resolves.toEqual([ref])
    expect(apiCall).toHaveBeenCalledWith('/api/workspaces', { token: 'token-1' })
  })

  test('rejects a row with an unknown role', async () => {
    vi.mocked(apiCall).mockResolvedValue({ workspaces: [{ ...ref, role: 'admin' }] })

    await expect(workspacesService.list('token-1')).rejects.toThrow()
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
