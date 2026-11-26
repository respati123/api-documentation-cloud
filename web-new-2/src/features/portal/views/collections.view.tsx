import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {  } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FieldGroup, FieldTitle, FieldDescription } from '@/components/ui/field'
import { collectionsPreviewDefaultRequest, collectionsPreviewTree } from '../data/collections-preview.data'
import type { ApiNode } from '../models/portal.model'
import type { PortalViewModel } from '../hooks/use-portal.viewmodel'
import { methodLabelClass } from '../utils/request-documentation.utils'
import { EndpointDocumentView } from './endpoint-document.view'
import { EmptyView, ErrorView, LoadingView } from './state.view'

// Both panels stop at the same height, so a long list or a long documentation page scrolls inside its own panel.
const PANEL_HEIGHT = 'max-h-[min(72svh,46rem)] pr-3'

function countRequests(nodes: ApiNode[]): number {
  return nodes.reduce((total, node) => {
    return total + (node.kind === 'request' ? 1 : countRequests(node.children ?? []))
  }, 0)
}

function containsRequest(nodes: ApiNode[], id: string | undefined): boolean {
  if (!id) return false
  return nodes.some(node => node.id === id || containsRequest(node.children ?? [], id))
}

function hasRequestMatch(nodes: ApiNode[], query: string): boolean {
  if (!query) return true
  const normalizedQuery = query.toLowerCase()
  return nodes.some(node => {
    if (node.kind === 'folder') return hasRequestMatch(node.children ?? [], query)
    return `${node.name} ${node.url ?? ''}`.toLowerCase().includes(normalizedQuery)
  })
}

function RequestRow({
  node,
  select,
  selected,
}: {
  node: ApiNode
  select: (node: ApiNode) => void
  selected: boolean
}) {
  return (
    <Button
      data-testid={`collection-request-${node.id}`}
      data-selected={selected || undefined}
      aria-pressed={selected}
      variant="ghost"
      className="h-auto min-h-10 w-full justify-start whitespace-normal text-left data-[selected=true]:bg-selected"
      onClick={() => select(node)}
    >
      <FieldDescription className={`shrink-0 text-xs font-medium ${methodLabelClass(node.method ?? 'GET')}`}>
        {node.method ?? 'GET'}
      </FieldDescription>
      {node.name}
    </Button>
  )
}

function FolderNode({
  node,
  select,
  query,
  selectedId,
}: {
  node: ApiNode
  select: (node: ApiNode) => void
  query: string
  selectedId?: string
}) {
  const { t } = useTranslation()
  const children = node.children ?? []
  const containsSelected = containsRequest(children, selectedId)
  const containsMatches = hasRequestMatch(children, query)
  const [open, setOpen] = useState(containsSelected || Boolean(query && containsMatches))

  useEffect(() => {
    if (query) {
      setOpen(containsMatches)
    } else if (containsSelected) {
      setOpen(true)
    }
  }, [containsMatches, containsSelected, query, selectedId])

  if (query && !containsMatches) return null

  return (
    <FieldGroup className="gap-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto min-h-10 w-full justify-start px-3 text-left"
            aria-label={open ? t('collections.collapse', { name: node.name }) : t('collections.expand', { name: node.name })}
          >
            <ChevronRight
              aria-hidden="true"
              className={`size-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
            />
            <FieldDescription className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground">
              {node.name}
            </FieldDescription>
            <Badge variant="outline">{countRequests(children)}</Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:animate-none data-[state=open]:animate-none">
          <Tree
            nodes={children}
            select={select}
            query={query}
            selectedId={selectedId}
            className="ml-5 border-l pl-3 pb-2"
          />
        </CollapsibleContent>
      </Collapsible>
    </FieldGroup>
  )
}

function Tree({
  nodes,
  select,
  query,
  selectedId,
  className,
}: {
  nodes: ApiNode[]
  select: (node: ApiNode) => void
  query: string
  selectedId?: string
  className?: string
}) {
  return (
    <FieldGroup className={`gap-1 ${className ?? ''}`}>
      {nodes.map(node => {
        if (node.kind === 'folder') {
          return (
            <FolderNode
              key={node.id}
              node={node}
              select={select}
              query={query}
              selectedId={selectedId}
            />
          )
        }

        if (query && !`${node.name} ${node.url}`.toLowerCase().includes(query.toLowerCase())) {
          return null
        }

        return (
          <RequestRow
            key={node.id}
            node={node}
            select={select}
            selected={node.id === selectedId}
          />
        )
      })}
    </FieldGroup>
  )
}

export function CollectionsView({ vm }: { vm: PortalViewModel }) {
  const { t } = useTranslation()
  const [previewRequested, setPreviewRequested] = useState(false)
  const syncedTree = vm.snapshot.data?.tree ?? []

  useEffect(() => {
    if (!previewRequested || !syncedTree.length) return
    setPreviewRequested(false)
    if (vm.selected?.id.startsWith('sample-')) vm.setSelected(null)
  }, [previewRequested, syncedTree.length, vm.selected, vm.setSelected])

  if (vm.snapshot.isPending) return <LoadingView />
  if (vm.snapshot.error) {
    return <ErrorView error={vm.snapshot.error} retry={() => void vm.snapshot.refetch()} />
  }
  const isPreview = previewRequested && !syncedTree.length
  const tree = isPreview ? collectionsPreviewTree : syncedTree

  if (!tree.length) {
    return (
      <FieldGroup className="items-center gap-4 py-4">
        <EmptyView
          title={t('collections.noCollections')}
          description={t('collections.noCollectionsDescription')}
        />
        <Button
          variant="outline"
          onClick={() => {
            vm.setSearch('')
            vm.setSelected(collectionsPreviewDefaultRequest)
            setPreviewRequested(true)
          }}
          data-testid="collections-preview-button"
        >
          {t('collections.previewSample')}
        </Button>
      </FieldGroup>
    )
  }

  return (
    <FieldGroup className="gap-4" data-testid="collections-view-container">
      {isPreview && (
        <FieldGroup className="flex-row flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <FieldGroup className="min-w-0 flex-1 gap-1">
            <FieldTitle className="text-sm">{t('collections.sampleTitle')}</FieldTitle>
            <FieldDescription className="max-w-[72ch] break-words text-xs">
              {t('collections.sampleDescription')}
            </FieldDescription>
          </FieldGroup>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              vm.setSelected(null)
              setPreviewRequested(false)
            }}
            data-testid="collections-preview-exit-button"
          >
            {t('collections.exitPreview')}
          </Button>
        </FieldGroup>
      )}
      <FieldGroup className="grid items-start gap-6 lg:grid-cols-[minmax(240px,1fr)_2fr]">
        <ScrollArea viewportClassName={PANEL_HEIGHT} data-testid="collections-tree-scroll">
          <Tree
            nodes={tree}
            select={vm.setSelected}
            query={vm.search}
            selectedId={vm.selected?.id}
          />
        </ScrollArea>
        {vm.selected ? (
          <ScrollArea viewportClassName={PANEL_HEIGHT} data-testid="collections-detail-scroll">
            <EndpointDocumentView request={vm.selected} />
          </ScrollArea>
        ) : (
          <EmptyView title={t('collections.selectRequest')} description={t('collections.selectRequestDescription')} />
        )}
      </FieldGroup>
    </FieldGroup>
  )
}
