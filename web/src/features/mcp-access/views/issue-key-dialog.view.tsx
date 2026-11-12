import { useTranslation } from 'react-i18next'
import { MCP_ACCESS_TEXT, MCP_ROLE_TEXT, MCP_TOOL_TEXT, VALID_DAY_OPTIONS } from '@/features/mcp-access/constants/mcp-access-text.constants'
import { MCP_KEY_ROLES, type McpKeyRole } from '@/features/mcp-access/models/mcp-key.model'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/primitives/dialog'
import { Input } from '@/shared/components/primitives/input'
import { Label } from '@/shared/components/primitives/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/primitives/select'

export interface IssueKeyDialogViewProps {
  dialog: {
    member: { email: string }
    name: string
    role: McpKeyRole
    tools: string[]
    validDays: number
    replacesKey: boolean
    canSubmit: boolean
    isSubmitting: boolean
    error: string | null
  }
  allTools: string[]
  onClose: () => void
  onNameChange: (value: string) => void
  onRoleChange: (role: McpKeyRole) => void
  onToggleTool: (tool: string) => void
  onResetTools: () => void
  onValidDaysChange: (days: number) => void
  onSubmit: () => void
}

export function IssueKeyDialogView({
  dialog,
  allTools,
  onClose,
  onNameChange,
  onRoleChange,
  onToggleTool,
  onResetTools,
  onValidDaysChange,
  onSubmit,
}: IssueKeyDialogViewProps) {
  const { t } = useTranslation('mcp')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="mcp-issue-dialog" className="sm:max-w-xl">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(MCP_ACCESS_TEXT.dialog.title, { email: dialog.member.email })}</DialogTitle>
            <DialogDescription>{t(MCP_ACCESS_TEXT.dialog.detail)}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="mcp-issue-name">{t(MCP_ACCESS_TEXT.dialog.name)}</Label>
            <Input
              id="mcp-issue-name"
              data-testid="mcp-issue-name"
              autoFocus
              maxLength={80}
              value={dialog.name}
              placeholder={t(MCP_ACCESS_TEXT.dialog.namePlaceholder)}
              onChange={(event) => onNameChange(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t(MCP_ACCESS_TEXT.dialog.role)}</Label>
              <Select
                value={dialog.role}
                onValueChange={(value) => MCP_KEY_ROLES.includes(value as McpKeyRole) && onRoleChange(value as McpKeyRole)}
              >
                <SelectTrigger data-testid="mcp-issue-role" className="w-full">
                  <SelectValue>{(value: string) => t(MCP_ROLE_TEXT[value as McpKeyRole])}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MCP_KEY_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(MCP_ROLE_TEXT[role])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t(MCP_ACCESS_TEXT.dialog.validDays)}</Label>
              <Select value={String(dialog.validDays)} onValueChange={(value) => value && onValidDaysChange(Number(value))}>
                <SelectTrigger data-testid="mcp-issue-valid-days" className="w-full">
                  <SelectValue>{(value: string) => t(MCP_ACCESS_TEXT.dialog.days, { count: Number(value) })}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VALID_DAY_OPTIONS.map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {t(MCP_ACCESS_TEXT.dialog.days, { count: days })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t(MCP_ACCESS_TEXT.dialog.tools)}</legend>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t(MCP_ACCESS_TEXT.dialog.toolsHint)}</p>
              <Button type="button" size="sm" variant="ghost" data-testid="mcp-issue-reset-tools" onClick={onResetTools}>
                {t(MCP_ACCESS_TEXT.dialog.resetTools)}
              </Button>
            </div>
            <div className="grid max-h-56 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {allTools.map((tool) => (
                <Label key={tool} className="font-normal">
                  <Checkbox
                    checked={dialog.tools.includes(tool)}
                    data-testid={`mcp-issue-tool-${tool}`}
                    onChange={() => onToggleTool(tool)}
                  />
                  {MCP_TOOL_TEXT[tool] ? t(MCP_TOOL_TEXT[tool]) : tool}
                </Label>
              ))}
            </div>
          </fieldset>

          {dialog.replacesKey && (
            <Alert>
              <AlertDescription>{t(MCP_ACCESS_TEXT.dialog.replaceWarning)}</AlertDescription>
            </Alert>
          )}
          {dialog.error && (
            <Alert variant="destructive">
              <AlertDescription>{dialog.error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" data-testid="mcp-issue-cancel" onClick={onClose}>
              {t(MCP_ACCESS_TEXT.dialog.cancel)}
            </Button>
            <Button type="submit" data-testid="mcp-issue-submit" disabled={!dialog.canSubmit}>
              {dialog.isSubmitting ? t(MCP_ACCESS_TEXT.dialog.submitting) : t(MCP_ACCESS_TEXT.dialog.submit)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
