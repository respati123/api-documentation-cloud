import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel, FieldTitle, FieldDescription } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import { ErrorView } from './state.view'

export function WorkspaceSettingsView({
  vm,
  workspaceName,
}: {
  vm: PortalViewModel
  workspaceName: string
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(workspaceName)
  const [confirmName, setConfirmName] = useState('')
  const trimmedName = name.trim()
  const canRename = trimmedName.length > 0 && trimmedName.length <= 100 && trimmedName !== workspaceName
  const canDelete = confirmName.trim() === workspaceName

  useEffect(() => {
    setName(workspaceName)
  }, [workspaceName])

  const saveName = () => {
    if (!canRename) return
    vm.settings.rename.mutate(trimmedName)
  }
  const deleteWorkspace = () => {
    if (!canDelete) return
    vm.settings.deleteWorkspace.mutate(confirmName)
  }

  return (
    <FieldGroup className="gap-8" data-testid="workspace-settings-view-container">
      <FieldGroup className="gap-6 lg:flex-row lg:items-start lg:gap-12">
        <FieldGroup className="gap-1 lg:w-72 lg:shrink-0">
          <FieldTitle className="text-base">{t('settings.general')}</FieldTitle>
          <FieldDescription>{t('settings.generalDescription')}</FieldDescription>
        </FieldGroup>
        <Card className="min-w-0 flex-1 gap-4 rounded-lg shadow-none">
          <CardContent className="space-y-3">
            <Field className="gap-2">
              <FieldLabel htmlFor="workspace-rename-input">{t('dialog.nameLabel')}</FieldLabel>
              <Input
                id="workspace-rename-input"
                data-testid="workspace-rename-input"
                maxLength={100}
                autoComplete="off"
                disabled={vm.settings.rename.isPending}
                value={name}
                onChange={event => {
                  vm.settings.rename.reset()
                  setName(event.target.value)
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    saveName()
                  }
                }}
              />
            </Field>
            {vm.settings.rename.error && (
              <ErrorView error={vm.settings.rename.error} testId="workspace-rename-error" />
            )}
            {vm.settings.rename.isSuccess && (
              <CardDescription role="status" data-testid="workspace-rename-success">
                {t('settings.renamed')}
              </CardDescription>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              className="cursor-pointer"
              disabled={!canRename || vm.settings.rename.isPending}
              onClick={saveName}
              data-testid="workspace-rename-submit-button"
            >
              {vm.settings.rename.isPending ? t('common.saving') : t('settings.saveName')}
            </Button>
          </CardFooter>
        </Card>
      </FieldGroup>

      <Separator />

      <FieldGroup className="gap-6 lg:flex-row lg:items-start lg:gap-12">
        <FieldGroup className="gap-1 lg:w-72 lg:shrink-0">
          <FieldTitle className="text-base">{t('settings.deleteTitle')}</FieldTitle>
          <FieldDescription>
            {t('settings.deleteDescription')}
          </FieldDescription>
        </FieldGroup>
        <Card className="min-w-0 flex-1 gap-4 rounded-lg shadow-none">
          <CardContent className="space-y-3">
            <Field className="gap-2">
              <FieldLabel htmlFor="workspace-delete-input">
                {t('settings.deleteConfirm', { name: workspaceName })}
              </FieldLabel>
              <Input
                id="workspace-delete-input"
                data-testid="workspace-delete-input"
                autoComplete="off"
                disabled={vm.settings.deleteWorkspace.isPending}
                value={confirmName}
                onChange={event => {
                  vm.settings.deleteWorkspace.reset()
                  setConfirmName(event.target.value)
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    deleteWorkspace()
                  }
                }}
              />
            </Field>
            {vm.settings.deleteWorkspace.error && (
              <ErrorView error={vm.settings.deleteWorkspace.error} testId="workspace-delete-error" />
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              disabled={!canDelete || vm.settings.deleteWorkspace.isPending}
              onClick={deleteWorkspace}
              data-testid="workspace-delete-submit-button"
            >
              {vm.settings.deleteWorkspace.isPending ? t('common.deleting') : t('settings.deleteAction')}
            </Button>
          </CardFooter>
        </Card>
      </FieldGroup>
    </FieldGroup>
  )
}
