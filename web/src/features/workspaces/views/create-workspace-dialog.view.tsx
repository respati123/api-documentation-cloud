import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

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
            <DialogTitle>{t('create.title')}</DialogTitle>
            <DialogDescription>{t('create.description')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">{t('create.nameLabel')}</Label>
            <Input
              id="workspace-name"
              name="name"
              data-testid="workspaces-create-name-input"
              autoFocus
              required
              maxLength={100}
              placeholder={t('create.namePlaceholder')}
            />
          </div>
          {errorMessage && (
            <p data-testid="workspaces-create-error" role="alert" className="text-xs text-destructive">
              {errorMessage}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" data-testid="workspaces-create-cancel-button" onClick={onClose}>
              {t('create.cancel')}
            </Button>
            <Button type="submit" data-testid="workspaces-create-submit-button" disabled={isBusy}>
              {isBusy ? t('create.busy') : t('create.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
