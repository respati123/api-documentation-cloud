import { beforeEach, describe, expect, test, vi } from 'vitest'
import { mcpKeysService } from '@/features/mcp-access/services/mcp-keys.service'
import { apiCall, apiPage } from '@/shared/services/api-client'

vi.mock('@/shared/services/api-client', () => ({ apiCall: vi.fn(), apiPage: vi.fn() }))

const key = {
  id: 'k-1',
  name: 'Laptop',
  role: 'backend',
  tools: ['workspaces_list'],
  validDays: 30,
  status: 'pending',
  claimExpiresAt: '2026-11-19T00:00:00.000Z',
  claimedAt: null,
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
  test('myKey returns null when the member has no key', async () => {
    vi.mocked(apiCall).mockResolvedValue({ key: null })

    await expect(mcpKeysService.myKey('')).resolves.toBeNull()
    expect(apiCall).toHaveBeenCalledWith('/api/me/mcp-key', { token: '' })
  })

  test('claim posts to the key and returns the secret once', async () => {
    vi.mocked(apiCall).mockResolvedValue({ secret: 'apm_secret', key: { ...key, status: 'active' } })

    const result = await mcpKeysService.claim('', 'k-1')

    expect(result.secret).toBe('apm_secret')
    expect(apiCall).toHaveBeenCalledWith('/api/me/mcp-key/k-1/claim', { token: '', method: 'POST' })
  })

  test('members sends the search and returns the page', async () => {
    vi.mocked(apiPage).mockResolvedValue({
      data: { members: [{ userId: 'u-1', email: 'a@b.test', workspaceCount: 2, key }] },
      nextCursor: 'next',
    })

    const page = await mcpKeysService.members('', ' a@b ', null)

    expect(page).toMatchObject({ nextCursor: 'next', items: [{ userId: 'u-1', key: { id: 'k-1' } }] })
    expect(vi.mocked(apiPage).mock.calls[0][0]).toContain('&q=a%40b')
  })

  test('a response with an unknown status is refused', async () => {
    vi.mocked(apiCall).mockResolvedValue({ key: { ...key, status: 'lost' } })

    await expect(mcpKeysService.myKey('')).rejects.toThrow()
  })
})
