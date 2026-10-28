import type { CloudInvite, CloudMember } from '../types'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'

type Props = {
  workspace: CloudWorkspaceRef
  currentUserId: string
  members: CloudMember[]
  invites: CloudInvite[]
  loading: boolean
  error: string
  onInvite: () => void
  onCancelInvite: (id: string) => void
  onChangeRole: (member: CloudMember, role: 'editor' | 'viewer') => void
  onRemoveMember: (member: CloudMember) => void
  lastInviteLink: string
  onCopyInvite: () => void
}

export function TeamView({ workspace, currentUserId, members, invites, loading, error, onInvite, onCancelInvite, onChangeRole, onRemoveMember, lastInviteLink, onCopyInvite }: Props) {
  const isOwner = workspace.role === 'owner'
  return <div className="team-view">
    <section className="cloud-surface team-section">
      <div className="surface-heading"><div><h2>People with access</h2><p>Workspace members and their permissions.</p></div>{isOwner && <button type="button" className="cloud-button cloud-button-secondary" onClick={onInvite}><span className="button-plus">+</span>Invite teammate</button>}</div>
      {members.length ? <div className="team-table-wrap"><table className="team-table"><thead><tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Joined</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{members.map((member) => {
        const memberIsOwner = member.role === 'owner'
        const isSelf = member.id === currentUserId
        return <tr key={member.id}>
          <td><span className="member-avatar" aria-hidden="true">{member.email.slice(0, 1).toUpperCase()}</span><span className="member-email">{member.email}{isSelf && <small>You</small>}</span></td>
          <td>{isOwner && !memberIsOwner ? <select className="member-role-select" aria-label={`Role for ${member.email}`} value={member.role} onChange={(event) => onChangeRole(member, event.target.value as 'editor' | 'viewer')}><option value="editor">Editor</option><option value="viewer">Viewer</option></select> : <span className={`role-label role-${member.role}`}>{member.role[0].toUpperCase() + member.role.slice(1)}</span>}</td>
          <td>{formatDate(member.joinedAt)}</td>
          <td className="member-actions">{isOwner && !memberIsOwner && <button type="button" className="inline-action danger-action" onClick={() => onRemoveMember(member)}>Remove</button>}{isSelf && !memberIsOwner && <button type="button" className="inline-action danger-action" onClick={() => onRemoveMember(member)}>Leave workspace</button>}</td>
        </tr>
      })}</tbody></table></div> : loading ? <p className="team-loading">Loading members…</p> : <p className="team-loading">No members found.</p>}
    </section>
    {isOwner && <section className="cloud-surface team-section pending-section">
      <div className="surface-heading"><div><h2>Pending invitations</h2><p>Invitations expire seven days after they are sent.</p></div><span className="pending-count">{invites.length}</span></div>
      {error && <p className="form-error team-error" role="alert">{error}</p>}
      {lastInviteLink && <div className="invite-link-callout"><div><strong>Latest invitation link</strong><span>Use this link if the email could not be delivered.</span></div><button type="button" className="cloud-button cloud-button-secondary" onClick={onCopyInvite}>Copy link</button></div>}
      {loading ? <p className="team-loading">Loading invitations…</p> : invites.length ? <div className="invite-list">{invites.map((invite) => <div className="invite-row" key={invite.id}><span className="invite-envelope" aria-hidden="true"><EnvelopeMark /></span><span className="invite-copy"><strong>{invite.email}</strong><small>{invite.role[0].toUpperCase() + invite.role.slice(1)} · sent {formatDate(invite.createdAt)}</small></span><span className="invite-expires">Expires {formatDate(invite.expiresAt)}</span><button type="button" className="inline-action danger-action" onClick={() => onCancelInvite(invite.id)}>Cancel</button></div>)}</div> : <div className="embedded-empty"><strong>No pending invitations</strong><span>Invite a teammate to give them access to this workspace.</span></div>}
    </section>}
    <p className="team-permission-note">Owners manage access. Editors can update workspace content and push commits. Viewers can browse and pull.</p>
  </div>
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}
function EnvelopeMark() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.8" y="4.5" width="14.4" height="11" rx="1.5" /><path d="m3.5 5.6 6.5 5 6.5-5" /></svg> }
