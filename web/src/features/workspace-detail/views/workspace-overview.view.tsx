import { useTranslation } from 'react-i18next'
import type { WorkspaceTab } from '@/features/app-shell'
import { SplitFlap } from '@/shared/components/split-flap'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import type { ApiNode, CloudCommit, WorkspaceSnapshot } from '@/shared/models/cloud-workspace.model'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'
import { formatDate, formatRelativeDate } from '@/shared/utils/format'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'
import { countRequests } from '../utils/collection'

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
    { label: t(WORKSPACE_TEXT.overview.endpoints), value: String(requestCount) },
    { label: t(WORKSPACE_TEXT.overview.collections), value: String(folderCount) },
    { label: t(WORKSPACE_TEXT.overview.members), value: String(memberCount) },
  ]
  const latestVersion = snapshot.headCommitId?.slice(0, 8) ?? t(WORKSPACE_TEXT.overview.notAvailable)

  return (
    <div className="grid gap-6" data-testid="workspace-overview">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {facts.map((fact) => (
          <Card key={fact.label} size="sm">
            <CardContent className="grid gap-1">
              <dt className="text-xs text-muted-foreground">{fact.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{fact.value}</dd>
            </CardContent>
          </Card>
        ))}
        <Card size="sm">
          <CardContent className="grid gap-1">
            <dt className="text-xs text-muted-foreground">{t(WORKSPACE_TEXT.overview.latestVersion)}</dt>
            <dd className="text-sm font-medium">
              <SplitFlap value={latestVersion} />
            </dd>
          </CardContent>
        </Card>
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t(WORKSPACE_TEXT.overview.collectionsTitle)}</CardTitle>
            <CardDescription>{t(WORKSPACE_TEXT.overview.collectionsDetail)}</CardDescription>
            <CardAction>
              <Button variant="link" className="px-0" onClick={() => onTab('docs')}>
                {t(WORKSPACE_TEXT.overview.browseDocs)}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-2">
            {snapshot.tree.length ? (
              snapshot.tree.slice(0, 8).map((node) => <CollectionRow key={node.id} node={node} onOpen={() => onTab('docs')} />)
            ) : (
              <p className="text-sm text-muted-foreground">{t(WORKSPACE_TEXT.overview.emptyCollectionsDetail)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(WORKSPACE_TEXT.overview.recentTitle)}</CardTitle>
            <CardDescription>{t(WORKSPACE_TEXT.overview.recentDetail)}</CardDescription>
            <CardAction>
              <Button variant="link" className="px-0" onClick={() => onTab('activity')}>
                {t(WORKSPACE_TEXT.overview.viewHistory)}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            {commits.slice(0, 5).map((commit) => (
              <div key={commit.id} className="grid gap-0.5 border-l-2 border-border pl-3">
                <span className="text-sm font-medium">{commit.message}</span>
                <span className="text-xs text-muted-foreground">
                  {commit.authorEmail} · {formatRelativeDate(commit.createdAt, locale) ?? t(WORKSPACE_TEXT.overview.dateUnavailable)}
                </span>
              </div>
            ))}
            {!commits.length && <p className="text-sm text-muted-foreground">{t(WORKSPACE_TEXT.overview.emptyCommitsDetail)}</p>}
          </CardContent>
        </Card>
      </div>

      <Alert>
        <AlertDescription>{t(WORKSPACE_TEXT.overview.syncNote)}</AlertDescription>
      </Alert>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <span>
          {t(WORKSPACE_TEXT.overview.created, {
            date: formatDate(workspace.createdAt, locale) ?? t(WORKSPACE_TEXT.overview.dateUnavailable),
          })}
        </span>
        <span className="flex items-center gap-2">
          {t(WORKSPACE_TEXT.overview.workspaceId)} <Badge variant="outline">{workspace.id.slice(0, 8)}</Badge>
        </span>
        <Button variant="link" className="h-auto p-0 text-xs" onClick={() => onTab('team')}>
          {t(WORKSPACE_TEXT.overview.manageTeam)}
        </Button>
      </div>
    </div>
  )
}

function CollectionRow({ node, onOpen }: { node: ApiNode; onOpen: () => void }) {
  const { t } = useTranslation('workspace')
  const detail =
    node.kind === 'folder'
      ? t(WORKSPACE_TEXT.overview.endpointCount, { count: countRequests(node.children) })
      : `${node.method} · ${node.url || t(WORKSPACE_TEXT.overview.noUrl)}`
  return (
    <Button variant="ghost" className="h-auto justify-start py-2" onClick={onOpen}>
      <span className="grid min-w-0 text-left">
        <span className="truncate text-sm font-medium">{node.name}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </Button>
  )
}
