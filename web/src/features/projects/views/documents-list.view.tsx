import { FileUp, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { PlanningDocumentSummary } from '@/features/projects/models/planning.model'
import type { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { DOCUMENT_TONE, StatusBadge, StatusIcon } from '@/features/projects/views/planning-marks.view'
import { Button } from '@/shared/components/primitives/button'
import { EmptyState } from '@/shared/components/state-views'

type Documents = ReturnType<typeof usePlanningViewModel>['documents']

export function DocumentsListView({
  documents,
  canManage,
  onUpload,
  onWrite,
  onWritePrd,
  canWritePrd,
}: {
  documents: Documents
  canManage: boolean
  onUpload: () => void
  onWrite: () => void
  onWritePrd: () => void
  canWritePrd: boolean
}) {
  const { t } = useTranslation('planning')
  const empty = documents.brds.length === 0 && documents.prds.length === 0

  return (
    <div className="grid gap-3.5" data-testid="projects-documents">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-heading text-lg font-semibold tracking-tight">{t(PLANNING_TEXT.documents.title)}</h2>
        {canManage && (
          <>
            <Button variant="outline" data-testid="projects-documents-upload" onClick={onUpload}>
              <FileUp data-icon="inline-start" />
              {t(PLANNING_TEXT.documents.upload)}
            </Button>
            <Button variant="outline" data-testid="projects-documents-write-prd" disabled={!canWritePrd} onClick={onWritePrd}>
              <Plus data-icon="inline-start" />
              {t(PLANNING_TEXT.documents.newPrd)}
            </Button>
            <Button data-testid="projects-documents-write" onClick={onWrite}>
              <Plus data-icon="inline-start" />
              {t(PLANNING_TEXT.documents.newBrd)}
            </Button>
          </>
        )}
      </div>

      {empty ? (
        <EmptyState
          title={t(PLANNING_TEXT.documents.empty)}
          detail={canManage ? t(PLANNING_TEXT.documents.emptyDetail) : t(PLANNING_TEXT.documents.emptyReader)}
          testId="projects-documents-empty"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <DocumentGroup label={t(PLANNING_TEXT.kind.brd)} rows={documents.brds} documents={documents} />
          <DocumentGroup label={t(PLANNING_TEXT.kind.prd)} rows={documents.prds} documents={documents} />
        </div>
      )}
    </div>
  )
}

function DocumentGroup({
  label,
  rows,
  documents,
}: {
  label: string
  rows: Array<PlanningDocumentSummary & { sourceTitle?: string | null }>
  documents: Documents
}) {
  const { t } = useTranslation('planning')
  if (rows.length === 0) return null
  return (
    <>
      <div className="flex items-center gap-2 border-b border-border bg-muted px-[18px] py-2 text-[12.5px] font-semibold">
        {label}
        <span className="font-normal text-muted-foreground">{rows.length}</span>
      </div>
      <ul className="divide-y divide-border border-b border-border last:border-b-0">
        {rows.map((row) => (
          <li key={row.id}>
            <Button
              variant="ghost"
              data-testid={`projects-document-${row.id}`}
              className="grid h-auto w-full grid-cols-[16px_minmax(0,1fr)] items-center gap-3 rounded-none px-[18px] py-2.5 text-left whitespace-normal hover:bg-muted/40 sm:grid-cols-[16px_minmax(0,1fr)_auto]"
              onClick={() => documents.open(row.id)}
            >
              <StatusIcon tone={DOCUMENT_TONE[row.status].icon} label={t(PLANNING_TEXT.status.document[row.status])} />
              <span className="truncate font-medium">{row.title}</span>
              <span className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:justify-end">
                <StatusBadge tone={DOCUMENT_TONE[row.status].badge}>{t(PLANNING_TEXT.status.document[row.status])}</StatusBadge>
                {row.sourceOutdated && <StatusBadge tone="warning">{t(PLANNING_TEXT.documents.sourceChanged)}</StatusBadge>}
                <span className="text-xs font-normal text-muted-foreground">
                  {t(PLANNING_TEXT.documents.version, { version: row.currentVersion })}
                  {row.sourceTitle ? ` · ${t(PLANNING_TEXT.documents.fromSource, { title: row.sourceTitle })}` : ''}
                  {' · '}
                  {documents.when(row.updatedAt)}
                </span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </>
  )
}
