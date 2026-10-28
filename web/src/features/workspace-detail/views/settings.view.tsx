import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { SETTINGS_TEXT } from '../constants/settings-text.constants'

export interface WorkspaceSettingsViewProps {
  workspaceName: string
  onRename: (name: string) => void
  onDelete: (confirmName: string) => void
}

export function WorkspaceSettingsView({ workspaceName, onRename, onDelete }: WorkspaceSettingsViewProps) {
  const { t } = useTranslation('settings')
  const [name, setName] = useState(workspaceName)
  const [confirmName, setConfirmName] = useState('')
  const trimmed = name.trim()
  const canRename = trimmed.length > 0 && trimmed !== workspaceName

  function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canRename) onRename(trimmed)
  }

  function submitDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (confirmName === workspaceName) onDelete(confirmName)
  }

  return (
    <div className="grid max-w-2xl gap-6" data-testid="workspace-settings">
      <Card>
        <CardHeader>
          <CardTitle>{t(SETTINGS_TEXT.general.title)}</CardTitle>
          <CardDescription>{t(SETTINGS_TEXT.general.detail)}</CardDescription>
        </CardHeader>
        <form data-testid="workspace-rename-form" onSubmit={submitRename}>
          <CardContent className="grid gap-2">
            <Label htmlFor="workspace-rename-input">{t(SETTINGS_TEXT.general.nameLabel)}</Label>
            <Input
              id="workspace-rename-input"
              data-testid="workspace-rename-input"
              maxLength={100}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" data-testid="workspace-rename-submit-button" disabled={!canRename}>
              {t(SETTINGS_TEXT.general.save)}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="ring-destructive/40">
        <CardHeader>
          <CardTitle>{t(SETTINGS_TEXT.danger.title)}</CardTitle>
          <CardDescription>{t(SETTINGS_TEXT.danger.detail)}</CardDescription>
        </CardHeader>
        <form data-testid="workspace-delete-form" onSubmit={submitDelete}>
          <CardContent className="grid gap-2">
            <Label htmlFor="workspace-delete-input">{t(SETTINGS_TEXT.danger.confirmLabel, { name: workspaceName })}</Label>
            <Input
              id="workspace-delete-input"
              data-testid="workspace-delete-input"
              autoComplete="off"
              value={confirmName}
              onChange={(event) => setConfirmName(event.target.value)}
            />
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              variant="destructive"
              data-testid="workspace-delete-submit-button"
              disabled={confirmName !== workspaceName}
            >
              {t(SETTINGS_TEXT.danger.delete)}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
