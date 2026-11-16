import { Archive, Download, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { useDocumentDetailViewModel } from '@/features/projects/viewmodels/use-document-detail.viewmodel'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { PlanningActivityView } from '@/features/projects/views/planning-activity.view'
import { PlanningCommentsView } from '@/features/projects/views/planning-comments.view'
import { PlanningCrumbs } from '@/features/projects/views/planning-crumbs.view'
import {
  AgentAvatar,
  DOCUMENT_TONE,
  Notice,
  Panel,
  PanelEmpty,
  PropertyList,
  PropertyRow,
  StatusBadge,
} from '@/features/projects/views/planning-marks.view'
import { MarkdownContent } from '@/shared/components/markdown-content'
import { Alert, AlertDescription } from '@/shared/components/primitives/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/primitives/alert-dialog'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/primitives/tabs'
import { Textarea } from '@/shared/components/primitives/textarea'
import { cn } from '@/shared/utils/cn'

type Planning = ReturnType<typeof usePlanningViewModel>
type Detail = ReturnType<typeof useDocumentDetailViewModel>

export function DocumentDetailView({ planning }: { planning: Planning }) {
  const { t } = useTranslation('planning')
  const vm = planning.documentDetail
  const document = vm.document

  if (vm.status === 'loading' || !document) {
    return (
      <div className="grid gap-4" data-testid="projects-document-loading">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="grid gap-4" data-testid="projects-document-detail">
      <div>
        <PlanningCrumbs
          label={t(PLANNING_TEXT.document.crumbProject)}
          crumbs={[
            { label: t(PLANNING_TEXT.document.crumbProject), onSelect: () => planning.go('flow'), testId: 'projects-document-crumb-flow' },
            {
              label: t(PLANNING_TEXT.documents.title),
              onSelect: () => planning.go('documents'),
              testId: 'projects-document-crumb-documents',
            },
            ...(vm.source
              ? [
                  {
                    label: vm.source.title,
                    onSelect: () => planning.openDocument(vm.source?.id ?? ''),
                    testId: 'projects-document-crumb-source',
                  },
                ]
              : []),
            { label: document.title },
          ]}
        />
        {vm.isPrd && <PrdNotice vm={vm} />}
        {vm.isBrdDraft && <BrdNotice vm={vm} />}
        {vm.isDiscarded && (
          <Notice tone="warning" testId="projects-document-discarded">
            <div>
              <p className="font-semibold">{t(PLANNING_TEXT.document.discardedTitle)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{t(PLANNING_TEXT.document.discardedDetail)}</p>
            </div>
          </Notice>
        )}
      </div>

      {vm.error && (
        <Alert variant="destructive">
          <AlertDescription>{vm.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[200px_minmax(0,1fr)_280px]">
        {vm.headings.length > 0 && (
          <nav aria-label={t(PLANNING_TEXT.document.toc)} className="sticky top-4 hidden gap-0.5 text-[13px] 2xl:grid">
            {vm.headings.map((heading) => (
              <Button
                key={heading.id}
                variant="ghost"
                data-testid={`projects-document-toc-${heading.id}`}
                className={cn(
                  'h-auto justify-start rounded-none border-0 border-l-2 border-border py-1.5 text-left font-normal whitespace-normal text-muted-foreground hover:border-primary hover:bg-transparent hover:text-foreground',
                  heading.level === 3 ? 'pl-6' : 'pl-3',
                )}
                onClick={() => window.document.getElementById(heading.id)?.scrollIntoView({ block: 'start' })}
              >
                {heading.text}
              </Button>
            ))}
          </nav>
        )}

        <article
          className={cn(
            'rounded-xl border border-border bg-card px-5 py-6 sm:px-8',
            vm.headings.length === 0 && '2xl:col-start-1 2xl:col-end-3',
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{t(PLANNING_TEXT.kind[document.kind])}</Badge>
            <StatusBadge tone={DOCUMENT_TONE[document.status].badge}>{t(PLANNING_TEXT.status.document[document.status])}</StatusBadge>
            <span className="text-xs text-muted-foreground">
              {t(PLANNING_TEXT.documents.version, { version: document.currentVersion })}
            </span>
            <span className="ml-auto flex gap-1.5">
              {vm.canDownload && (
                <Button size="sm" variant="ghost" data-testid="projects-document-download" onClick={vm.onDownload}>
                  <Download data-icon="inline-start" />
                  {t(PLANNING_TEXT.document.download)}
                </Button>
              )}
              {vm.canEdit && !vm.editing && (
                <Button size="sm" variant="outline" data-testid="projects-document-edit" onClick={vm.onEdit}>
                  <Pencil data-icon="inline-start" />
                  {t(PLANNING_TEXT.document.edit)}
                </Button>
              )}
              {vm.canDiscard && !vm.editing && (
                <ConfirmButton
                  testId="projects-document-discard"
                  icon={<Archive data-icon="inline-start" />}
                  label={t(PLANNING_TEXT.document.discard)}
                  title={t(PLANNING_TEXT.document.discardTitle)}
                  detail={t(PLANNING_TEXT.document.discardDetail)}
                  confirm={t(PLANNING_TEXT.document.discard)}
                  disabled={vm.isBusy}
                  onConfirm={vm.onDiscard}
                />
              )}
              {vm.canDelete && !vm.editing && (
                <ConfirmButton
                  testId="projects-document-delete"
                  icon={<Trash2 data-icon="inline-start" />}
                  label={t(PLANNING_TEXT.document.delete)}
                  title={t(PLANNING_TEXT.document.deleteTitle, { title: document.title })}
                  detail={t(PLANNING_TEXT.document.deleteDetail)}
                  confirm={t(PLANNING_TEXT.document.delete)}
                  disabled={vm.isBusy}
                  destructive
                  onConfirm={vm.onDelete}
                />
              )}
            </span>
          </div>
          <h2 className="mt-2.5 font-heading text-2xl font-semibold tracking-tight sm:text-[26px]">{document.title}</h2>
          {vm.source && <p className="mt-1.5 text-sm text-muted-foreground">{t(PLANNING_TEXT.document.source, vm.source)}</p>}

          {vm.viewingVersion !== null && (
            <Notice tone="warning" testId="projects-document-old-version">
              <span className="text-sm">{t(PLANNING_TEXT.document.viewing, { version: vm.viewingVersion })}</span>
              <Button
                size="sm"
                variant="outline"
                data-testid="projects-document-latest"
                onClick={() => vm.onViewVersion(document.currentVersion)}
              >
                {t(PLANNING_TEXT.document.backToLatest)}
              </Button>
            </Notice>
          )}

          {vm.editing ? (
            <div className="mt-5 grid gap-3">
              <Textarea
                aria-label={t(PLANNING_TEXT.document.content)}
                data-testid="projects-document-content"
                className="min-h-96 font-mono text-xs leading-relaxed"
                value={vm.draft}
                onChange={(event) => vm.setDraft(event.target.value)}
              />
              <div className="flex gap-2">
                <Button data-testid="projects-document-save" disabled={!vm.canSave} onClick={vm.onSave}>
                  {t(PLANNING_TEXT.document.saveVersion)}
                </Button>
                <Button variant="ghost" data-testid="projects-document-cancel" onClick={vm.onCancelEdit}>
                  {t(PLANNING_TEXT.document.cancel)}
                </Button>
              </div>
            </div>
          ) : (
            <DocumentBody vm={vm} />
          )}
        </article>

        <aside className="grid gap-4">
          {vm.isPrd && <ApprovalPanel vm={vm} />}
          {document.kind === 'brd' && (
            <Panel title={t(PLANNING_TEXT.document.derived)}>
              {vm.derived.length === 0 ? (
                <PanelEmpty>{t(PLANNING_TEXT.document.derivedEmpty)}</PanelEmpty>
              ) : (
                <ul className="grid gap-1 px-[18px] py-3">
                  {vm.derived.map((row) => (
                    <li key={row.id}>
                      <Button
                        variant="link"
                        className="h-auto px-0 text-left whitespace-normal"
                        data-testid={`projects-document-derived-${row.id}`}
                        onClick={() => planning.openDocument(row.id)}
                      >
                        {row.title}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
          <Panel
            title={t(PLANNING_TEXT.document.decisions)}
            action={<Badge variant="secondary">{planning.comments.decisions.length}</Badge>}
          >
            {planning.comments.decisions.length === 0 ? (
              <PanelEmpty>{t(PLANNING_TEXT.document.decisionsEmpty)}</PanelEmpty>
            ) : (
              <ul className="grid gap-2.5 px-[18px] py-4">
                {planning.comments.decisions.map((decision) => (
                  <li key={decision.id} className="rounded-xl border border-success/30 bg-success/5 px-3 py-2.5 text-[12.5px]">
                    <p className="font-semibold whitespace-pre-wrap">{decision.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{decision.authorEmail.split('@')[0]}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={t(PLANNING_TEXT.document.versions)}>
            <ul className="divide-y divide-border">
              {vm.versions.map((version) => (
                <li key={version.version}>
                  <Button
                    variant="ghost"
                    aria-current={version.isViewing ? 'true' : undefined}
                    data-testid={`projects-document-version-${version.version}`}
                    className={cn(
                      'grid h-auto w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-none px-[18px] py-2 text-left',
                      version.isViewing && 'bg-accent/60',
                    )}
                    onClick={() => vm.onViewVersion(version.version)}
                  >
                    <Badge variant="outline">{t(PLANNING_TEXT.documents.version, { version: version.version })}</Badge>
                    <span className="text-[12.5px] font-normal">{version.isCurrent ? t(PLANNING_TEXT.document.latest) : ''}</span>
                    <span className="text-xs font-normal text-muted-foreground">{version.when}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <PlanningCommentsView vm={planning.comments} testId="projects-document-comments" />
        <PlanningActivityView activity={planning.activity} />
      </div>
    </div>
  )
}

function ConfirmButton(props: {
  testId: string
  icon: React.ReactNode
  label: string
  title: string
  detail: string
  confirm: string
  disabled: boolean
  destructive?: boolean
  onConfirm: () => void
}) {
  const { t } = useTranslation('planning')
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className={cn(props.destructive && 'text-destructive')}
            disabled={props.disabled}
            data-testid={props.testId}
          />
        }
      >
        {props.icon}
        {props.label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{props.title}</AlertDialogTitle>
          <AlertDialogDescription>{props.detail}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`${props.testId}-cancel`}>{t(PLANNING_TEXT.document.cancel)}</AlertDialogCancel>
          <AlertDialogAction
            variant={props.destructive ? 'destructive' : 'default'}
            data-testid={`${props.testId}-confirm`}
            onClick={props.onConfirm}
          >
            {props.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function DocumentBody({ vm }: { vm: Detail }) {
  const { t } = useTranslation('planning')
  const document = vm.document
  if (!document) return null
  if (vm.content.trim() === '' && !vm.hasOriginal)
    return <p className="mt-5 text-sm text-muted-foreground">{t(PLANNING_TEXT.document.empty)}</p>
  if (vm.format === 'markdown')
    return (
      <MarkdownContent
        blocks={vm.blocks}
        className={cn('mt-5 max-w-[72ch]', document.kind === 'prd' && vm.writtenByAgent && 'border-l-[3px] border-primary/30 pl-3')}
      />
    )
  if (!vm.hasOriginal) return <ExtractedText vm={vm} />
  return (
    <Tabs value={vm.view} onValueChange={(value) => vm.onView(String(value))} className="mt-5">
      <TabsList aria-label={t(PLANNING_TEXT.document.viewLabel)}>
        <TabsTrigger value="original" data-testid="projects-document-view-original">
          {t(PLANNING_TEXT.document.viewOriginal)}
        </TabsTrigger>
        <TabsTrigger value="text" data-testid="projects-document-view-text">
          {t(PLANNING_TEXT.document.viewText)}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="original">
        <PdfFrame vm={vm} />
      </TabsContent>
      <TabsContent value="text">
        <ExtractedText vm={vm} />
      </TabsContent>
    </Tabs>
  )
}

function PdfFrame({ vm }: { vm: Detail }) {
  const { t } = useTranslation('planning')
  if (vm.pdf.status === 'loading')
    return <Skeleton className="mt-2 h-[75vh] w-full rounded-lg" data-testid="projects-document-pdf-loading" />
  if (vm.pdf.status === 'error' || !vm.pdf.url)
    return (
      <Notice tone="warning" testId="projects-document-pdf-failed">
        <span className="text-sm">{t(PLANNING_TEXT.document.pdfFailed)}</span>
        {vm.canDownload && (
          <Button size="sm" variant="outline" data-testid="projects-document-pdf-download" onClick={vm.onDownload}>
            <Download data-icon="inline-start" />
            {t(PLANNING_TEXT.document.download)}
          </Button>
        )}
      </Notice>
    )
  // The browser's own PDF viewer gives search, zoom, and print without a PDF library.
  return (
    <iframe
      src={vm.pdf.url}
      title={t(PLANNING_TEXT.document.pdfPreview, { name: vm.document?.fileName ?? '' })}
      data-testid="projects-document-pdf"
      className="mt-2 h-[75vh] w-full rounded-lg border border-border bg-muted"
    />
  )
}

function ExtractedText({ vm }: { vm: Detail }) {
  const { t } = useTranslation('planning')
  return (
    <div className="mt-5 grid gap-3">
      {vm.document?.kind === 'brd' && <p className="text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.document.extractedHint)}</p>}
      <div className="max-w-[72ch] text-sm leading-relaxed whitespace-pre-wrap break-words" data-testid="projects-document-text">
        {vm.content}
      </div>
    </div>
  )
}

function BrdNotice({ vm }: { vm: Detail }) {
  const { t } = useTranslation('planning')
  return (
    <Notice tone="review" testId="projects-document-brd-notice">
      <div className="flex items-start gap-3">
        {vm.writtenByAgent && <AgentAvatar />}
        <div>
          <p className="font-semibold">{t(PLANNING_TEXT.document.brdDraftTitle)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t(PLANNING_TEXT.document.brdDraftDetail)}</p>
        </div>
      </div>
      {vm.canApprove && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="approve"
            data-testid="projects-document-confirm-brd"
            disabled={vm.isBusy}
            onClick={() => vm.onAction('approved')}
          >
            {t(PLANNING_TEXT.document.confirmBrd)}
          </Button>
        </div>
      )}
    </Notice>
  )
}

function PrdNotice({ vm }: { vm: Detail }) {
  const { t } = useTranslation('planning')
  const document = vm.document
  if (!document) return null
  if (document.status === 'approved')
    return (
      <Notice tone="done" testId="projects-document-notice">
        <div>
          <p className="font-semibold">{t(PLANNING_TEXT.document.approvedTitle)}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{t(PLANNING_TEXT.document.approvedDetail)}</p>
        </div>
      </Notice>
    )
  if (document.status === 'superseded') return null
  return (
    <Notice tone="review" testId="projects-document-notice">
      <div className="flex items-start gap-3">
        {vm.writtenByAgent && <AgentAvatar />}
        <div>
          <p className="font-semibold">
            {vm.writtenByAgent ? t(PLANNING_TEXT.document.agentTitle) : t(PLANNING_TEXT.document.reviewTitle)}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {document.sourceOutdated ? t(PLANNING_TEXT.document.outdated) : t(PLANNING_TEXT.document.agentDetail)}
          </p>
        </div>
      </div>
      <DocumentActions vm={vm} />
    </Notice>
  )
}

function DocumentActions({ vm }: { vm: Detail }) {
  const { t } = useTranslation('planning')
  return (
    <div className="flex flex-wrap gap-2">
      {vm.actions.map((action) => (
        <Button
          key={action}
          variant="outline"
          data-testid={`projects-document-action-${action}`}
          disabled={vm.isBusy}
          onClick={() => vm.onAction(action)}
        >
          {action === 'draft' ? t(PLANNING_TEXT.document.sendBack) : t(PLANNING_TEXT.document.move[action])}
        </Button>
      ))}
      {vm.canApprove && (
        <Button variant="approve" data-testid="projects-document-approve" disabled={vm.isBusy} onClick={() => vm.onAction('approved')}>
          {t(PLANNING_TEXT.document.approve)}
        </Button>
      )}
    </div>
  )
}

function ApprovalPanel({ vm }: { vm: Detail }) {
  const { t } = useTranslation('planning')
  const document = vm.document
  if (!document) return null
  return (
    <Panel title={t(PLANNING_TEXT.document.approvals)}>
      <PropertyList>
        <PropertyRow label={t(PLANNING_TEXT.document.approvals)}>
          {vm.approvedOn ? (
            <StatusBadge tone="success">{t(PLANNING_TEXT.document.approvedOn, { date: vm.approvedOn })}</StatusBadge>
          ) : (
            <span className="text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.document.notYet)}</span>
          )}
        </PropertyRow>
      </PropertyList>
      <p className="border-t border-border px-[18px] py-3 text-[12.5px] text-muted-foreground">{t(PLANNING_TEXT.document.approvalHint)}</p>
    </Panel>
  )
}
