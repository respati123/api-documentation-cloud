import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MyMcpKeyView, type MyMcpKeyViewProps } from '@/features/mcp-access/views/my-mcp-key.view'

const key = {
  id: 'k-1',
  name: 'Laptop kerja',
  keySuffix: 'ab12',
  status: 'active' as const,
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-11-12T00:00:00.000Z',
}

function props(overrides: Partial<MyMcpKeyViewProps> = {}): MyMcpKeyViewProps {
  return {
    status: 'ready',
    keys: [key],
    activeCount: 1,
    limit: 10,
    canCreate: true,
    created: null,
    dismissCreated: vi.fn(),
    dialog: {
      open: false,
      name: '',
      setName: vi.fn(),
      validDays: 90,
      setValidDays: vi.fn(),
      canSubmit: false,
      isSubmitting: false,
      error: null,
      onOpen: vi.fn(),
      onClose: vi.fn(),
      onSubmit: vi.fn(),
    },
    revokingId: null,
    onRevoke: vi.fn(),
    access: [{ id: 'w-1', name: 'Klinik', roles: ['backend', 'qa'], tools: ['workspaces_list', 'story_write_test_case'] }],
    accessStatus: 'ready',
    guide: null,
    snippets: { env: 'export API_DOCS_MCP_KEY="apm_..."', claude: 'claude mcp add', codex: 'codex mcp add' },
    error: null,
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

describe('MyMcpKeyView', () => {
  test('the key table shows the name and only the last four characters, and never the secret', () => {
    render(<MyMcpKeyView {...props()} />)

    const row = screen.getByTestId('mcp-mine-keys-row-k-1')
    expect(row).toHaveTextContent('Laptop kerja')
    expect(row).toHaveTextContent('ab12')
    expect(row).toHaveTextContent('Never expires')
  })

  test('the create button opens the dialog, and is off at the limit', () => {
    const vm = props()
    const { rerender } = render(<MyMcpKeyView {...vm} />)

    fireEvent.click(screen.getByTestId('mcp-mine-create'))
    expect(vm.dialog.onOpen).toHaveBeenCalled()

    rerender(<MyMcpKeyView {...props({ canCreate: false, activeCount: 10 })} />)
    expect(screen.getByTestId('mcp-mine-create')).toBeDisabled()
    expect(screen.getByTestId('mcp-mine-limit')).toHaveTextContent('10')
  })

  test('a new secret is shown once with a copy button and can be dismissed', () => {
    const vm = props({ created: { name: 'Laptop kerja', secret: 'apm_secret' } })
    render(<MyMcpKeyView {...vm} />)

    expect(screen.getByTestId('mcp-mine-secret')).toHaveTextContent('apm_secret')
    fireEvent.click(screen.getByTestId('mcp-mine-secret-dismiss'))
    expect(vm.dismissCreated).toHaveBeenCalled()
  })

  test('revoking asks for confirmation first', () => {
    const vm = props()
    render(<MyMcpKeyView {...vm} />)

    fireEvent.click(screen.getByTestId('mcp-mine-keys-revoke-k-1'))
    expect(vm.onRevoke).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('mcp-mine-keys-revoke-k-1-confirm'))
    expect(vm.onRevoke).toHaveBeenCalledWith(key)
  })

  test('the access table lists the roles and tools per workspace', () => {
    render(<MyMcpKeyView {...props()} />)

    const row = screen.getByTestId('mcp-mine-access-w-1')
    expect(row).toHaveTextContent('Klinik')
    expect(row).toHaveTextContent('Backend')
    expect(row).toHaveTextContent('QA')
    expect(row).toHaveTextContent('2 tools')
  })

  test('without keys the empty state offers to create one', () => {
    const vm = props({ status: 'empty', keys: [], activeCount: 0 })
    render(<MyMcpKeyView {...vm} />)

    fireEvent.click(screen.getByTestId('mcp-mine-empty-create'))
    expect(vm.dialog.onOpen).toHaveBeenCalled()
  })
})
