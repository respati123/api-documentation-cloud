import '@/shared/i18n'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { McpKeyMember } from '@/features/mcp-access/models/mcp-key.model'
import { AdminMcpKeysView, type AdminMcpKeysViewProps } from '@/features/mcp-access/views/admin-mcp-keys.view'

const key = {
  id: 'k-1',
  name: 'Laptop',
  role: 'qa' as const,
  tools: ['workspaces_list'],
  validDays: 30,
  status: 'active' as const,
  claimExpiresAt: '2026-11-19T00:00:00.000Z',
  claimedAt: '2026-11-12T00:00:00.000Z',
  expiresAt: '2026-12-12T00:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-11-12T00:00:00.000Z',
}

function props(members: McpKeyMember[]): AdminMcpKeysViewProps {
  return {
    isAdmin: true,
    search: '',
    setSearch: vi.fn(),
    members,
    status: members.length ? 'ready' : 'empty',
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
    error: null,
    busyKeyId: null,
    onReissue: vi.fn(),
    onRevoke: vi.fn(),
    allTools: [],
    dialog: null,
    openDialog: vi.fn(),
    closeDialog: vi.fn(),
    setName: vi.fn(),
    setRole: vi.fn(),
    toggleTool: vi.fn(),
    resetTools: vi.fn(),
    setValidDays: vi.fn(),
    onSubmit: vi.fn(),
  }
}

afterEach(() => {
  cleanup()
})

describe('AdminMcpKeysView', () => {
  test('a member without a key gets a create button', () => {
    render(<AdminMcpKeysView {...props([{ userId: 'u-1', email: 'a@b.test', workspaceCount: 1, key: null }])} />)

    expect(screen.getByTestId('mcp-admin-row-u-1-create')).toBeInTheDocument()
    expect(screen.getByTestId('mcp-admin-row-u-1')).toHaveTextContent('None')
  })

  test('an active key can be reissued or revoked', () => {
    render(<AdminMcpKeysView {...props([{ userId: 'u-1', email: 'a@b.test', workspaceCount: 1, key }])} />)

    expect(screen.getByTestId('mcp-admin-row-u-1-reissue')).toBeInTheDocument()
    expect(screen.getByTestId('mcp-admin-row-u-1-revoke')).toHaveTextContent('Revoke')
  })

  test('a pending key offers to cancel the claim', () => {
    render(<AdminMcpKeysView {...props([{ userId: 'u-1', email: 'a@b.test', workspaceCount: 1, key: { ...key, status: 'pending' } }])} />)

    expect(screen.getByTestId('mcp-admin-row-u-1-revoke')).toHaveTextContent('Cancel claim')
  })
})
