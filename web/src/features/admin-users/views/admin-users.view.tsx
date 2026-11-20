import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ADMIN_USERS_TEXT } from '@/features/admin-users/constants/admin-users-text.constants'
import type { useAdminUsersViewModel } from '@/features/admin-users/viewmodels/use-admin-users.viewmodel'
import { CopyButton } from '@/shared/components/copy-button'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/primitives/alert'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/primitives/card'
import { Field, FieldLabel } from '@/shared/components/primitives/field'
import { Input } from '@/shared/components/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/primitives/select'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/primitives/table'
import type { UserRole } from '@/shared/models/user-role.model'
import { formatDate } from '@/shared/utils/format'

export type AdminUsersViewProps = ReturnType<typeof useAdminUsersViewModel>

export function AdminUsersView(vm: AdminUsersViewProps) {
  const { t, i18n } = useTranslation('admin')
  const roleLabel = (roleId: UserRole) => vm.roles.find((role) => role.id === roleId)?.name ?? roleId

  return (
    <div className="grid w-full max-w-none gap-6" data-testid="admin-users-page">
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(ADMIN_USERS_TEXT.title)}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t(ADMIN_USERS_TEXT.subtitle)}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t(ADMIN_USERS_TEXT.inviteTitle)}</CardTitle>
          <CardDescription>{t(ADMIN_USERS_TEXT.inviteDetail)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form className="flex flex-col items-end gap-3 sm:flex-row" onSubmit={vm.onInvite} data-testid="admin-users-invite-form">
            <Field className="w-full">
              <FieldLabel htmlFor="admin-user-email">{t(ADMIN_USERS_TEXT.inviteEmail)}</FieldLabel>
              <Input
                id="admin-user-email"
                type="email"
                maxLength={254}
                required
                data-testid="admin-users-email-input"
                placeholder={t(ADMIN_USERS_TEXT.invitePlaceholder)}
                value={vm.email}
                onChange={(event) => vm.setEmail(event.target.value)}
              />
            </Field>
            <Button type="submit" data-testid="admin-users-invite-submit" disabled={vm.isInviting || !vm.email.trim()}>
              {vm.isInviting ? t(ADMIN_USERS_TEXT.inviting) : t(ADMIN_USERS_TEXT.inviteAction)}
            </Button>
          </form>
          {vm.inviteError && (
            <Alert variant="destructive">
              <AlertDescription>{vm.inviteError}</AlertDescription>
            </Alert>
          )}
          {vm.latestLink && (
            <Alert data-testid="admin-users-invite-link">
              <AlertTitle>{t(ADMIN_USERS_TEXT.invitationCreated)}</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>{vm.latestLink}</span>
                <CopyButton
                  value={vm.latestLink}
                  label={t(ADMIN_USERS_TEXT.copyLink)}
                  copiedLabel={t(ADMIN_USERS_TEXT.copied)}
                  onCopy={vm.copyLink}
                />
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(ADMIN_USERS_TEXT.rolesTitle)}</CardTitle>
          <CardDescription>{t(ADMIN_USERS_TEXT.rolesDetail)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {vm.rolesError && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>{vm.rolesError}</AlertDescription>
            </Alert>
          )}
          {vm.createRoleError && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>{vm.createRoleError}</AlertDescription>
            </Alert>
          )}
          {vm.deleteRoleError && (
            <Alert variant="destructive" className="w-full">
              <AlertDescription>{vm.deleteRoleError}</AlertDescription>
            </Alert>
          )}
          <form className="flex flex-col items-end gap-3 sm:flex-row" onSubmit={vm.onCreateRole} data-testid="admin-users-role-form">
            <Field className="w-full sm:max-w-md">
              <FieldLabel htmlFor="admin-role-name">{t(ADMIN_USERS_TEXT.roleName)}</FieldLabel>
              <Input
                id="admin-role-name"
                maxLength={60}
                required
                data-testid="admin-users-role-name"
                value={vm.roleName}
                onChange={(event) => vm.setRoleName(event.target.value)}
              />
            </Field>
            <Button type="submit" data-testid="admin-users-role-add" disabled={vm.isCreatingRole || !vm.roleName.trim()}>
              {vm.isCreatingRole ? t(ADMIN_USERS_TEXT.addingRole) : t(ADMIN_USERS_TEXT.addRole)}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {vm.roles.map((role) => (
              <div key={role.id} className="flex items-center gap-1 rounded-lg border px-2 py-1">
                <Badge variant="secondary">{role.name}</Badge>
                <Button
                  variant="ghost"
                  size="xs"
                  data-testid={`admin-users-role-delete-${role.id}`}
                  disabled={vm.deletingRoleId === role.id}
                  onClick={() => vm.onDeleteRole(role.id)}
                >
                  {t(ADMIN_USERS_TEXT.deleteRole)}
                </Button>
              </div>
            ))}
            {vm.rolesLoading && [0, 1, 2, 3, 4].map((row) => <Skeleton key={row} className="h-6 w-20 rounded-full" />)}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="gap-3 border-b py-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <CardTitle>{t(ADMIN_USERS_TEXT.usersTitle)}</CardTitle>
            <CardDescription>{t(ADMIN_USERS_TEXT.usersDetail)}</CardDescription>
          </div>
          <div className="relative w-full sm:w-72">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              className="pl-8"
              data-testid="admin-users-search"
              aria-label={t(ADMIN_USERS_TEXT.search)}
              placeholder={t(ADMIN_USERS_TEXT.search)}
              value={vm.search}
              onChange={(event) => vm.setSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {vm.usersError && (
            <Alert variant="destructive" className="m-4">
              <AlertDescription>{vm.usersError}</AlertDescription>
            </Alert>
          )}
          {vm.roleError && (
            <Alert variant="destructive" className="m-4">
              <AlertDescription>{vm.roleError}</AlertDescription>
            </Alert>
          )}
          <Table data-testid="admin-users-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t(ADMIN_USERS_TEXT.email)}</TableHead>
                <TableHead>{t(ADMIN_USERS_TEXT.roles)}</TableHead>
                <TableHead className="text-right">{t(ADMIN_USERS_TEXT.created)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vm.usersStatus === 'loading' &&
                [0, 1, 2].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {vm.usersStatus === 'empty' && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    {t(ADMIN_USERS_TEXT.emptyUsers)}
                  </TableCell>
                </TableRow>
              )}
              {vm.usersStatus === 'ready' &&
                vm.users.map((user) => (
                  <TableRow key={user.id} data-testid={`admin-users-row-${user.id}`}>
                    <TableCell className="max-w-96">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{user.email}</span>
                        {user.isAdmin && <Badge variant="default">{t(ADMIN_USERS_TEXT.adminAccess)}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-72 flex-wrap items-center gap-2">
                        <Select
                          multiple
                          value={vm.rolesForUser(user.id, user.roles)}
                          onValueChange={(value) => {
                            if (Array.isArray(value))
                              vm.onRolesChange(
                                user.id,
                                value.filter((role): role is UserRole => vm.roles.some((item) => item.id === role)),
                              )
                          }}
                          disabled={vm.rolesLoading || vm.updatingRoleUserId === user.id}
                        >
                          <SelectTrigger
                            aria-label={t(ADMIN_USERS_TEXT.assignRoles, { email: user.email })}
                            data-testid={`admin-users-roles-${user.id}`}
                            className="w-72 max-w-full"
                          >
                            <SelectValue className="truncate">
                              {(value: readonly string[]) => (value.length ? value.map(roleLabel).join(', ') : t(ADMIN_USERS_TEXT.noRoles))}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {vm.roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {vm.hasRoleDraftChanges(user.id, user.roles) && (
                          <Button
                            size="sm"
                            data-testid={`admin-users-save-roles-${user.id}`}
                            disabled={vm.updatingRoleUserId === user.id}
                            onClick={() => vm.saveUserRoles(user.id, user.roles)}
                          >
                            {vm.updatingRoleUserId === user.id ? t(ADMIN_USERS_TEXT.savingRoles) : t(ADMIN_USERS_TEXT.saveRoles)}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDate(user.createdAt, i18n.language)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              {t(ADMIN_USERS_TEXT.pageOf, { page: vm.usersPage, total: vm.usersTotalPages })}
            </span>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="admin-users-previous-page"
                disabled={!vm.usersHasPrevious || vm.usersStatus === 'loading'}
                onClick={vm.goToPreviousUserPage}
              >
                {t(ADMIN_USERS_TEXT.previousPage)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="admin-users-next-page"
                disabled={!vm.usersHasNext || vm.usersStatus === 'loading'}
                onClick={vm.goToNextUserPage}
              >
                {t(ADMIN_USERS_TEXT.nextPage)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-5">
          <CardTitle>{t(ADMIN_USERS_TEXT.pendingTitle)}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {vm.invitesError && (
            <Alert variant="destructive" className="m-4">
              <AlertDescription>{vm.invitesError}</AlertDescription>
            </Alert>
          )}
          {vm.cancelError && (
            <Alert variant="destructive" className="m-4">
              <AlertDescription>{vm.cancelError}</AlertDescription>
            </Alert>
          )}
          <Table data-testid="admin-user-invites-table">
            <TableHeader>
              <TableRow>
                <TableHead>{t(ADMIN_USERS_TEXT.email)}</TableHead>
                <TableHead className="hidden sm:table-cell">{t(ADMIN_USERS_TEXT.invitedBy)}</TableHead>
                <TableHead>{t(ADMIN_USERS_TEXT.expires)}</TableHead>
                <TableHead>
                  <span className="sr-only">{t(ADMIN_USERS_TEXT.cancel)}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vm.invitesStatus === 'loading' &&
                [0, 1, 2].map((row) => (
                  <TableRow key={row}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {vm.invitesStatus === 'empty' && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    {t(ADMIN_USERS_TEXT.pendingEmpty)}
                  </TableCell>
                </TableRow>
              )}
              {vm.invitesStatus === 'ready' &&
                vm.invites.map((invite) => (
                  <TableRow key={invite.id} data-testid={`admin-user-invite-row-${invite.id}`}>
                    <TableCell className="max-w-80 truncate">{invite.email}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{invite.createdByEmail}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(invite.expiresAt, i18n.language)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`admin-user-invite-cancel-${invite.id}`}
                        disabled={vm.cancellingInviteId === invite.id}
                        onClick={() => vm.onCancelInvite(invite.id)}
                      >
                        {t(ADMIN_USERS_TEXT.cancel)}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-muted-foreground">
              {t(ADMIN_USERS_TEXT.pageOf, { page: vm.invitesPage, total: vm.invitesTotalPages })}
            </span>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="admin-user-invites-previous-page"
                disabled={!vm.invitesHasPrevious || vm.invitesStatus === 'loading'}
                onClick={vm.goToPreviousInvitePage}
              >
                {t(ADMIN_USERS_TEXT.previousPage)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-testid="admin-user-invites-next-page"
                disabled={!vm.invitesHasNext || vm.invitesStatus === 'loading'}
                onClick={vm.goToNextInvitePage}
              >
                {t(ADMIN_USERS_TEXT.nextPage)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
