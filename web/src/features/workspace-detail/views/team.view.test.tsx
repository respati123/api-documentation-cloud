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
}

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
})
