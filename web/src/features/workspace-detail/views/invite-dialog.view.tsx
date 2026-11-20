import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/primitives/dialog'
import { Field, FieldLabel } from '@/shared/components/primitives/field'
import { Input } from '@/shared/components/primitives/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/primitives/select'
import { TEAM_TEXT } from '../constants/team-text.constants'
import type { InviteRole } from '../viewmodels/use-invite-dialog.viewmodel'

export interface InviteDialogViewProps {
  isOpen: boolean
  search: string
  users: Array<{ id: string; email: string }>
  usersLoading: boolean
  usersHasMore: boolean
  usersLoadingMore: boolean
  usersError: string | null
  selectedUserId: string
  role: InviteRole
  isBusy: boolean
  errorMessage: string | null
  onSearchChange: (value: string) => void
  onLoadMoreUsers: () => void
  onUserChange: (userId: string) => void
  onRoleChange: (role: InviteRole) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function InviteDialogView({
  isOpen,
  search,
  users,
  usersLoading,
  usersHasMore,
  usersLoadingMore,
  usersError,
  selectedUserId,
  role,
  isBusy,
  errorMessage,
  onSearchChange,
  onLoadMoreUsers,
  onUserChange,
  onRoleChange,
  onClose,
  onSubmit,
}: InviteDialogViewProps) {
  const { t } = useTranslation('team')
  const roleLabels: Record<InviteRole, string> = {
    editor: t(TEAM_TEXT.invite.editorOption),
    viewer: t(TEAM_TEXT.invite.viewerOption),
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="team-add-member-dialog" className="sm:max-w-md">
        <form data-testid="team-add-member-form" className="grid gap-4" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{t(TEAM_TEXT.add.title)}</DialogTitle>
            <DialogDescription>{t(TEAM_TEXT.add.detail)}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="team-member-search">{t(TEAM_TEXT.add.search)}</FieldLabel>
            <Input
              id="team-member-search"
              type="search"
              data-testid="team-add-member-search"
              autoFocus
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel>{t(TEAM_TEXT.add.user)}</FieldLabel>
            <Select value={selectedUserId} onValueChange={(value) => onUserChange(String(value ?? ''))}>
              <SelectTrigger data-testid="team-add-member-user-select" className="w-full">
                <SelectValue placeholder={t(TEAM_TEXT.add.userPlaceholder)}>
                  {(value: string) => users.find((user) => user.id === value)?.email ?? ''}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {usersLoading && <span className="text-xs text-muted-foreground">{t(TEAM_TEXT.people.loading)}</span>}
            {usersError && <span className="text-xs text-destructive">{usersError}</span>}
            {!usersLoading && users.length === 0 && <span className="text-xs text-muted-foreground">{t(TEAM_TEXT.add.noUsers)}</span>}
            <LoadMoreButton
              hasMore={usersHasMore}
              isLoading={usersLoadingMore}
              onLoadMore={onLoadMoreUsers}
              testId="team-add-member-load-more"
            />
          </Field>
          <Field>
            <FieldLabel>{t(TEAM_TEXT.add.role)}</FieldLabel>
            <Select
              value={role}
              onValueChange={(value) => {
                if (value === 'editor' || value === 'viewer') onRoleChange(value)
              }}
            >
              <SelectTrigger data-testid="team-add-member-role-select" className="w-full">
                <SelectValue>{(value: string) => roleLabels[value as InviteRole] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">{t(TEAM_TEXT.invite.editorOption)}</SelectItem>
                <SelectItem value="viewer">{t(TEAM_TEXT.invite.viewerOption)}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t(TEAM_TEXT.invite.cancel)}
            </Button>
            <Button type="submit" data-testid="team-add-member-submit" disabled={isBusy || !selectedUserId}>
              {isBusy ? t(TEAM_TEXT.add.adding) : t(TEAM_TEXT.add.submit)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
