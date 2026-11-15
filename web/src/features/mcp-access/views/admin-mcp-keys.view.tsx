import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MCP_ACCESS_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import type { useAdminMcpKeysViewModel } from '@/features/mcp-access/viewmodels/use-admin-mcp-keys.viewmodel'
import { McpKeysTable } from '@/features/mcp-access/views/mcp-keys-table.view'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Input } from '@/shared/components/primitives/input'
import { Skeleton } from '@/shared/components/primitives/skeleton'

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

      {vm.status === 'loading' && <Skeleton className="h-40 w-full rounded-xl" />}
      {vm.status === 'empty' && (
        <p
          className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground"
          data-testid="mcp-admin-empty"
        >
          {t(MCP_ACCESS_TEXT.admin.empty)}
        </p>
      )}
      {vm.status === 'ready' && (
        <McpKeysTable keys={vm.keys} showOwner revokingId={vm.revokingId} onRevoke={vm.onRevoke} testId="mcp-admin-keys" />
      )}
      <LoadMoreButton hasMore={vm.hasMore} isLoading={vm.isLoadingMore} onLoadMore={vm.loadMore} testId="mcp-admin-load-more" />
    </div>
  )
}
