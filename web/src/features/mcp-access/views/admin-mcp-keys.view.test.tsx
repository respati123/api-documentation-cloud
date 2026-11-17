import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AdminMcpKeysView, type AdminMcpKeysViewProps } from '@/features/mcp-access/views/admin-mcp-keys.view'

const key = {
  id: 'k-1',
  name: 'Server CI',
  keySuffix: 'zz99',
  status: 'active' as const,
  expiresAt: '2027-02-10T00:00:00.000Z',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-11-12T00:00:00.000Z',
  owner: { id: 'u-1', email: 'rani@contoh.test' },
}

function props(overrides: Partial<AdminMcpKeysViewProps> = {}): AdminMcpKeysViewProps {
  return {
    isAdmin: true,
    search: '',
    setSearch: vi.fn(),
    keys: [key],
    status: 'ready',
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
    revokingId: null,
    onRevoke: vi.fn(),
    error: null,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

describe('AdminMcpKeysView', () => {
  test('each key shows its owner, name, and last four characters', () => {
    render(<AdminMcpKeysView {...props()} />)

    const row = screen.getByTestId('mcp-admin-keys-row-k-1')
    expect(row).toHaveTextContent('rani@contoh.test')
    expect(row).toHaveTextContent('Server CI')
    expect(row).toHaveTextContent('zz99')
  })

  test('typing in the search box updates the search', () => {
    const vm = props()
    render(<AdminMcpKeysView {...vm} />)

    fireEvent.change(screen.getByTestId('mcp-admin-search'), { target: { value: 'rani' } })

    expect(vm.setSearch).toHaveBeenCalledWith('rani')
  })

  test('the admin revokes a key after confirming', () => {
    const vm = props()
    render(<AdminMcpKeysView {...vm} />)

    fireEvent.click(screen.getByTestId('mcp-admin-keys-revoke-k-1'))
    fireEvent.click(screen.getByTestId('mcp-admin-keys-revoke-k-1-confirm'))

    expect(vm.onRevoke).toHaveBeenCalledWith(key)
  })

  test('an empty list says there are no keys', () => {
    render(<AdminMcpKeysView {...props({ status: 'empty', keys: [] })} />)

    expect(screen.getByTestId('mcp-admin-empty')).toBeInTheDocument()
  })
})
