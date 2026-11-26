import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/data-table/data-table'
import type { AdminUser, RoleMaster, UserInvite } from '../models/portal.model'
import type { AdminUsersViewModel } from '../hooks/use-admin-users.viewmodel'
import { EmptyView, ErrorView } from './state.view'

export function AdminUsersView({ vm }: { vm: AdminUsersViewModel }) {
  const { t } = useTranslation()
  return (
    <FieldGroup className="gap-4" data-testid="admin-users-page">
      <Tabs defaultValue="accounts" className="gap-4">
        <TabsList variant="line" aria-label={t('admin.tabsAria')}>
          <TabsTrigger value="accounts" data-testid="admin-users-tab-accounts">{t('admin.tabAccounts')}</TabsTrigger>
          <TabsTrigger value="invitations" data-testid="admin-users-tab-invitations">{t('admin.tabInvitations')}</TabsTrigger>
          <TabsTrigger value="roles" data-testid="admin-users-tab-roles">{t('admin.tabRoles')}</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts">
          <UsersSection vm={vm} />
        </TabsContent>
        <TabsContent value="invitations">
          <InvitesSection vm={vm} />
        </TabsContent>
        <TabsContent value="roles">
          <RolesSection vm={vm} />
        </TabsContent>
      </Tabs>
      {vm.users.editUser && <EditRolesDialog vm={vm} />}
      {vm.invites.open && <InviteDialog vm={vm} />}
      {vm.roles.roleToDelete && <DeleteRoleDialog vm={vm} />}
      {vm.roles.createOpen && <CreateRoleDialog vm={vm} />}
    </FieldGroup>
  )
}

function UsersSection({ vm }: { vm: AdminUsersViewModel }) {
  const { t } = useTranslation()
  const users = vm.users
  return (
    <DataTable<AdminUser>
      testId="admin-users-table"
      title={t('admin.usersTitle')}
      description={t('admin.usersDescription')}
      rows={users.items}
      getRowId={user => user.id}
      getRowTestId={user => `admin-user-${user.id}`}
      search={{ value: users.search, onChange: users.setSearch, label: t('admin.searchLabel'), placeholder: t('admin.searchPlaceholder') }}
      state={users.status === 'loading' ? 'loading' : users.status === 'error' ? 'error' : users.status === 'empty' ? 'empty' : 'ready'}
      errorNode={users.error && <ErrorView error={users.error} retry={users.retry} testId="admin-users-load-error" />}
      emptyNode={<EmptyView title={t('admin.noUsers')} description={t('admin.noUsersDescription')} testId="admin-users-empty" />}
      hasMore={users.hasNextPage}
      loadingMore={users.isFetchingNextPage}
      onLoadMore={users.loadMore}
      columns={[
        { id: 'email', header: t('admin.colEmail'), cell: user => <FieldTitle className="text-sm font-medium break-all">{user.email}</FieldTitle>, className: 'max-w-64' },
        { id: 'name', header: t('admin.colName'), cell: user => user.name ?? t('admin.noName') },
        {
          id: 'roles',
          header: t('admin.colRoles'),
          cell: user => (
            <FieldGroup className="flex-row flex-wrap gap-1">
              {user.isAdmin && <Badge variant="outline">{t('admin.appAdmin')}</Badge>}
              {user.roles.length === 0 && !user.isAdmin && <FieldDescription>{t('admin.noRoles')}</FieldDescription>}
              {user.roles.map(roleId => (
                <Badge key={roleId} variant="secondary">{vm.users.roleName(roleId)}</Badge>
              ))}
            </FieldGroup>
          ),
        },
        { id: 'joined', header: t('admin.colJoined'), cell: user => new Date(user.createdAt).toLocaleDateString() },
      ]}
      rowActions={() => [{ id: 'roles', label: t('admin.editRoles'), onSelect: user => vm.users.openEdit(user) }]}
    />
  )
}

function InvitesSection({ vm }: { vm: AdminUsersViewModel }) {
  const { t } = useTranslation()
  const invites = vm.invites
  return (
    <DataTable<UserInvite>
      testId="admin-invites-table"
      title={t('admin.invitesTitle')}
      description={t('admin.invitesDescription')}
      actions={
        <Button className="cursor-pointer" onClick={() => invites.setOpen(true)} data-testid="admin-invite-open">
          {t('admin.inviteUser')}
        </Button>
      }
      rows={invites.items}
      getRowId={invite => invite.id}
      getRowTestId={invite => `admin-invite-${invite.id}`}
      state={invites.status === 'loading' ? 'loading' : invites.status === 'error' ? 'error' : invites.status === 'empty' ? 'empty' : 'ready'}
      errorNode={invites.error && <ErrorView error={invites.error} retry={invites.retry} testId="admin-invites-load-error" />}
      emptyNode={<EmptyView title={t('admin.noInvites')} description={t('admin.noInvitesDescription')} testId="admin-invites-empty" />}
      hasMore={invites.hasNextPage}
      loadingMore={invites.isFetchingNextPage}
      onLoadMore={invites.loadMore}
      columns={[
        { id: 'email', header: t('admin.colEmail'), cell: invite => <FieldTitle className="text-sm font-medium break-all">{invite.email}</FieldTitle>, className: 'max-w-64' },
        { id: 'invitedBy', header: t('admin.colInvitedBy'), cell: invite => <FieldDescription className="text-foreground break-all">{invite.createdByEmail}</FieldDescription> },
        { id: 'expires', header: t('admin.colExpires'), cell: invite => new Date(invite.expiresAt).toLocaleDateString() },
      ]}
      rowActions={invite => [
        { id: 'cancel', label: t('admin.cancelInvite'), destructive: true, disabled: invites.cancellingId === invite.id, onSelect: row => invites.cancel(row) },
      ]}
    />
  )
}

function RolesSection({ vm }: { vm: AdminUsersViewModel }) {
  const { t } = useTranslation()
  const roles = vm.roles
  return (
    <DataTable<RoleMaster>
      testId="admin-roles-table"
      title={t('admin.rolesTitle')}
      description={t('admin.rolesDescription')}
      actions={
        <Button className="cursor-pointer" onClick={() => roles.setCreateOpen(true)} data-testid="admin-role-create-open">
          {t('admin.createRole')}
        </Button>
      }
      rows={roles.items}
      getRowId={role => role.id}
      getRowTestId={role => `admin-role-${role.id}`}
      state={roles.status === 'loading' ? 'loading' : roles.status === 'error' ? 'error' : roles.items.length === 0 ? 'empty' : 'ready'}
      errorNode={roles.error && <ErrorView error={roles.error} retry={roles.retry} testId="admin-roles-load-error" />}
      emptyNode={<EmptyView title={t('admin.noRolesTitle')} description={t('admin.noRolesDescription')} testId="admin-roles-empty" />}
      columns={[{ id: 'name', header: t('admin.colRoleName'), cell: role => <FieldTitle className="text-sm font-medium">{role.name}</FieldTitle> }]}
      rowActions={() => [{ id: 'delete', label: t('admin.deleteRole'), destructive: true, onSelect: role => roles.askDelete(role) }]}
    />
  )
}

function CreateRoleDialog({ vm }: { vm: AdminUsersViewModel }) {
  const { t } = useTranslation()
  const roles = vm.roles
  return (
    <Dialog open onOpenChange={roles.setCreateOpen}>
      <DialogContent data-testid="admin-create-role-dialog">
        <DialogHeader>
          <DialogTitle>{t('admin.createRoleTitle')}</DialogTitle>
          <DialogDescription>{t('admin.createRoleDescription')}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="admin-role-name">{t('admin.roleName')}</FieldLabel>
          <Input
            id="admin-role-name"
            maxLength={60}
            autoFocus
            value={roles.newName}
            onChange={event => roles.setNewName(event.target.value)}
            data-testid="admin-role-name-input"
          />
        </Field>
        {roles.createError && <ErrorView error={roles.createError} testId="admin-role-create-error" />}
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => roles.setCreateOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            className="cursor-pointer"
            disabled={!roles.newName.trim() || roles.createPending}
            onClick={roles.create}
            data-testid="admin-role-create-button"
          >
            {roles.createPending ? t('common.creating') : t('admin.createRole')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditRolesDialog({ vm }: { vm: AdminUsersViewModel }) {
  const { t } = useTranslation()
  const user = vm.users.editUser!
  const [selected, setSelected] = useState<string[]>(user.roles)
  const [appAdmin, setAppAdmin] = useState(user.isAdmin)
  const isSelf = user.id === vm.users.currentUserId
  const appAdminChanged = appAdmin !== user.isAdmin
  const toggle = (roleId: string) =>
    setSelected(current => (current.includes(roleId) ? current.filter(id => id !== roleId) : [...current, roleId]))
  const roles = vm.roles.items
  return (
    <Dialog open onOpenChange={open => !open && vm.users.closeEdit()}>
      <DialogContent data-testid="admin-edit-roles-dialog">
        <DialogHeader>
          <DialogTitle>{t('admin.editRolesTitle', { email: user.email })}</DialogTitle>
          <DialogDescription>{t('admin.editRolesDescription')}</DialogDescription>
        </DialogHeader>
        <FieldGroup className="flex-row flex-wrap gap-2">
          {roles.length === 0 && <FieldDescription>{t('admin.noRolesDescription')}</FieldDescription>}
          {roles.map(role => {
            const on = selected.includes(role.id)
            return (
              <Button
                key={role.id}
                type="button"
                variant={on ? 'secondary' : 'outline'}
                aria-pressed={on}
                className="cursor-pointer"
                onClick={() => toggle(role.id)}
                data-testid={`admin-edit-role-${role.id}`}
              >
                {role.name}
              </Button>
            )
          })}
        </FieldGroup>
        <Field className="gap-2 rounded-md border p-3">
          <FieldGroup className="flex-row items-center gap-3">
            <Checkbox
              id="admin-edit-app-admin"
              checked={appAdmin}
              disabled={isSelf}
              onCheckedChange={value => setAppAdmin(value === true)}
              data-testid="admin-edit-app-admin"
            />
            <FieldLabel htmlFor="admin-edit-app-admin">{t('admin.appAdminToggle')}</FieldLabel>
          </FieldGroup>
          <FieldDescription>{isSelf ? t('admin.appAdminSelfNote') : t('admin.appAdminToggleDescription')}</FieldDescription>
        </Field>
        {vm.users.saveError && <ErrorView error={vm.users.saveError} testId="admin-edit-roles-error" />}
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={vm.users.closeEdit}>
            {t('common.cancel')}
          </Button>
          <Button
            className="cursor-pointer"
            disabled={vm.users.savePending}
            onClick={() => vm.users.saveRoles(user.id, selected, appAdminChanged ? appAdmin : undefined)}
            data-testid="admin-edit-roles-save"
          >
            {vm.users.savePending ? t('common.saving') : t('admin.saveRoles')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InviteDialog({ vm }: { vm: AdminUsersViewModel }) {
  const { t } = useTranslation()
  const invites = vm.invites
  const result = invites.result
  return (
    <Dialog open onOpenChange={invites.setOpen}>
      <DialogContent data-testid="admin-invite-dialog">
        <DialogHeader>
          <DialogTitle>{t('admin.inviteUser')}</DialogTitle>
          <DialogDescription>{t('admin.inviteDescription')}</DialogDescription>
        </DialogHeader>
        {result ? (
          <FieldGroup className="gap-3" role="status" data-testid="admin-invite-result">
            <FieldDescription>
              {result.emailSent ? t('admin.inviteSent', { email: result.email }) : t('admin.inviteLinkOnly', { email: result.email })}
            </FieldDescription>
            {!result.emailSent && (
              <Field>
                <FieldLabel htmlFor="admin-invite-link">{t('admin.inviteLink')}</FieldLabel>
                <Input id="admin-invite-link" readOnly value={result.inviteUrl} onFocus={event => event.currentTarget.select()} data-testid="admin-invite-link" />
              </Field>
            )}
          </FieldGroup>
        ) : (
          <Field>
            <FieldLabel htmlFor="admin-invite-email">{t('auth.emailLabel')}</FieldLabel>
            <Input
              id="admin-invite-email"
              type="email"
              autoComplete="off"
              value={invites.email}
              onChange={event => invites.setEmail(event.target.value)}
              data-testid="admin-invite-email"
            />
          </Field>
        )}
        {invites.sendError && <ErrorView error={invites.sendError} testId="admin-invite-error" />}
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={() => invites.setOpen(false)}>
            {result ? t('common.done') : t('common.cancel')}
          </Button>
          {!result && (
            <Button
              className="cursor-pointer"
              disabled={!invites.email.includes('@') || invites.sendPending}
              onClick={invites.send}
              data-testid="admin-invite-submit"
            >
              {invites.sendPending ? t('common.sending') : t('admin.sendInvite')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteRoleDialog({ vm }: { vm: AdminUsersViewModel }) {
  const { t } = useTranslation()
  const role = vm.roles.roleToDelete!
  return (
    <Dialog open onOpenChange={open => !open && vm.roles.closeDelete()}>
      <DialogContent data-testid="admin-delete-role-dialog">
        <DialogHeader>
          <DialogTitle>{t('admin.deleteRoleTitle', { name: role.name })}</DialogTitle>
          <DialogDescription>{t('admin.deleteRoleDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="cursor-pointer" onClick={vm.roles.closeDelete}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" className="cursor-pointer" disabled={vm.roles.deletePending} onClick={vm.roles.confirmDelete} data-testid="admin-delete-role-confirm">
            {vm.roles.deletePending ? t('common.deleting') : t('admin.deleteRole')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
