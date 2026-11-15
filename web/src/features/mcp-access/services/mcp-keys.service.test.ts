import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mcpKeysService } from '@/features/mcp-access/services/mcp-keys.service'
import { apiCall, apiPage } from '@/shared/services/api-client'

vi.mock('@/shared/services/api-client', () => ({ apiCall: vi.fn(), apiPage: vi.fn() }))

const key = {
  id: 'k-1',
  name: 'Laptop',
  keySuffix: 'ab12',
  status: 'active',
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-11-12T00:00:00.000Z',
}

beforeEach(() => {
  vi.mocked(apiCall).mockReset()
  vi.mocked(apiPage).mockReset()
})

describe('mcpKeysService', () => {
  test('myKeys returns the keys and the limit', async () => {
    vi.mocked(apiCall).mockResolvedValue({ keys: [key], limit: 10 })

    await expect(mcpKeysService.myKeys('')).resolves.toEqual({ keys: [key], limit: 10 })
    expect(apiCall).toHaveBeenCalledWith('/api/me/mcp-keys', { token: '' })
  })

  test('create posts the name and validity, and returns the secret once', async () => {
    vi.mocked(apiCall).mockResolvedValue({ secret: 'apm_secret', key })

    const result = await mcpKeysService.create('', { name: 'Laptop', validDays: null })

    expect(result.secret).toBe('apm_secret')
    expect(apiCall).toHaveBeenCalledWith('/api/me/mcp-keys', { token: '', method: 'POST', body: { name: 'Laptop', validDays: null } })
  })

  test('revoke deletes the member’s own key', async () => {
    vi.mocked(apiCall).mockResolvedValue(undefined)

    await mcpKeysService.revoke('', 'k-1')

    expect(apiCall).toHaveBeenCalledWith('/api/me/mcp-keys/k-1', { token: '', method: 'DELETE' })
  })

  test('access returns the roles and tools per workspace', async () => {
    vi.mocked(apiCall).mockResolvedValue({
      workspaces: [{ id: 'w-1', name: 'Klinik', roles: ['backend', 'qa'], tools: ['workspaces_list'] }],
    })

    await expect(mcpKeysService.access('')).resolves.toEqual([
      { id: 'w-1', name: 'Klinik', roles: ['backend', 'qa'], tools: ['workspaces_list'] },
    ])
  })

  test('adminKeys sends the search and returns the page with each owner', async () => {
    vi.mocked(apiPage).mockResolvedValue({ data: { keys: [{ ...key, owner: { id: 'u-1', email: 'a@b.test' } }] }, nextCursor: 'next' })

    const page = await mcpKeysService.adminKeys('', ' a@b ', null)

    expect(page.items[0]?.owner.email).toBe('a@b.test')
    expect(page.nextCursor).toBe('next')
    expect(vi.mocked(apiPage).mock.calls[0]?.[0]).toContain('q=a%40b')
  })

  test('adminRevoke deletes any key', async () => {
    vi.mocked(apiCall).mockResolvedValue(undefined)

    await mcpKeysService.adminRevoke('', 'k-9')

    expect(apiCall).toHaveBeenCalledWith('/api/admin/mcp-keys/k-9', { token: '', method: 'DELETE' })
  })
})
