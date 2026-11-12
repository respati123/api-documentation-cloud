import { useTranslation } from 'react-i18next'
import {
  MCP_ACCESS_TEXT,
  MCP_KEY_STATE_TEXT,
  MCP_ROLE_TEXT,
  MCP_TOOL_TEXT,
} from '@/features/mcp-access/constants/mcp-access-text.constants'
import type { useMyMcpKeyViewModel } from '@/features/mcp-access/viewmodels/use-my-mcp-key.viewmodel'
import { KeyStateBadge } from '@/features/mcp-access/views/key-state-badge.view'
import { CopyButton } from '@/shared/components/copy-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/primitives/card'
import { ScrollArea } from '@/shared/components/primitives/scroll-area'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { EmptyState } from '@/shared/components/state-views'
import { formatDate } from '@/shared/utils/format'

export type MyMcpKeyViewProps = ReturnType<typeof useMyMcpKeyViewModel>

export function MyMcpKeyView(vm: MyMcpKeyViewProps) {
  const { t, i18n } = useTranslation('mcp')
  const locale = i18n.language
  const date = (value: string | null) => (value ? (formatDate(value, locale) ?? '') : '')

  return (
    <div className="grid max-w-5xl gap-6" data-testid="mcp-mine-page">
      <header className="grid gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(MCP_ACCESS_TEXT.mine.title)}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t(MCP_ACCESS_TEXT.mine.subtitle)}</p>
      </header>

      {vm.error && (
        <Alert variant="destructive">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      )}

      {vm.secret && (
        <Alert data-testid="mcp-mine-secret">
          <AlertDescription className="grid gap-3">
            <span className="font-medium text-foreground">{t(MCP_ACCESS_TEXT.mine.secretWarning)}</span>
            <code className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all text-foreground">{vm.secret}</code>
            <span className="flex flex-wrap gap-2">
              <CopyButton
                value={vm.secret}
                label={t(MCP_ACCESS_TEXT.mine.copy)}
                copiedLabel={t(MCP_ACCESS_TEXT.mine.copied)}
                testId="mcp-mine-secret-copy"
              />
              <Button size="sm" variant="ghost" data-testid="mcp-mine-secret-dismiss" onClick={vm.dismissSecret}>
                {t(MCP_ACCESS_TEXT.mine.dismiss)}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {vm.status === 'loading' && <Skeleton className="h-56 w-full rounded-xl" />}
        {vm.status === 'empty' && (
          <EmptyState title={t(MCP_ACCESS_TEXT.mine.emptyTitle)} detail={t(MCP_ACCESS_TEXT.mine.emptyDetail)} testId="mcp-mine-empty" />
        )}
        {vm.status === 'ready' && vm.mcpKey && (
          <Card data-testid="mcp-mine-key">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 gap-1">
                  <CardDescription>{t(MCP_ACCESS_TEXT.mine.keyTitle)}</CardDescription>
                  <CardTitle className="truncate">{vm.mcpKey.name}</CardTitle>
                </div>
                <KeyStateBadge state={vm.mcpKey.status} label={t(MCP_KEY_STATE_TEXT[vm.mcpKey.status])} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">{t(MCP_ACCESS_TEXT.mine.role)}</dt>
                <dd>{t(MCP_ROLE_TEXT[vm.mcpKey.role])}</dd>
              </dl>
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">{t(MCP_ACCESS_TEXT.mine.tools)}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {vm.mcpKey.tools.map((tool) => (
                    <li key={tool} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                      {MCP_TOOL_TEXT[tool] ? t(MCP_TOOL_TEXT[tool]) : tool}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                {vm.mcpKey.status === 'pending' && t(MCP_ACCESS_TEXT.mine.claimBefore, { date: date(vm.mcpKey.claimExpiresAt) })}
                {vm.mcpKey.status === 'active' && (
                  <>
                    {t(MCP_ACCESS_TEXT.mine.expires, { date: date(vm.mcpKey.expiresAt) })}
                    {' · '}
                    {vm.mcpKey.lastUsedAt
                      ? t(MCP_ACCESS_TEXT.mine.lastUsed, { date: date(vm.mcpKey.lastUsedAt) })
                      : t(MCP_ACCESS_TEXT.mine.neverUsed)}
                  </>
                )}
                {vm.needsNewKey && t(MCP_ACCESS_TEXT.mine.askAdmin)}
              </p>
              {vm.canClaim && (
                <Button className="justify-self-start" data-testid="mcp-mine-claim" disabled={vm.isClaiming} onClick={vm.onClaim}>
                  {vm.isClaiming ? t(MCP_ACCESS_TEXT.mine.claiming) : t(MCP_ACCESS_TEXT.mine.claim)}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card data-testid="mcp-mine-setup">
          <CardHeader>
            <CardTitle>{t(MCP_ACCESS_TEXT.setup.title)}</CardTitle>
            <CardDescription>{t(MCP_ACCESS_TEXT.setup.detail)}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <SetupStep title={t(MCP_ACCESS_TEXT.setup.envStep)} command={vm.snippets.env} testId="mcp-setup-env" />
            <SetupStep title={t(MCP_ACCESS_TEXT.setup.claude)} command={vm.snippets.claude} testId="mcp-setup-claude" />
            <SetupStep title={t(MCP_ACCESS_TEXT.setup.codex)} command={vm.snippets.codex} testId="mcp-setup-codex" />
            <p className="text-xs text-muted-foreground">{t(MCP_ACCESS_TEXT.setup.verify)}</p>
          </CardContent>
        </Card>
      </div>

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
    </div>
  )
}

function SetupStep({ title, command, testId }: { title: string; command: string; testId: string }) {
  const { t } = useTranslation('mcp')
  return (
    <div className="grid gap-1.5">
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
