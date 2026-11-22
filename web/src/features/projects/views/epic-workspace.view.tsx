import { ArrowLeft, Check, ChevronRight, CircleDashed, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EPIC_TEXT } from '@/features/projects/constants/epic-text.constants'
import type { useEpicWorkspaceViewModel } from '@/features/projects/viewmodels/use-epic-workspace.viewmodel'
import { GivenWhenThen } from '@/features/projects/views/issue-detail.view'
import { CodeChip, Notice, Panel, PanelEmpty } from '@/features/projects/views/planning-marks.view'
import { LoadMoreButton } from '@/shared/components/load-more-button'
import { MarkdownContent } from '@/shared/components/markdown-content'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/primitives/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/primitives/tabs'
import { SelectField } from '@/shared/components/select-field'
import { EmptyState, ErrorState } from '@/shared/components/state-views'
import { cn } from '@/shared/utils/cn'

export type EpicWorkspaceProps = ReturnType<typeof useEpicWorkspaceViewModel>
type Epic = NonNullable<EpicWorkspaceProps['epic']>
type DocumentView = Epic['spec']
type TicketView = Epic['tickets']['waves'][number]['items'][number]

// CLOUD-001: the epics of the project, and the work inside one epic.
export function EpicWorkspaceView({ vm }: { vm: EpicWorkspaceProps }) {
  const { t } = useTranslation('planning')
  if (vm.status === 'loading') {
    return (
      <div className="grid gap-3" role="status" data-testid="epic-space-loading" aria-label={t(EPIC_TEXT.loading)}>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (vm.status === 'error') {
    return (
      <ErrorState
        testId="epic-space-error"
        title={t(EPIC_TEXT.error)}
        message={vm.error ?? ''}
        retryLabel={t(EPIC_TEXT.retry)}
        onRetry={vm.onRetry}
      />
    )
  }
  return vm.epic ? <EpicDetail epic={vm.epic} actionError={vm.actionError} /> : <EpicList vm={vm} />
}

function EpicList({ vm }: { vm: EpicWorkspaceProps }) {
  const { t } = useTranslation('planning')
  if (vm.list.length === 0) {
    return <EmptyState testId="epic-space-empty" title={t(EPIC_TEXT.listEmptyTitle)} detail={t(EPIC_TEXT.listEmptyDetail)} />
  }
  return (
    <Panel testId="epic-space-list" title={t(EPIC_TEXT.title)} description={t(EPIC_TEXT.subtitle)}>
      <ul className="divide-y divide-border">
        {vm.list.map((epic) => (
          <li key={epic.id}>
            <Button
              variant="ghost"
              className="h-auto w-full justify-between rounded-none px-[18px] py-3 text-left"
              data-testid={`epic-space-open-${epic.id}`}
              onClick={epic.onOpen}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <CodeChip>{epic.code}</CodeChip>
                <span className="truncate font-medium">{epic.title}</span>
              </span>
              <ChevronRight className="text-muted-foreground" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="px-4 py-3">
        <LoadMoreButton
          hasMore={vm.more.hasMore}
          isLoading={vm.more.isLoadingMore}
          onLoadMore={vm.more.onLoadMore}
          testId="epic-space-load-more"
        />
      </div>
    </Panel>
  )
}

function EpicDetail({ epic, actionError }: { epic: Epic; actionError: string | null }) {
  const { t } = useTranslation('planning')
  return (
    <div className="grid gap-4" data-testid="epic-space-detail">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" data-testid="epic-space-back" onClick={epic.onBack}>
          <ArrowLeft data-icon="inline-start" />
          {t(EPIC_TEXT.back)}
        </Button>
        <CodeChip>{epic.code}</CodeChip>
        <h2 className="font-heading text-lg font-semibold tracking-tight">{epic.title}</h2>
      </div>
      {actionError && (
        <Alert variant="destructive" data-testid="epic-space-action-error">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}
      <Tabs value={epic.tab} onValueChange={(value) => epic.onTab(String(value))}>
        <TabsList className="max-w-full overflow-x-auto" data-testid="epic-space-tabs">
          {epic.tabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value} data-testid={`epic-space-tab-${item.value}`}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {epic.loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <>
            <TabsContent value="overview">
              <Overview epic={epic} />
            </TabsContent>
            <TabsContent value="spec" className="grid gap-4">
              <DocumentPanel document={epic.spec} />
              <Criteria criteria={epic.criteria} />
            </TabsContent>
            <TabsContent value="design" className="grid gap-4">
              {epic.design.stale && (
                <Notice tone="warning" testId="epic-space-design-stale">
                  <p className="flex items-start gap-2 text-sm">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    {t(EPIC_TEXT.document.stale)}
                  </p>
                </Notice>
              )}
              <DocumentPanel document={epic.design} />
              <Matrix matrix={epic.matrix} />
            </TabsContent>
            <TabsContent value="contract">
              <DocumentPanel document={epic.contract} />
            </TabsContent>
            <TabsContent value="tickets">
              <Tickets tickets={epic.tickets} />
            </TabsContent>
            <TabsContent value="assign">
              <Assignment assign={epic.assign} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

const STAGE_ICON = { approved: Check, review: CircleDashed, stale: TriangleAlert, missing: CircleDashed } as const

// The stepper: Spec → Design → Contract → Tickets, each with who approves it. A step opens its tab.
function Overview({ epic }: { epic: Epic }) {
  const { t } = useTranslation('planning')
  return (
    <Panel testId="epic-space-overview" title={t(EPIC_TEXT.tab.overview)} description={epic.description || t(EPIC_TEXT.subtitle)}>
      <ol className="grid gap-3 p-[18px] sm:grid-cols-2 xl:grid-cols-4">
        {epic.stages.map((stage, index) => {
          const Icon = STAGE_ICON[stage.state]
          return (
            <li key={stage.id}>
              <Button
                variant="outline"
                className={cn(
                  'h-auto w-full flex-col items-start gap-1.5 rounded-xl p-3.5 text-left whitespace-normal',
                  stage.current && 'border-primary',
                )}
                data-testid={`epic-space-stage-${stage.id}`}
                aria-current={stage.current ? 'step' : undefined}
                onClick={stage.onOpen}
              >
                <span className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{index + 1}</span>
                  {stage.current && <Badge variant="accent">{t(EPIC_TEXT.stageCurrent)}</Badge>}
                </span>
                <span className="font-heading text-[15px] font-semibold">{stage.label}</span>
                <Badge variant={stage.tone}>
                  <Icon data-icon="inline-start" />
                  {stage.stateLabel}
                </Badge>
                <span className="text-xs font-normal text-muted-foreground">{stage.owner}</span>
              </Button>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

function DocumentPanel({ document }: { document: DocumentView }) {
  const { t } = useTranslation('planning')
  return (
    <Panel
      testId={`epic-space-${document.kind}`}
      title={document.exists ? document.title : t(EPIC_TEXT.tab[document.kind])}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={document.tone}>{document.state}</Badge>
          {document.version}
        </span>
      }
      action={
        document.canApprove && (
          <Button size="sm" data-testid={`epic-space-approve-${document.kind}`} disabled={document.approving} onClick={document.onApprove}>
            <Check data-icon="inline-start" />
            {document.approving ? t(EPIC_TEXT.document.approving) : t(EPIC_TEXT.document.approve)}
          </Button>
        )
      }
    >
      {document.exists ? (
        <dl className="grid divide-y divide-border">
          {document.sections.map((section) => (
            <div
              key={section.id}
              className="grid gap-1.5 px-[18px] py-3 md:grid-cols-[180px_1fr] md:gap-4"
              data-testid={`epic-space-${document.kind}-${section.id}`}
            >
              <dt className="text-xs font-medium text-muted-foreground">{section.label}</dt>
              <dd className="min-w-0 text-sm">
                <MarkdownContent blocks={section.blocks} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <PanelEmpty>
          {document.missing}
          {document.blocked && <span className="mt-1 block text-xs">{document.blocked}</span>}
        </PanelEmpty>
      )}
    </Panel>
  )
}

function Criteria({ criteria }: { criteria: Epic['criteria'] }) {
  const { t } = useTranslation('planning')
  return (
    <Panel
      testId="epic-space-criteria"
      title={t(EPIC_TEXT.criteria.title)}
      description={criteria.coverage}
      action={
        criteria.flows.length > 2 && (
          <SelectField
            size="sm"
            className="w-44"
            label={t(EPIC_TEXT.criteria.flowFilter)}
            testId="epic-space-flow"
            value={criteria.flow}
            options={criteria.flows}
            onValueChange={criteria.onFlow}
          />
        )
      }
    >
      {criteria.items.length === 0 ? (
        <PanelEmpty>{t(EPIC_TEXT.criteria.empty)}</PanelEmpty>
      ) : (
        <div className="grid gap-3 p-[18px] lg:grid-cols-2">
          {criteria.items.map((item) => (
            <article
              key={item.id}
              className={cn('grid content-start gap-2 rounded-xl border border-border p-3.5', item.struck && 'opacity-60')}
              data-testid={`epic-space-criterion-${item.code}`}
            >
              <header className="flex flex-wrap items-center gap-2">
                <CodeChip>{item.code}</CodeChip>
                <span className={cn('font-medium', item.struck && 'line-through')}>{item.title}</span>
                {item.flow && <Badge variant="secondary">{item.flow}</Badge>}
                {item.struck && <Badge variant="warning">{t(EPIC_TEXT.criteria.struck)}</Badge>}
              </header>
              {item.struckReason && <p className="text-xs text-muted-foreground">{item.struckReason}</p>}
              <GivenWhenThen given={item.given} when={item.when} outcomes={item.outcomes} testId={`epic-space-gwt-${item.code}`} />
              <div className="flex flex-wrap gap-1.5">
                {item.coverage.map((mark) => (
                  <Badge
                    key={mark.id}
                    variant={mark.on ? 'success' : 'outline'}
                    data-testid={`epic-space-coverage-${item.code}-${mark.id}`}
                  >
                    {mark.on ? <Check data-icon="inline-start" /> : <CircleDashed data-icon="inline-start" />}
                    {mark.label}
                  </Badge>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </Panel>
  )
}

function Matrix({ matrix }: { matrix: Epic['matrix'] }) {
  const { t } = useTranslation('planning')
  return (
    <Panel testId="epic-space-matrix" title={t(EPIC_TEXT.matrix.title)} description={t(EPIC_TEXT.matrix.subtitle)}>
      {matrix.repos.length === 0 ? (
        <PanelEmpty>{t(EPIC_TEXT.matrix.empty)}</PanelEmpty>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-[18px]">{t(EPIC_TEXT.matrix.criterion)}</TableHead>
                {matrix.repos.map((repo) => (
                  <TableHead key={repo}>{repo}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matrix.rows.map((row) => (
                <TableRow key={row.id} data-testid={`epic-space-matrix-${row.code}`}>
                  <TableCell className="pl-[18px] align-top">
                    <span className="grid gap-0.5">
                      <CodeChip>{row.code}</CodeChip>
                      <span className="text-xs text-muted-foreground">{row.title}</span>
                    </span>
                  </TableCell>
                  {row.cells.map((cell) => (
                    <TableCell key={cell.id} className={cn('align-top text-xs whitespace-pre-wrap', cell.empty && 'text-muted-foreground')}>
                      {cell.text}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  )
}

// The split in waves. A wave can start when the waves before it are done; a loop is shown apart.
function Tickets({ tickets }: { tickets: Epic['tickets'] }) {
  const { t } = useTranslation('planning')
  if (tickets.total === 0) {
    return (
      <Panel testId="epic-space-tickets" title={t(EPIC_TEXT.tickets.title)}>
        <PanelEmpty>{t(EPIC_TEXT.tickets.empty)}</PanelEmpty>
      </Panel>
    )
  }
  return (
    <Panel testId="epic-space-tickets" title={t(EPIC_TEXT.tickets.title)} description={t(EPIC_TEXT.tickets.subtitle)}>
      <div className="grid gap-4 p-[18px]">
        {tickets.waves.map((wave) => (
          <section key={wave.id} className="grid gap-2" data-testid={`epic-space-${wave.id}`}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">{wave.label}</h4>
            <div className="grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
              {wave.items.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          </section>
        ))}
        {tickets.looped.length > 0 && (
          <Notice tone="warning" testId="epic-space-looped">
            <div className="grid w-full gap-2">
              <p className="text-sm font-medium">{t(EPIC_TEXT.tickets.looped)}</p>
              <p className="text-xs">{t(EPIC_TEXT.tickets.loopedDetail)}</p>
              <div className="grid items-start gap-2 md:grid-cols-2">
                {tickets.looped.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </div>
          </Notice>
        )}
      </div>
    </Panel>
  )
}

function TicketCard({ ticket }: { ticket: TicketView }) {
  return (
    <article
      className="grid content-start gap-1.5 rounded-xl border border-border bg-card p-3"
      data-testid={`epic-space-ticket-${ticket.id}`}
    >
      <header className="flex flex-wrap items-center gap-1.5">
        <CodeChip>{ticket.code}</CodeChip>
        {ticket.size && <Badge variant="accent">{ticket.size}</Badge>}
        <Badge variant={ticket.ready ? 'success' : 'warning'}>{ticket.readyLabel}</Badge>
      </header>
      <p className="text-sm font-medium">{ticket.title}</p>
      {ticket.dependsOn && <p className="text-xs text-muted-foreground">{ticket.dependsOn}</p>}
      <p className="text-xs text-muted-foreground">{ticket.assignee}</p>
      {ticket.failing.length > 0 && (
        <ul className="grid gap-0.5 text-xs text-warning">
          {ticket.failing.map((miss) => (
            <li key={miss.id}>{miss.label}</li>
          ))}
        </ul>
      )}
    </article>
  )
}

// The proposal: who takes each Ready ticket, and what it does to each person's load. The tech lead confirms.
function Assignment({ assign }: { assign: Epic['assign'] }) {
  const { t } = useTranslation('planning')
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Panel
        testId="epic-space-assign"
        title={t(EPIC_TEXT.assign.title)}
        description={t(EPIC_TEXT.assign.subtitle)}
        clip={false}
        action={
          assign.rows.length > 0 && (
            <Button
              size="sm"
              data-testid="epic-space-assign-confirm"
              disabled={!assign.canConfirm || assign.confirming}
              onClick={assign.onConfirm}
            >
              <Check data-icon="inline-start" />
              {assign.confirming ? t(EPIC_TEXT.assign.confirming) : t(EPIC_TEXT.assign.confirm)}
            </Button>
          )
        }
      >
        {assign.rows.length === 0 ? (
          <PanelEmpty>{t(EPIC_TEXT.assign.empty)}</PanelEmpty>
        ) : (
          <div className="grid">
            {assign.onlyLead && <p className="px-[18px] pt-3 text-xs text-muted-foreground">{t(EPIC_TEXT.assign.onlyLead)}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-[18px]">{t(EPIC_TEXT.assign.ticket)}</TableHead>
                  <TableHead>{t(EPIC_TEXT.assign.points)}</TableHead>
                  <TableHead className="pr-[18px]">{t(EPIC_TEXT.assign.proposed)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assign.rows.map((row) => (
                  <TableRow key={row.id} data-testid={`epic-space-assign-${row.id}`}>
                    <TableCell className="pl-[18px]">
                      <span className="grid gap-0.5">
                        <CodeChip>{row.code}</CodeChip>
                        <span className="text-xs text-muted-foreground">{row.title}</span>
                      </span>
                    </TableCell>
                    <TableCell>{row.points}</TableCell>
                    <TableCell className="pr-[18px]">
                      <SelectField
                        size="sm"
                        className="min-w-48"
                        label={`${t(EPIC_TEXT.assign.proposed)} ${row.code}`}
                        testId={`epic-space-assignee-${row.id}`}
                        value={row.value}
                        options={row.options}
                        disabled={row.disabled || assign.onlyLead}
                        onValueChange={row.onChange}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
      <Panel testId="epic-space-load" title={t(EPIC_TEXT.assign.load)} description={t(EPIC_TEXT.assign.loadSubtitle)}>
        {assign.load.length === 0 ? (
          <PanelEmpty>{t(EPIC_TEXT.assign.loadEmpty)}</PanelEmpty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-[18px]">{t(EPIC_TEXT.assign.member)}</TableHead>
                <TableHead>{t(EPIC_TEXT.assign.before)}</TableHead>
                <TableHead className="pr-[18px]">{t(EPIC_TEXT.assign.after)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assign.load.map((row) => (
                <TableRow key={row.id} data-testid={`epic-space-load-${row.id}`}>
                  <TableCell className="max-w-40 truncate pl-[18px]">{row.name}</TableCell>
                  <TableCell>{row.before}</TableCell>
                  <TableCell className={cn('pr-[18px] font-medium', row.after > row.before && 'text-primary')}>{row.after}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
