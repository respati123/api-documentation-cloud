import { useTranslation } from 'react-i18next'
import type { WorkspaceTab } from '@/features/app-shell'
import { CopyButton } from '@/shared/components/copy-button'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/primitives/card'
import type { ApiNode, CloudCommit, RequestNode, WorkspaceSnapshot } from '@/shared/models/cloud-workspace.model'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'
import { cn } from '@/shared/utils/cn'
import { formatDate, formatRelativeDate } from '@/shared/utils/format'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'
import { collectRequests, countRequests } from '../utils/collection'
import { methodVariant } from './method-badge'

// Endpoints listed under each collection before the list points to the API docs for the rest.
const ENDPOINTS_PER_COLLECTION = 5

export interface WorkspaceOverviewViewProps {
  workspace: CloudWorkspaceRef
  snapshot: WorkspaceSnapshot
  requestCount: number
  folderCount: number
  memberCount: number
  commits: CloudCommit[]
  onTab: (tab: WorkspaceTab) => void
}

export function WorkspaceOverviewView({
  workspace,
  snapshot,
  requestCount,
  folderCount,
  memberCount,
  commits,
  onTab,
}: WorkspaceOverviewViewProps) {
  const { t, i18n } = useTranslation('workspace')
  const locale = i18n.language
  const facts = [
    { label: t(WORKSPACE_TEXT.overview.endpoints), value: requestCount },
    { label: t(WORKSPACE_TEXT.overview.collections), value: folderCount },
    { label: t(WORKSPACE_TEXT.overview.members), value: memberCount },
  ]
  const latestVersion = snapshot.headCommitId?.slice(0, 8) ?? t(WORKSPACE_TEXT.overview.notAvailable)
  const summary = `${t(WORKSPACE_TEXT.overview.collectionCount, { count: folderCount })} · ${t(WORKSPACE_TEXT.overview.endpointCount, { count: requestCount })}`

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" data-testid="workspace-overview">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle>{t(WORKSPACE_TEXT.overview.contentsTitle)}</CardTitle>
          <CardDescription>{summary}</CardDescription>
          <CardAction>
            <Button variant="link" className="px-0" onClick={() => onTab('docs')}>
              {t(WORKSPACE_TEXT.overview.browseDocs)}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {snapshot.tree.length ? (
            <div className="grid">
              {snapshot.tree.map((node) =>
                node.kind === 'folder' ? (
                  <CollectionGroup key={node.id} node={node} onOpen={() => onTab('docs')} />
                ) : (
                  <EndpointRow key={node.id} request={node} onOpen={() => onTab('docs')} />
                ),
              )}
            </div>
          ) : (
            <p className="px-4 text-sm text-muted-foreground">{t(WORKSPACE_TEXT.overview.emptyCollectionsDetail)}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card size="sm" className="py-0">
          <dl className="grid grid-cols-3 divide-x divide-border">
            {facts.map((fact) => (
              <div key={fact.label} className="grid gap-0.5 px-4 py-3">
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="font-heading text-xl font-semibold tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>{t(WORKSPACE_TEXT.overview.recentTitle)}</CardTitle>
            <CardAction>
              <Button variant="link" className="px-0" onClick={() => onTab('activity')}>
                {t(WORKSPACE_TEXT.overview.viewHistory)}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0">
            {commits.length ? (
              <ul className="grid divide-y divide-border">
                {commits.slice(0, 5).map((commit) => (
                  <li key={commit.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{commit.message}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeDate(commit.createdAt, locale) ?? t(WORKSPACE_TEXT.overview.dateUnavailable)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 text-sm text-muted-foreground">{t(WORKSPACE_TEXT.overview.emptyCommitsDetail)}</p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 pb-0">
          <CardHeader className="pb-3">
            <CardTitle>{t(WORKSPACE_TEXT.overview.details)}</CardTitle>
          </CardHeader>
          <dl className="grid divide-y divide-border border-t border-border text-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-muted-foreground">{t(WORKSPACE_TEXT.overview.latestVersion)}</dt>
              <dd className="font-mono text-xs">{latestVersion}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-muted-foreground">{t(WORKSPACE_TEXT.overview.workspaceId)}</dt>
              <dd className="flex items-center gap-2">
                <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{workspace.id.slice(0, 8)}</code>
                <CopyButton
                  value={workspace.id}
                  label={t(WORKSPACE_TEXT.overview.copyId)}
                  copiedLabel={t(WORKSPACE_TEXT.overview.copied)}
                  ariaLabel={t(WORKSPACE_TEXT.overview.copyIdLabel)}
                  testId="workspace-copy-id-button"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-muted-foreground">{t(WORKSPACE_TEXT.overview.createdLabel)}</dt>
              <dd>{formatDate(workspace.createdAt, locale) ?? t(WORKSPACE_TEXT.overview.dateUnavailable)}</dd>
            </div>
          </dl>
          <p className="rounded-b-xl border-t border-border bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
            {t(WORKSPACE_TEXT.overview.syncNote)}
          </p>
        </Card>
      </div>
    </div>
  )
}

function CollectionGroup({ node, onOpen }: { node: Extract<ApiNode, { kind: 'folder' }>; onOpen: () => void }) {
  const { t } = useTranslation('workspace')
  const requests = collectRequests(node.children)
  const hidden = requests.length - ENDPOINTS_PER_COLLECTION

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2.5 font-medium">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-xs font-semibold text-accent-foreground"
          >
            {node.name.trim().slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{node.name}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {t(WORKSPACE_TEXT.overview.endpointCount, { count: countRequests(node.children) })}
        </span>
      </div>
      {requests.slice(0, ENDPOINTS_PER_COLLECTION).map((request) => (
        <EndpointRow key={request.id} request={request} onOpen={onOpen} indent />
      ))}
      {hidden > 0 && (
        <Button variant="link" className="mb-2 ml-14 h-auto p-0 text-xs" onClick={onOpen}>
          {t(WORKSPACE_TEXT.overview.moreEndpoints, { count: hidden })}
        </Button>
      )}
    </div>
  )
}

function EndpointRow({ request, onOpen, indent = false }: { request: RequestNode; onOpen: () => void; indent?: boolean }) {
  const { t } = useTranslation('workspace')
  return (
    <Button
      variant="ghost"
      className={cn(
        'h-auto w-full justify-start gap-3 rounded-none border-t border-muted py-2 pr-4 font-normal',
        indent ? 'pl-14' : 'pl-4',
      )}
      onClick={onOpen}
    >
      <Badge variant={methodVariant(request.method)} className="w-16 shrink-0 justify-center font-mono">
        {request.method.toUpperCase()}
      </Badge>
      <span className="grid min-w-0 text-left">
        <span className="truncate text-sm">{request.name}</span>
        <code className="truncate font-mono text-xs text-muted-foreground">{request.url || t(WORKSPACE_TEXT.overview.noUrl)}</code>
      </span>
    </Button>
  )
}
