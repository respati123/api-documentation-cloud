import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MCP_ACCESS_TEXT, MCP_KEY_STATE_TEXT, MCP_ROLE_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import type { McpKeyMember } from '@/features/mcp-access/models/mcp-key.model'
import { memberKeyState, type useAdminMcpKeysViewModel } from '@/features/mcp-access/viewmodels/use-admin-mcp-keys.viewmodel'
import { IssueKeyDialogView } from '@/features/mcp-access/views/issue-key-dialog.view'
import { KeyStateBadge } from '@/features/mcp-access/views/key-state-badge.view'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Button } from '@/shared/components/primitives/button'
import { Card } from '@/shared/components/primitives/card'
import { Input } from '@/shared/components/primitives/input'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/primitives/table'
import { formatRelativeDate } from '@/shared/utils/format'

export type AdminMcpKeysViewProps = ReturnType<typeof useAdminMcpKeysViewModel>

export function AdminMcpKeysView(vm: AdminMcpKeysViewProps) {
  const { t } = useTranslation('mcp')

  return (
    <div className="grid max-w-6xl gap-6" data-testid="mcp-admin-page">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(MCP_ACCESS_TEXT.admin.title)}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t(MCP_ACCESS_TEXT.admin.subtitle)}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            className="pl-8"
            data-testid="mcp-admin-search"
            aria-label={t(MCP_ACCESS_TEXT.admin.search)}
            placeholder={t(MCP_ACCESS_TEXT.admin.search)}
            value={vm.search}
            onChange={(event) => vm.setSearch(event.target.value)}
          />
        </div>
      </header>

      {vm.error && (
        <Alert variant="destructive">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 overflow-hidden py-0">
        <Table data-testid="mcp-admin-table">
          <TableHeader>
            <TableRow>
              <TableHead>{t(MCP_ACCESS_TEXT.admin.member)}</TableHead>
              <TableHead className="hidden md:table-cell">{t(MCP_ACCESS_TEXT.admin.keyName)}</TableHead>
              <TableHead>{t(MCP_ACCESS_TEXT.admin.status)}</TableHead>
              <TableHead className="hidden lg:table-cell">{t(MCP_ACCESS_TEXT.admin.role)}</TableHead>
              <TableHead className="hidden lg:table-cell">{t(MCP_ACCESS_TEXT.admin.lastUsed)}</TableHead>
              <TableHead className="text-right">{t(MCP_ACCESS_TEXT.admin.actions)}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vm.status === 'loading' &&
              [0, 1, 2].map((row) => (
                <TableRow key={row}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {vm.status === 'empty' && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t(MCP_ACCESS_TEXT.admin.empty)}
                </TableCell>
              </TableRow>
            )}
            {vm.status === 'ready' && vm.members.map((member) => <MemberRow key={member.userId} member={member} vm={vm} />)}
          </TableBody>
        </Table>
      </Card>
      <LoadMoreButton hasMore={vm.hasMore} isLoading={vm.isLoadingMore} onLoadMore={vm.loadMore} testId="mcp-admin-load-more" />

      {vm.dialog && (
        <IssueKeyDialogView
          dialog={vm.dialog}
          allTools={vm.allTools}
          onClose={vm.closeDialog}
          onNameChange={vm.setName}
          onRoleChange={vm.setRole}
          onToggleTool={vm.toggleTool}
          onResetTools={vm.resetTools}
          onValidDaysChange={vm.setValidDays}
          onSubmit={vm.onSubmit}
        />
      )}
    </div>
  )
}

function MemberRow({ member, vm }: { member: McpKeyMember; vm: AdminMcpKeysViewProps }) {
  const { t, i18n } = useTranslation('mcp')
  const state = memberKeyState(member)
  const key = member.key
  const busy = key !== null && vm.busyKeyId === key.id
  const testId = `mcp-admin-row-${member.userId}`

  return (
    <TableRow data-testid={testId}>
      <TableCell className="max-w-64">
        <span className="block truncate font-medium">{member.email}</span>
        <span className="text-xs text-muted-foreground">
          {t(MCP_ACCESS_TEXT.admin.workspaces)}
          {': '}
          {member.workspaceCount}
        </span>
      </TableCell>
      <TableCell className="hidden max-w-48 truncate md:table-cell">{key?.name}</TableCell>
      <TableCell>
        <KeyStateBadge state={state} label={t(MCP_KEY_STATE_TEXT[state])} />
      </TableCell>
      <TableCell className="hidden lg:table-cell">{key && t(MCP_ROLE_TEXT[key.role])}</TableCell>
      <TableCell className="hidden text-muted-foreground lg:table-cell">
        {key?.lastUsedAt ? formatRelativeDate(key.lastUsedAt, i18n.language) : key?.status === 'active' && t(MCP_ACCESS_TEXT.admin.never)}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1.5">
          {(state === 'missing' || state === 'revoked' || state === 'expired' || state === 'claim_expired') && (
            <Button size="sm" variant="outline" data-testid={`${testId}-create`} onClick={() => vm.openDialog(member)}>
              {t(MCP_ACCESS_TEXT.admin.create)}
            </Button>
          )}
          {(state === 'pending' || state === 'active') && key && (
            <>
              <Button size="sm" variant="ghost" data-testid={`${testId}-reissue`} disabled={busy} onClick={() => vm.onReissue(member)}>
                {t(MCP_ACCESS_TEXT.admin.reissue)}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                data-testid={`${testId}-revoke`}
                disabled={busy}
                onClick={() => vm.onRevoke(key.id)}
              >
                {state === 'pending' ? t(MCP_ACCESS_TEXT.admin.cancelClaim) : t(MCP_ACCESS_TEXT.admin.revoke)}
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
