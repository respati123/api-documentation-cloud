import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/shared/components/state-views'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import type { ApiNode, RequestNode } from '@/shared/models/cloud-workspace.model'
import { DOCS_TEXT } from '../constants/docs-text.constants'
import { CollectionTreeView } from './collection-tree.view'
import { EndpointDocumentView } from './endpoint-document.view'

export interface ApiDocsViewProps {
  tree: ApiNode[]
  totalRequests: number
  query: string
  onQueryChange: (value: string) => void
  selectedRequest: RequestNode | null
  onSelect: (requestId: string) => void
}

export function ApiDocsView({ tree, totalRequests, query, onQueryChange, selectedRequest, onSelect }: ApiDocsViewProps) {
  const { t } = useTranslation('docs')
  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <aside className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{t(DOCS_TEXT.tree.title)}</p>
          <span className="text-xs tabular-nums text-muted-foreground">{totalRequests}</span>
        </div>
        <div className="relative">
          <Label htmlFor="docs-search" className="sr-only">
            {t(DOCS_TEXT.search.label)}
          </Label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="docs-search"
            type="search"
            data-testid="docs-search-input"
            className="pl-8"
            value={query}
            placeholder={t(DOCS_TEXT.search.placeholder)}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
        <ScrollArea className="max-h-[60vh]">
          {tree.length ? (
            <CollectionTreeView nodes={tree} selectedId={selectedRequest?.id ?? ''} onSelect={onSelect} />
          ) : (
            <p className="px-2 py-4 text-sm text-muted-foreground">{t(query ? DOCS_TEXT.tree.noMatches : DOCS_TEXT.tree.empty)}</p>
          )}
        </ScrollArea>
      </aside>
      <div className="min-w-0">
        {selectedRequest ? (
          <EndpointDocumentView request={selectedRequest} />
        ) : (
          <EmptyState title={t(DOCS_TEXT.empty.title)} detail={t(DOCS_TEXT.empty.detail)} testId="docs-empty-state" />
        )}
      </div>
    </div>
  )
}
