import { useTranslation } from 'react-i18next'
import { MCP_ACCESS_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import { MCP_KEY_VALID_DAYS, type McpKeyValidDays } from '@/features/mcp-access/models/mcp-key.model'
import type { useMyMcpKeyViewModel } from '@/features/mcp-access/viewmodels/use-my-mcp-key.viewmodel'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/primitives/dialog'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/primitives/select'

type CreateKeyDialog = ReturnType<typeof useMyMcpKeyViewModel>['dialog']

const NEVER = 'never'
const toValue = (days: McpKeyValidDays) => (days === null ? NEVER : String(days))
const fromValue = (value: string): McpKeyValidDays => (value === NEVER ? null : (Number(value) as McpKeyValidDays))

export function CreateKeyDialogView({ dialog }: { dialog: CreateKeyDialog }) {
  const { t } = useTranslation('mcp')
  const label = (days: McpKeyValidDays) =>
    days === null ? t(MCP_ACCESS_TEXT.dialog.never) : t(MCP_ACCESS_TEXT.dialog.days, { count: days })

  return (
    <Dialog open={dialog.open} onOpenChange={(open) => !open && dialog.onClose()}>
      <DialogContent data-testid="mcp-create-dialog" className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            dialog.onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(MCP_ACCESS_TEXT.dialog.title)}</DialogTitle>
            <DialogDescription>{t(MCP_ACCESS_TEXT.dialog.detail)}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="mcp-create-name">{t(MCP_ACCESS_TEXT.dialog.name)}</Label>
            <Input
              id="mcp-create-name"
              data-testid="mcp-create-name"
              autoFocus
              maxLength={80}
              value={dialog.name}
              placeholder={t(MCP_ACCESS_TEXT.dialog.namePlaceholder)}
              onChange={(event) => dialog.setName(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t(MCP_ACCESS_TEXT.dialog.validDays)}</Label>
            <Select value={toValue(dialog.validDays)} onValueChange={(value) => value && dialog.setValidDays(fromValue(value))}>
              <SelectTrigger data-testid="mcp-create-valid-days" className="w-full">
                <SelectValue>{(value: string) => label(fromValue(value))}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {MCP_KEY_VALID_DAYS.map((days) => (
                  <SelectItem key={toValue(days)} value={toValue(days)}>
                    {label(days)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dialog.validDays === null && <p className="text-xs text-warning">{t(MCP_ACCESS_TEXT.dialog.neverWarning)}</p>}
          </div>

          {dialog.error && (
            <Alert variant="destructive">
              <AlertDescription>{dialog.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" data-testid="mcp-create-cancel" onClick={dialog.onClose}>
              {t(MCP_ACCESS_TEXT.dialog.cancel)}
            </Button>
            <Button type="submit" data-testid="mcp-create-submit" disabled={!dialog.canSubmit}>
              {dialog.isSubmitting ? t(MCP_ACCESS_TEXT.dialog.submitting) : t(MCP_ACCESS_TEXT.dialog.submit)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
