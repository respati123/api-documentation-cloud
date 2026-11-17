import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { WorkspacePageView, type WorkspacePageViewProps } from '@/features/workspace-detail/views/workspace-page.view'

const baseProps: WorkspacePageViewProps = {
  workspace: {
    id: 'w-1',
    name: 'Payments API',
    role: 'viewer',
    headCommitId: null,
    createdAt: '2026-11-12T00:00:00.000Z',
    updatedAt: null,
  },
  adminView: false,
  activeTab: 'overview',
  canInvite: false,
  liveStatus: 'live',
  onInvite: vi.fn(),
  children: null,
}

afterEach(() => {
  cleanup()
})

describe('WorkspacePageView', () => {
  test('an admin reading a workspace they are not a member of sees an admin badge instead of a role', () => {
    const { rerender } = render(<WorkspacePageView {...baseProps} />)
    const memberBadge = screen.getByTestId('workspace-role-badge').textContent

    rerender(<WorkspacePageView {...baseProps} adminView />)

    expect(screen.getByTestId('workspace-role-badge').textContent).not.toBe(memberBadge)
    expect(screen.getByTestId('workspace-role-badge')).toHaveTextContent('Admin')
  })

  test('names the open section in the header, with no tab row', () => {
    const { rerender } = render(<WorkspacePageView {...baseProps} activeTab="history" />)
    const historyTitle = screen.getByTestId('workspace-section-title').textContent

    rerender(<WorkspacePageView {...baseProps} activeTab="collections" />)

    expect(screen.getByTestId('workspace-section-title').textContent).not.toBe(historyTitle)
    expect(screen.queryByTestId('workspace-tabs')).not.toBeInTheDocument()
  })

  test('shows the invite button only when the viewmodel allows it', () => {
    const onInvite = vi.fn()
    const { rerender } = render(<WorkspacePageView {...baseProps} onInvite={onInvite} />)
    expect(screen.queryByTestId('workspace-invite-button')).not.toBeInTheDocument()

    rerender(<WorkspacePageView {...baseProps} canInvite onInvite={onInvite} />)
    fireEvent.click(screen.getByTestId('workspace-invite-button'))

    expect(onInvite).toHaveBeenCalledTimes(1)
  })
})
