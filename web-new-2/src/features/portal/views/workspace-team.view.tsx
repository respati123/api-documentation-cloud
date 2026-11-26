import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { MemberRole } from '../models/portal.model'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import { EmptyView, ErrorView, LoadingView } from './state.view'

export function WorkspaceTeamView({ vm }: { vm: PortalViewModel }) {
  const { t } = useTranslation()
  const team = vm.team
  const members = team.members.data?.pages.flatMap(page => page.items) ?? []
  const invites = team.invites.data?.pages.flatMap(page => page.items) ?? []
  const availableMembers = team.memberOptions.data?.pages.flatMap(page => page.items) ?? []
  const currentUserId = vm.me.data?.id

  return (
    <FieldGroup className="gap-4" data-testid="workspace-team-view-container">
      <Card className="gap-4 rounded-lg py-0 shadow-none">
        <CardHeader className="flex min-w-0 flex-row flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <FieldGroup className="min-w-0 flex-1 gap-1">
            <CardTitle className="text-base">{t('team.people')}</CardTitle>
            <CardDescription>{t('team.manageDescription')}</CardDescription>
          </FieldGroup>
          {team.canManage && (
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={team.openAddDialog}
              data-testid="workspace-add-member-button"
            >
              {t('team.addExisting')}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          {team.changeRole.error && <ErrorView error={team.changeRole.error} testId="workspace-member-role-error" />}
          {team.members.isPending ? (
            <LoadingView />
          ) : team.members.error ? (
            <ErrorView error={team.members.error} retry={() => void team.members.refetch()} />
          ) : !members.length ? (
            <EmptyView
              title={t('team.noMembers')}
              description={t('team.noMembersDescription')}
              testId="workspace-members-empty-state"
            />
          ) : (
            <>
            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.colMember')}</TableHead>
                  <TableHead>{t('team.colRole')}</TableHead>
                  <TableHead className="text-right">{t('team.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map(member => {
                  const isOwner = member.role === 'owner'
                  const isSelf = member.id === currentUserId
                  const canChangeRole = team.canManage && !isOwner
                  const canRemove = (team.canManage && !isOwner) || (isSelf && !isOwner)

                  return (
                    <TableRow key={member.id} data-testid={`workspace-member-${member.id}`}>
                      <TableCell className="whitespace-normal">
                        <FieldGroup className="gap-1">
                          <CardDescription className="font-medium break-all text-foreground">
                            {member.email}
                            {isSelf && <Badge className="ml-2" variant="outline">{t('team.you')}</Badge>}
                          </CardDescription>
                          <CardDescription className="text-xs">
                            {t('team.joined', { date: new Date(member.joinedAt).toLocaleDateString() })}
                          </CardDescription>
                        </FieldGroup>
                      </TableCell>
                      <TableCell>
                        {canChangeRole ? (
                          <MemberRoleSelect
                            memberId={member.id}
                            email={member.email}
                            role={member.role as MemberRole}
                            disabled={team.changeRole.isPending}
                            onChange={role => team.changeRole.mutate({ memberId: member.id, role })}
                          />
                        ) : (
                          <Badge variant="secondary">{t(`role.${member.role}`)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {canRemove && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="cursor-pointer text-destructive hover:text-destructive"
                            disabled={team.removeMember.isPending}
                            onClick={() => team.setRemoveTarget(member)}
                            data-testid={`workspace-member-${member.id}-remove-button`}
                          >
                            {isSelf ? t('team.leave') : t('team.remove')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <FieldGroup className="gap-0 sm:hidden" data-testid="workspace-members-list">
              {members.map(member => {
                const isOwner = member.role === 'owner'
                const isSelf = member.id === currentUserId
                const canChangeRole = team.canManage && !isOwner
                const canRemove = (team.canManage && !isOwner) || (isSelf && !isOwner)

                return (
                  <FieldGroup
                    key={member.id}
                    className="gap-2 border-b py-4 last:border-0"
                    data-testid={`workspace-member-card-${member.id}`}
                  >
                    <FieldGroup className="flex-row items-start justify-between gap-3">
                      <FieldGroup className="min-w-0 gap-1">
                        <CardDescription className="font-medium break-all text-foreground">
                          {member.email}
                          {isSelf && <Badge className="ml-2" variant="outline">{t('team.you')}</Badge>}
                        </CardDescription>
                        <CardDescription className="text-xs">
                          {t('team.joined', { date: new Date(member.joinedAt).toLocaleDateString() })}
                        </CardDescription>
                      </FieldGroup>
                      {canChangeRole ? (
                        <MemberRoleSelect
                          memberId={member.id}
                          email={member.email}
                          role={member.role as MemberRole}
                          disabled={team.changeRole.isPending}
                          onChange={role => team.changeRole.mutate({ memberId: member.id, role })}
                        />
                      ) : (
                        <Badge variant="secondary">{t(`role.${member.role}`)}</Badge>
                      )}
                    </FieldGroup>
                    {canRemove && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-fit cursor-pointer px-0 text-destructive hover:text-destructive"
                        disabled={team.removeMember.isPending}
                        onClick={() => team.setRemoveTarget(member)}
                        data-testid={`workspace-member-card-${member.id}-remove-button`}
                      >
                        {isSelf ? t('team.leave') : t('team.remove')}
                      </Button>
                    )}
                  </FieldGroup>
                )
              })}
            </FieldGroup>
            </>
          )}
          {team.members.hasNextPage && (
            <Button
              type="button"
              variant="outline"
              className="mx-4 w-[calc(100%-2rem)] cursor-pointer"
              disabled={team.members.isFetchingNextPage}
              onClick={() => void team.members.fetchNextPage()}
              data-testid="members-more-button"
            >
              {team.members.isFetchingNextPage ? t('common.loadingEllipsis') : t('team.loadMoreMembers')}
            </Button>
          )}
        </CardContent>
      </Card>

      {team.canManage && (
        <Card className="gap-4 rounded-lg py-0 shadow-none">
          <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-3 px-4 pt-4">
            <FieldGroup className="min-w-0 flex-1 gap-1">
              <CardTitle className="text-base">{t('team.pendingInvites')}</CardTitle>
              <CardDescription>{t('team.pendingInvitesDescription')}</CardDescription>
            </FieldGroup>
            <Badge variant="outline">{invites.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            {team.cancelInvite.error && <ErrorView error={team.cancelInvite.error} testId="workspace-invite-cancel-error" />}
            {team.invites.isPending ? (
              <Skeleton className="mx-4 h-16 w-[calc(100%-2rem)]" data-testid="workspace-invites-loading-state" />
            ) : team.invites.error ? (
              <ErrorView error={team.invites.error} retry={() => void team.invites.refetch()} />
            ) : !invites.length ? (
              <EmptyView
                title={t('team.noPendingInvites')}
                description={t('team.noPendingInvitesDescription')}
                testId="workspace-invites-empty-state"
              />
            ) : (
              <FieldGroup className="gap-0 px-4">
                {invites.map(invite => (
                  <FieldGroup
                    key={invite.id}
                    className="flex-row flex-wrap items-center justify-between gap-3 border-b border-border/70 py-3 last:border-0"
                    data-testid={`workspace-invite-${invite.id}`}
                  >
                    <FieldGroup className="min-w-0 flex-1 gap-1">
                      <CardDescription className="font-medium text-foreground">{invite.email}</CardDescription>
                      <CardDescription className="text-xs">
                        {t('team.inviteExpires', { role: t(`role.${invite.role}`), date: new Date(invite.expiresAt).toLocaleDateString() })}
                      </CardDescription>
                    </FieldGroup>
                    <Button
                      type="button"
                      variant="ghost"
                      className="cursor-pointer"
                      disabled={team.cancelInvite.isPending}
                      onClick={() => team.cancelInvite.mutate(invite.id)}
                      data-testid={`workspace-invite-${invite.id}-cancel-button`}
                    >
                      {t('team.cancelInvitation')}
                    </Button>
                  </FieldGroup>
                ))}
              </FieldGroup>
            )}
            {team.invites.hasNextPage && (
              <Button
                type="button"
                variant="outline"
                className="mx-4 w-[calc(100%-2rem)] cursor-pointer"
                disabled={team.invites.isFetchingNextPage}
                onClick={() => void team.invites.fetchNextPage()}
                data-testid="workspace-invites-more-button"
              >
                {team.invites.isFetchingNextPage ? t('common.loadingEllipsis') : t('team.loadMoreInvitations')}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={team.addDialogOpen} onOpenChange={open => !open && team.closeAddDialog()}>
        <DialogContent data-testid="workspace-add-member-dialog">
          <DialogHeader>
            <DialogTitle>{t('team.addDialogTitle')}</DialogTitle>
          <DialogDescription>{t('team.addDialogDescription')}</DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <Field className="gap-2">
              <FieldLabel htmlFor="workspace-member-search">{t('team.searchAccounts')}</FieldLabel>
              <Input
                id="workspace-member-search"
                type="search"
                autoComplete="off"
                value={team.search}
                onChange={event => team.updateSearch(event.target.value)}
                data-testid="workspace-member-search-input"
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel>{t('team.account')}</FieldLabel>
              <Select value={team.selectedUserId} onValueChange={team.setSelectedUserId}>
                <SelectTrigger
                  aria-label={t('team.chooseAccountAria')}
                  data-testid="workspace-member-account-select"
                >
                  <SelectValue placeholder={t('team.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableMembers.map(member => (
                      <SelectItem
                        key={member.id}
                        value={member.id}
                        data-testid={`workspace-member-option-${member.id}`}
                      >
                        {member.email}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {team.memberOptions.isPending && (
                <Skeleton className="h-9 w-full" data-testid="workspace-member-options-loading" />
              )}
              {team.memberOptions.error && (
                <ErrorView
                  error={team.memberOptions.error}
                  retry={() => void team.memberOptions.refetch()}
                  testId="workspace-member-options-error"
                />
              )}
              {!team.memberOptions.isPending && !team.memberOptions.error && !availableMembers.length && (
                <EmptyView
                  title={t('team.noAccounts')}
                  description={t('team.noAccountsDescription')}
                  testId="workspace-member-options-empty-state"
                />
              )}
              {team.memberOptions.hasNextPage && (
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={team.memberOptions.isFetchingNextPage}
                  onClick={() => void team.memberOptions.fetchNextPage()}
                  data-testid="workspace-member-options-more-button"
                >
                  {team.memberOptions.isFetchingNextPage ? t('common.loadingEllipsis') : t('team.loadMoreAccounts')}
                </Button>
              )}
            </Field>
            <Field className="gap-2">
              <FieldLabel>{t('team.workspaceRole')}</FieldLabel>
              <Select value={team.role} onValueChange={value => setInviteRole(team, value)}>
                <SelectTrigger aria-label={t('team.chooseRoleAria')} data-testid="workspace-member-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="editor">{t('roleTitle.editor')}</SelectItem>
                    <SelectItem value="viewer">{t('roleTitle.viewer')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            {team.addMember.error && <ErrorView error={team.addMember.error} testId="workspace-member-add-error" />}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={team.addMember.isPending}
              onClick={team.closeAddDialog}
              data-testid="workspace-add-member-cancel-button"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={!team.selectedUserId || team.addMember.isPending}
              onClick={team.submitAddMember}
              data-testid="workspace-add-member-submit-button"
            >
              {team.addMember.isPending ? t('team.adding') : t('team.addMember')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!team.removeTarget}
        onOpenChange={open => {
          if (!open && !team.removeMember.isPending) team.setRemoveTarget(null)
        }}
      >
        <DialogContent data-testid="workspace-remove-member-dialog">
          <DialogHeader>
            <DialogTitle>{team.removeTarget?.id === currentUserId ? t('team.leaveQuestion') : t('team.removeQuestion')}</DialogTitle>
            <DialogDescription>
              {team.removeTarget?.id === currentUserId
                ? t('team.leaveDescription')
                : t('team.removeDescription', { email: team.removeTarget?.email ?? t('team.thisMember') })}
            </DialogDescription>
          </DialogHeader>
          {team.removeMember.error && <ErrorView error={team.removeMember.error} testId="workspace-member-remove-dialog-error" />}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={team.removeMember.isPending}
              onClick={() => team.setRemoveTarget(null)}
              data-testid="workspace-remove-member-cancel-button"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              disabled={team.removeMember.isPending}
              onClick={team.confirmRemoveMember}
              data-testid="workspace-remove-member-confirm-button"
            >
              {team.removeMember.isPending ? t('team.removing') : team.removeTarget?.id === currentUserId ? t('team.leaveWorkspace') : t('team.removeMember')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FieldGroup>
  )
}

function MemberRoleSelect({
  memberId,
  email,
  role,
  disabled,
  onChange,
}: {
  memberId: string
  email: string
  role: MemberRole
  disabled: boolean
  onChange: (role: MemberRole) => void
}) {
  const { t } = useTranslation()
  return (
    <Select value={role} onValueChange={value => setMemberRole(onChange, value)} disabled={disabled}>
      <SelectTrigger
        aria-label={t('team.roleFor', { email })}
        className="w-28"
        data-testid={`workspace-member-${memberId}-role-select`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="editor">{t('roleTitle.editor')}</SelectItem>
          <SelectItem value="viewer">{t('roleTitle.viewer')}</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function setMemberRole(onChange: (role: MemberRole) => void, value: string) {
  if (value === 'editor' || value === 'viewer') onChange(value)
}

function setInviteRole(team: PortalViewModel['team'], value: string) {
  if (value === 'editor' || value === 'viewer') team.setRole(value)
}
