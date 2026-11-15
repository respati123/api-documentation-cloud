import '@/shared/i18n'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { WorkspacePageView, type WorkspacePageViewProps } from './workspace-page.view'

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
  tabs: ['overview', 'docs', 'team'],
  memberCount: 3,
  liveStatus: 'live',
  onTabChange: vi.fn(),
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
})
