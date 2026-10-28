import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { TEAM_TEXT } from '../constants/team-text.constants'
import type { InviteRole } from '../viewmodels/use-invite-dialog.viewmodel'

export interface InviteDialogViewProps {
  isOpen: boolean
  email: string
  role: InviteRole
  isBusy: boolean
  errorMessage: string | null
  onEmailChange: (value: string) => void
  onRoleChange: (role: InviteRole) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function InviteDialogView({
  isOpen,
  email,
  role,
  isBusy,
  errorMessage,
  onEmailChange,
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
      <DialogContent data-testid="team-invite-dialog">
        <form data-testid="team-invite-form" className="grid gap-4" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{t(TEAM_TEXT.invite.title)}</DialogTitle>
            <DialogDescription>{t(TEAM_TEXT.invite.detail)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="invite-email">{t(TEAM_TEXT.invite.email)}</Label>
            <Input
              id="invite-email"
              type="email"
              data-testid="team-invite-email-input"
              autoFocus
              required
              value={email}
              placeholder={t(TEAM_TEXT.invite.emailPlaceholder)}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t(TEAM_TEXT.invite.role)}</Label>
            <Select
              value={role}
              onValueChange={(value) => {
                if (value === 'editor' || value === 'viewer') onRoleChange(value)
              }}
            >
              <SelectTrigger data-testid="team-invite-role-select" className="w-full">
                <SelectValue>{(value: string) => roleLabels[value as InviteRole] ?? value}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">{t(TEAM_TEXT.invite.editorOption)}</SelectItem>
                <SelectItem value="viewer">{t(TEAM_TEXT.invite.viewerOption)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t(TEAM_TEXT.invite.cancel)}
            </Button>
            <Button type="submit" data-testid="team-invite-submit-button" disabled={isBusy || !email.trim()}>
              {isBusy ? t(TEAM_TEXT.invite.sending) : t(TEAM_TEXT.invite.send)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
