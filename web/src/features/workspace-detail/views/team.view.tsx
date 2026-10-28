import { useTranslation } from 'react-i18next'
import { WORKSPACES_ROLE_TEXT } from '@/features/workspaces'
import { CopyButton } from '@/shared/components/copy-button'
import { EmptyState, LoadingState } from '@/shared/components/state-views'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table'
import type { CloudInvite, CloudMember } from '@/shared/models/cloud-workspace.model'
import { formatDate } from '@/shared/utils/format'
import { TEAM_TEXT } from '../constants/team-text.constants'
import type { MemberRole } from '../viewmodels/use-workspace-actions.viewmodel'

export interface TeamViewProps {
  workspaceName: string
  isOwner: boolean
  currentUserId: string
  members: CloudMember[]
  membersLoading: boolean
  invites: CloudInvite[]
  invitesLoading: boolean
  invitesError: string | null
  lastInviteLink: string
  onInvite: () => void
  onCancelInvite: (inviteId: string) => void
  onChangeRole: (member: CloudMember, role: MemberRole) => void
  onRemoveMember: (member: CloudMember) => void
  onCopyLink: () => void
}

export function TeamView({
  workspaceName,
  isOwner,
  currentUserId,
  members,
  membersLoading,
  invites,
  invitesLoading,
  invitesError,
  lastInviteLink,
  onInvite,
  onCancelInvite,
  onChangeRole,
  onRemoveMember,
  onCopyLink,
}: TeamViewProps) {
  const { t, i18n } = useTranslation('team')
  return (
    <div className="grid gap-6" data-testid="team-view">
      <Card>
        <CardHeader>
          <CardTitle>{t(TEAM_TEXT.people.title)}</CardTitle>
          <CardDescription>{t(TEAM_TEXT.people.detail)}</CardDescription>
          {isOwner && (
            <CardAction>
              <Button variant="outline" size="sm" onClick={onInvite}>
                {t(TEAM_TEXT.people.invite)}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <LoadingState label={t(TEAM_TEXT.people.loading)} />
          ) : !members.length ? (
            <p className="text-sm text-muted-foreground">{t(TEAM_TEXT.people.empty)}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(TEAM_TEXT.columns.member)}</TableHead>
                  <TableHead>{t(TEAM_TEXT.columns.role)}</TableHead>
                  <TableHead className="hidden md:table-cell">{t(TEAM_TEXT.columns.joined)}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t(TEAM_TEXT.columns.actions)}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isMemberOwner = member.role === 'owner'
                  const isSelf = member.id === currentUserId
                  const canChangeRole = isOwner && !isMemberOwner
                  const canRemove = isOwner && !isMemberOwner
                  const canLeave = isSelf && !isMemberOwner
                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold"
                          >
                            {member.email.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="grid min-w-0">
                            <span className="flex items-center gap-2 truncate text-sm font-medium">
                              {member.email}
                              {isSelf && <Badge variant="outline">{t(TEAM_TEXT.you)}</Badge>}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell>
                        {canChangeRole ? (
                          <RoleSelect member={member} onChange={(role) => onChangeRole(member, role)} />
                        ) : (
                          <Badge variant="secondary">{t(WORKSPACES_ROLE_TEXT[member.role])}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatDate(member.joinedAt, i18n.language)}
                      </TableCell>
                      <TableCell className="text-right">
                        {canRemove && (
                          <MemberAction
                            label={t(TEAM_TEXT.actions.remove)}
                            confirmTitle={t(TEAM_TEXT.confirm.remove, { email: member.email, name: workspaceName })}
                            confirmAction={t(TEAM_TEXT.confirm.removeAction)}
                            onConfirm={() => onRemoveMember(member)}
                          />
                        )}
                        {canLeave && (
                          <MemberAction
                            label={t(TEAM_TEXT.actions.leave)}
                            confirmTitle={t(TEAM_TEXT.confirm.leave, { name: workspaceName })}
                            confirmAction={t(TEAM_TEXT.confirm.leaveAction)}
                            onConfirm={() => onRemoveMember(member)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>{t(TEAM_TEXT.pending.title)}</CardTitle>
            <CardDescription>{t(TEAM_TEXT.pending.detail)}</CardDescription>
            <CardAction>
              <Badge variant="outline">{invites.length}</Badge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            {invitesError && (
              <Alert variant="destructive">
                <AlertDescription>{invitesError}</AlertDescription>
              </Alert>
            )}
            {lastInviteLink && (
              <Alert>
                <AlertTitle>{t(TEAM_TEXT.latestLink.title)}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>{t(TEAM_TEXT.latestLink.detail)}</span>
                  <CopyButton
                    value={lastInviteLink}
                    label={t(TEAM_TEXT.latestLink.copy)}
                    copiedLabel={t(TEAM_TEXT.invite.copied)}
                    onCopy={onCopyLink}
                  />
                </AlertDescription>
              </Alert>
            )}
            {invitesLoading ? (
              <LoadingState label={t(TEAM_TEXT.pending.loading)} />
            ) : invites.length ? (
              <ul className="grid gap-2">
                {invites.map((invite) => (
                  <li key={invite.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3">
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate text-sm font-medium">{invite.email}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(TEAM_TEXT.pending.sent, {
                          role: t(WORKSPACES_ROLE_TEXT[invite.role]),
                          date: formatDate(invite.createdAt, i18n.language) ?? '',
                        })}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(TEAM_TEXT.pending.expires, { date: formatDate(invite.expiresAt, i18n.language) ?? '' })}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => onCancelInvite(invite.id)}>
                      {t(TEAM_TEXT.pending.cancel)}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title={t(TEAM_TEXT.pending.empty)} detail={t(TEAM_TEXT.pending.emptyDetail)} />
            )}
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">{t(TEAM_TEXT.permissions)}</p>
    </div>
  )
}

function RoleSelect({ member, onChange }: { member: CloudMember; onChange: (role: MemberRole) => void }) {
  const { t } = useTranslation('team')
  const labels: Record<MemberRole, string> = { editor: t(TEAM_TEXT.roleEditor), viewer: t(TEAM_TEXT.roleViewer) }
  return (
    <Select
      value={member.role}
      onValueChange={(value) => {
        if (value === 'editor' || value === 'viewer') onChange(value)
      }}
    >
      <SelectTrigger aria-label={t(TEAM_TEXT.roleSelect, { email: member.email })} data-testid={`team-role-select-${member.id}`}>
        <SelectValue>{(value: string) => labels[value as MemberRole] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="editor">{t(TEAM_TEXT.roleEditor)}</SelectItem>
        <SelectItem value="viewer">{t(TEAM_TEXT.roleViewer)}</SelectItem>
      </SelectContent>
    </Select>
  )
}

function MemberAction({
  label,
  confirmTitle,
  confirmAction,
  onConfirm,
}: {
  label: string
  confirmTitle: string
  confirmAction: string
  onConfirm: () => void
}) {
  const { t } = useTranslation('team')
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive" />}>{label}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t(TEAM_TEXT.pending.cancel)}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmAction}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
