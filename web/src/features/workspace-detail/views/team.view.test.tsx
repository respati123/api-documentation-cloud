import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { TeamView, type TeamViewProps } from './team.view'

const baseProps: TeamViewProps = {
  workspaceName: 'Payments API',
  isOwner: true,
  currentUserId: 'me',
  members: [],
  membersLoading: false,
  invites: [],
  invitesLoading: false,
  invitesError: null,
  invitesHasMore: false,
  invitesLoadingMore: false,
  onLoadMoreInvites: vi.fn(),
  membersHasMore: false,
  membersLoadingMore: false,
  onLoadMoreMembers: vi.fn(),
  lastInviteLink: '',
  onInvite: vi.fn(),
  onCancelInvite: vi.fn(),
  onChangeRole: vi.fn(),
  onRemoveMember: vi.fn(),
  onCopyLink: vi.fn(),
  projectRoles: { roleOf: () => null, canAssign: false, savingMemberId: null, onAssign: vi.fn(), error: null },
}

const editor = { id: 'u-2', email: 'dev@example.com', role: 'editor' as const, joinedAt: '2026-01-01T00:00:00.000Z' }

afterEach(() => {
  cleanup()
})

describe('TeamView', () => {
  test('lets an owner invite a teammate', () => {
    render(<TeamView {...baseProps} />)

    expect(screen.getByRole('button', { name: 'Invite teammate' })).toBeInTheDocument()
  })

  test('hides the invite button and the pending list from a viewer', () => {
    render(<TeamView {...baseProps} isOwner={false} />)

    expect(screen.queryByRole('button', { name: 'Invite teammate' })).not.toBeInTheDocument()
    expect(screen.queryByText('Pending invitations')).not.toBeInTheDocument()
  })

  test('shows the empty pending state for an owner with no invitations', () => {
    render(<TeamView {...baseProps} />)

    expect(screen.getByText('No pending invitations')).toBeInTheDocument()
  })

  test('loads the next page of members when more exist', () => {
    const onLoadMoreMembers = vi.fn()
    render(<TeamView {...baseProps} membersHasMore onLoadMoreMembers={onLoadMoreMembers} />)

    fireEvent.click(screen.getByTestId('team-members-load-more'))
    expect(onLoadMoreMembers).toHaveBeenCalledTimes(1)
  })

  test('shows the project role of a member as a badge when the viewer cannot assign roles', () => {
    render(<TeamView {...baseProps} members={[editor]} projectRoles={{ ...baseProps.projectRoles, roleOf: () => 'tech_lead' }} />)

    expect(screen.getByText('Tech lead')).toBeInTheDocument()
    expect(screen.queryByTestId('team-project-role-u-2')).not.toBeInTheDocument()
  })

  test('gives a role picker to someone who can assign project roles', () => {
    render(<TeamView {...baseProps} members={[editor]} projectRoles={{ ...baseProps.projectRoles, canAssign: true }} />)

    expect(screen.getByTestId('team-project-role-u-2')).toBeInTheDocument()
  })
})
