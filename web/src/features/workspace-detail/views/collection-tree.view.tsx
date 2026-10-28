import { ChevronRight, Folder } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import type { ApiNode } from '@/shared/models/cloud-workspace.model'
import { countRequests } from '../utils/collection'
import { methodVariant } from './method-badge'

export function CollectionTreeView({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: ApiNode[]
  selectedId: string
  onSelect: (id: string) => void
  depth?: number
}) {
  return (
    <ul className="grid gap-0.5">
      {nodes.map((node) =>
        node.kind === 'folder' ? (
          <li key={node.id}>
            <FolderRow name={node.name} requestCount={countRequests(node.children)} depth={depth}>
              <CollectionTreeView nodes={node.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
            </FolderRow>
          </li>
        ) : (
          <li key={node.id}>
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-2 py-1.5 text-left font-normal"
              style={{ paddingInlineStart: `${depth * 0.75 + 0.5}rem` }}
              aria-current={selectedId === node.id ? 'true' : undefined}
              data-testid={`docs-request-${node.id}`}
              onClick={() => onSelect(node.id)}
            >
              <Badge variant={methodVariant(node.method)} className="shrink-0 font-mono">
                {node.method}
              </Badge>
              <span className="truncate text-sm">{node.name}</span>
            </Button>
          </li>
        ),
      )}
    </ul>
  )
}

function FolderRow({ name, requestCount, depth, children }: { name: string; requestCount: number; depth: number; children: ReactNode }) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            className="group h-auto w-full justify-start gap-2 py-1.5 font-medium"
            style={{ paddingInlineStart: `${depth * 0.75 + 0.5}rem` }}
          />
        }
      >
        <ChevronRight data-icon="inline-start" className="transition-transform group-data-[panel-open]:rotate-90" aria-hidden="true" />
        <Folder className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-sm">{name}</span>
        <Badge variant="outline" className="ml-auto tabular-nums">
          {requestCount}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
