import { KeyRound, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MCP_ACCESS_TEXT, MCP_ROLE_TEXT, MCP_TOOL_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import type { useMyMcpKeyViewModel } from '@/features/mcp-access/viewmodels/use-my-mcp-key.viewmodel'
import { CreateKeyDialogView } from '@/features/mcp-access/views/create-key-dialog.view'
import { McpKeysTable } from '@/features/mcp-access/views/mcp-keys-table.view'
import { CopyButton } from '@/shared/components/copy-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/primitives/card'
import { ScrollArea } from '@/shared/components/primitives/scroll-area'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/primitives/table'
import { EmptyState } from '@/shared/components/state-views'

export type MyMcpKeyViewProps = ReturnType<typeof useMyMcpKeyViewModel>

export function MyMcpKeyView(vm: MyMcpKeyViewProps) {
  const { t } = useTranslation('mcp')

  return (
    <div className="grid max-w-6xl gap-6" data-testid="mcp-mine-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(MCP_ACCESS_TEXT.mine.title)}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t(MCP_ACCESS_TEXT.mine.subtitle)}</p>
        </div>
        <div className="grid justify-items-end gap-1">
          <Button data-testid="mcp-mine-create" disabled={!vm.canCreate} onClick={vm.dialog.onOpen}>
            <Plus data-icon="inline-start" />
            {t(MCP_ACCESS_TEXT.mine.create)}
          </Button>
          {vm.limit > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums" data-testid="mcp-mine-limit">
              {vm.canCreate
                ? t(MCP_ACCESS_TEXT.mine.limit, { count: vm.activeCount, limit: vm.limit })
                : t(MCP_ACCESS_TEXT.mine.limitReached, { limit: vm.limit })}
            </span>
          )}
        </div>
      </header>

      {vm.error && (
        <Alert variant="destructive">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      )}

      {vm.created && (
        <Alert data-testid="mcp-mine-secret">
          <AlertDescription className="grid gap-3">
            <span className="grid gap-0.5">
              <span className="font-medium text-foreground">{t(MCP_ACCESS_TEXT.mine.secretTitle, { name: vm.created.name })}</span>
              <span>{t(MCP_ACCESS_TEXT.mine.secretWarning)}</span>
            </span>
            <code className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">{vm.created.secret}</code>
            <span className="flex flex-wrap gap-2">
              <CopyButton
                value={vm.created.secret}
                label={t(MCP_ACCESS_TEXT.mine.copy)}
                copiedLabel={t(MCP_ACCESS_TEXT.mine.copied)}
                testId="mcp-mine-secret-copy"
              />
              <Button size="sm" variant="ghost" data-testid="mcp-mine-secret-dismiss" onClick={vm.dismissCreated}>
                {t(MCP_ACCESS_TEXT.mine.dismiss)}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      {vm.snippets && (
        <Card data-testid="mcp-mine-setup">
          <CardHeader>
            <CardTitle>{t(MCP_ACCESS_TEXT.setup.title)}</CardTitle>
            <CardDescription>{t(MCP_ACCESS_TEXT.setup.detail)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <SetupStep title={t(MCP_ACCESS_TEXT.setup.claude)} command={vm.snippets.claude} testId="mcp-setup-claude" />
            <SetupStep title={t(MCP_ACCESS_TEXT.setup.codex)} command={vm.snippets.codex} testId="mcp-setup-codex" />
            <p className="text-xs text-muted-foreground md:col-span-2">{t(MCP_ACCESS_TEXT.setup.codexNote)}</p>
            <p className="text-xs text-muted-foreground md:col-span-2">{t(MCP_ACCESS_TEXT.setup.verify)}</p>
          </CardContent>
        </Card>
      )}

      {vm.status === 'loading' && <Skeleton className="h-40 w-full rounded-xl" />}
      {vm.status === 'empty' && (
        <EmptyState
          title={t(MCP_ACCESS_TEXT.mine.emptyTitle)}
          detail={t(MCP_ACCESS_TEXT.mine.emptyDetail)}
          testId="mcp-mine-empty"
          action={
            <Button data-testid="mcp-mine-empty-create" disabled={!vm.canCreate} onClick={vm.dialog.onOpen}>
              <KeyRound data-icon="inline-start" />
              {t(MCP_ACCESS_TEXT.mine.create)}
            </Button>
          }
        />
      )}
      {vm.status === 'ready' && <McpKeysTable keys={vm.keys} revokingId={vm.revokingId} onRevoke={vm.onRevoke} testId="mcp-mine-keys" />}

      <AccessCard vm={vm} />

      {vm.guide && (
        <Card data-testid="mcp-mine-guide">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="grid gap-1">
                <CardTitle>{t(MCP_ACCESS_TEXT.guide.title)}</CardTitle>
                <CardDescription className="max-w-2xl">{t(MCP_ACCESS_TEXT.guide.detail)}</CardDescription>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t(MCP_ACCESS_TEXT.guide.version, { version: vm.guide.version })}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[60vh] rounded-lg bg-muted">
              <pre className="p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">{vm.guide.guide}</pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <CreateKeyDialogView dialog={vm.dialog} />
    </div>
  )
}

function AccessCard({ vm }: { vm: MyMcpKeyViewProps }) {
  const { t } = useTranslation('mcp')
  const roleLabel = (role: string) => (MCP_ROLE_TEXT[role] ? t(MCP_ROLE_TEXT[role]) : role)
  const toolLabel = (tool: string) => (MCP_TOOL_TEXT[tool] ? t(MCP_TOOL_TEXT[tool]) : tool)

  return (
    <Card className="gap-0 overflow-hidden py-0" data-testid="mcp-mine-access">
      <CardHeader className="border-b border-border py-4">
        <CardTitle>{t(MCP_ACCESS_TEXT.access.title)}</CardTitle>
        <CardDescription className="max-w-2xl">{t(MCP_ACCESS_TEXT.access.detail)}</CardDescription>
      </CardHeader>
      {vm.accessStatus === 'loading' ? (
        <div className="p-4">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : vm.access.length === 0 ? (
        <p className="px-6 py-5 text-sm text-muted-foreground">{t(MCP_ACCESS_TEXT.access.empty)}</p>
      ) : (
        <ScrollArea className="w-full">
          <Table aria-label={t(MCP_ACCESS_TEXT.access.title)}>
            <TableHeader>
              <TableRow>
                <TableHead>{t(MCP_ACCESS_TEXT.access.workspace)}</TableHead>
                <TableHead>{t(MCP_ACCESS_TEXT.access.roles)}</TableHead>
                <TableHead>{t(MCP_ACCESS_TEXT.access.tools)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vm.access.map((workspace) => (
                <TableRow key={workspace.id} className="align-top hover:bg-transparent" data-testid={`mcp-mine-access-${workspace.id}`}>
                  <TableCell className="max-w-48 truncate font-medium">{workspace.name}</TableCell>
                  <TableCell>
                    {workspace.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">{t(MCP_ACCESS_TEXT.access.noRole)}</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {workspace.roles.map((role) => (
                          <Badge key={role} variant="accent">
                            {roleLabel(role)}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="mb-1.5 block text-xs text-muted-foreground tabular-nums">
                      {t(MCP_ACCESS_TEXT.access.toolCount, { count: workspace.tools.length })}
                    </span>
                    <span className="flex max-w-2xl flex-wrap gap-1">
                      {workspace.tools.map((tool) => (
                        <span key={tool} className="rounded-md bg-muted px-1.5 py-0.5 text-[11.5px]">
                          {toolLabel(tool)}
                        </span>
                      ))}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
    </Card>
  )
}

function SetupStep({ title, command, testId }: { title: string; command: string; testId: string }) {
  const { t } = useTranslation('mcp')
  return (
    <div className="grid content-start gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <CopyButton
          value={command}
          label={t(MCP_ACCESS_TEXT.setup.copy)}
          copiedLabel={t(MCP_ACCESS_TEXT.setup.copied)}
          testId={`${testId}-copy`}
        />
      </div>
      <code className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">{command}</code>
    </div>
  )
}
