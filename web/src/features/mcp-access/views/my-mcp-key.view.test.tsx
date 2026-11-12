import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { MyMcpKeyView, type MyMcpKeyViewProps } from '@/features/mcp-access/views/my-mcp-key.view'

const pendingKey = {
  id: 'k-1',
  name: 'Laptop',
  role: 'backend' as const,
  tools: ['workspaces_list'],
  validDays: 30,
  status: 'pending' as const,
  claimExpiresAt: '2026-11-19T00:00:00.000Z',
  claimedAt: null,
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-11-12T00:00:00.000Z',
}

const baseProps: MyMcpKeyViewProps = {
  status: 'ready',
  mcpKey: pendingKey,
  canClaim: true,
  needsNewKey: false,
  isClaiming: false,
  onClaim: vi.fn(),
  secret: null,
  dismissSecret: vi.fn(),
  guide: null,
  snippets: { env: 'export API_DOCS_MCP_KEY="apm_..."', claude: 'claude mcp add', codex: 'codex mcp add' },
  error: null,
}

afterEach(() => {
  cleanup()
})

describe('MyMcpKeyView', () => {
  test('a pending key can be claimed', () => {
    const onClaim = vi.fn()
    render(<MyMcpKeyView {...baseProps} onClaim={onClaim} />)

    fireEvent.click(screen.getByTestId('mcp-mine-claim'))

    expect(onClaim).toHaveBeenCalled()
  })

  test('the secret shows with a copy button after claiming', () => {
    render(<MyMcpKeyView {...baseProps} canClaim={false} mcpKey={{ ...pendingKey, status: 'active' }} secret="apm_once" />)

    expect(screen.getByTestId('mcp-mine-secret')).toHaveTextContent('apm_once')
    expect(screen.queryByTestId('mcp-mine-claim')).not.toBeInTheDocument()
  })

  test('a member without a key sees who creates it, and the setup steps', () => {
    render(<MyMcpKeyView {...baseProps} status="empty" mcpKey={null} canClaim={false} />)

    expect(screen.getByTestId('mcp-mine-empty')).toBeInTheDocument()
    expect(screen.getByTestId('mcp-mine-setup')).toHaveTextContent('claude mcp add')
  })

  test('the required playbook for the role of the key is shown when there is one', () => {
    const { rerender } = render(<MyMcpKeyView {...baseProps} />)
    expect(screen.queryByTestId('mcp-mine-guide')).not.toBeInTheDocument()

    rerender(<MyMcpKeyView {...baseProps} guide={{ role: 'backend', version: '2026-11-12.1', guide: 'Call planning_guide first.' }} />)

    expect(screen.getByTestId('mcp-mine-guide')).toHaveTextContent('Call planning_guide first.')
  })
})
