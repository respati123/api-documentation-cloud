import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { WORKSPACES_TEXT } from '../constants/workspaces-text.constants'

export interface CreateWorkspaceDialogViewProps {
  isOpen: boolean
  isBusy: boolean
  errorMessage: string | null
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function CreateWorkspaceDialogView({ isOpen, isBusy, errorMessage, onClose, onSubmit }: CreateWorkspaceDialogViewProps) {
  const { t } = useTranslation('workspaces')
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="workspaces-create-dialog">
        <form data-testid="workspaces-create-form" className="grid gap-4" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{t(WORKSPACES_TEXT.create.title)}</DialogTitle>
            <DialogDescription>{t(WORKSPACES_TEXT.create.description)}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">{t(WORKSPACES_TEXT.create.nameLabel)}</Label>
            <Input
              id="workspace-name"
              name="name"
              data-testid="workspaces-create-name-input"
              autoFocus
              required
              maxLength={100}
              placeholder={t(WORKSPACES_TEXT.create.namePlaceholder)}
            />
          </div>
          {errorMessage && (
            <Alert variant="destructive" data-testid="workspaces-create-error">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" data-testid="workspaces-create-cancel-button" onClick={onClose}>
              {t(WORKSPACES_TEXT.create.cancel)}
            </Button>
            <Button type="submit" data-testid="workspaces-create-submit-button" disabled={isBusy}>
              {isBusy ? t(WORKSPACES_TEXT.create.busy) : t(WORKSPACES_TEXT.create.submit)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
