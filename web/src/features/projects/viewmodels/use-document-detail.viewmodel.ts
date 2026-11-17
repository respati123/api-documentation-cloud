import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { DocumentStatus, PlanningDocumentSummary, PlanningEvent } from '@/features/projects/models/planning.model'
import { planningService } from '@/features/projects/services/planning.service'
import { canApproveDocument, documentFormat, documentRemoval, headingsOf, tidyDocumentBlocks } from '@/features/projects/utils/planning'
import { planningKeys } from '@/features/projects/viewmodels/planning-keys'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatDate, formatRelativeDate } from '@/shared/utils/format'
import { parseMarkdown } from '@/shared/utils/markdown'

export type DocumentAction = 'review_pm' | 'review_team' | 'superseded' | 'draft'
export type DocumentView = 'original' | 'text'

// An object URL for a blob, released when the blob changes or the component unmounts.
function useObjectUrl(blob: Blob | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
      setUrl(null)
    }
  }, [blob])
  return url
}

// The actions a person can take on a PRD in its current status. Approval is separate because tech leads may approve.
function documentActions(status: DocumentStatus, canManage: boolean): DocumentAction[] {
  if (!canManage) return []
  if (status === 'draft') return ['review_pm']
  if (status === 'review_pm') return ['draft', 'review_team']
  if (status === 'review_team') return ['draft']
  if (status === 'approved') return ['superseded']
  return []
}

export function useDocumentDetailViewModel(
  workspaceId: string,
  documentId: string | null,
  documents: PlanningDocumentSummary[],
  events: PlanningEvent[],
  access: { canManage: boolean; canApprove: boolean },
  onDeleted: () => void,
) {
  const { t, i18n } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const [viewingVersion, setViewingVersion] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [view, setView] = useState<DocumentView>('original')

  const documentQuery = useQuery({
    queryKey: planningKeys.document(workspaceId, documentId ?? ''),
    queryFn: () => planningService.document(token, workspaceId, documentId ?? ''),
    enabled: documentId !== null,
  })
  const versionQuery = useQuery({
    queryKey: planningKeys.version(workspaceId, documentId ?? '', viewingVersion ?? 0),
    queryFn: () => planningService.documentVersion(token, workspaceId, documentId ?? '', viewingVersion ?? 0),
    enabled: documentId !== null && viewingVersion !== null,
  })

  const document = documentQuery.data ?? null
  const format = documentFormat(viewingVersion !== null ? versionQuery.data?.mimeType : document?.mimeType)
  // Only the current version's file can be fetched, so an older PDF version shows its extracted text.
  const hasOriginal = format === 'pdf' && viewingVersion === null && Boolean(document?.fileName)
  const fileQuery = useQuery({
    queryKey: planningKeys.file(workspaceId, documentId ?? '', document?.currentVersion ?? 0),
    queryFn: async () => new Blob([await planningService.download(token, workspaceId, documentId ?? '')], { type: 'application/pdf' }),
    enabled: hasOriginal && view === 'original',
    staleTime: Number.POSITIVE_INFINITY,
  })
  const pdfUrl = useObjectUrl(hasOriginal ? fileQuery.data : undefined)

  const refresh = () => queryClient.invalidateQueries({ queryKey: planningKeys.all(workspaceId) })
  const setStatus = useMutation({
    mutationFn: (status: DocumentStatus) => planningService.documentStatus(token, workspaceId, documentId ?? '', status),
    onSuccess: refresh,
  })
  const revise = useMutation({
    mutationFn: (expectedVersion: number) => planningService.reviseDocument(token, workspaceId, documentId ?? '', draft, expectedVersion),
    onSuccess: async () => {
      setEditing(false)
      await refresh()
    },
  })
  const remove = useMutation({
    mutationFn: () => planningService.deleteDocument(token, workspaceId, documentId ?? ''),
    onSuccess: async () => {
      onDeleted()
      await refresh()
    },
  })
  const download = useMutation({
    mutationFn: async () => {
      const blob = await planningService.download(token, workspaceId, documentId ?? '')
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = documentQuery.data?.fileName ?? 'document'
      link.click()
      URL.revokeObjectURL(url)
    },
  })

  const content = viewingVersion !== null ? (versionQuery.data?.content ?? '') : (document?.content ?? '')
  const source = document?.sourceDocumentId ? documents.find((row) => row.id === document.sourceDocumentId) : undefined
  const createdEvent = events.find(
    (event) => event.targetKind === 'document' && event.targetId === documentId && event.action === 'created',
  )
  const failure = setStatus.error ?? revise.error ?? remove.error ?? download.error ?? documentQuery.error
  const live = (row: { status: string }) => row.status !== 'superseded' && row.status !== 'discarded'
  const derived = documents.filter((row) => row.sourceDocumentId === documentId)
  const removal = document ? documentRemoval(document, access, derived.length) : { canDiscard: false, canDelete: false }

  return {
    status:
      documentId === null
        ? ('closed' as const)
        : documentQuery.isPending
          ? ('loading' as const)
          : document
            ? ('ready' as const)
            : ('error' as const),
    document,
    format,
    content,
    blocks:
      format === 'markdown'
        ? tidyDocumentBlocks(parseMarkdown(content), {
            id: t(PLANNING_TEXT.document.table.id),
            requirement: t(PLANNING_TEXT.document.table.requirement),
            priority: t(PLANNING_TEXT.document.table.priority),
            reference: t(PLANNING_TEXT.document.table.reference),
          })
        : [],
    headings: format === 'markdown' ? headingsOf(content) : [],
    hasOriginal,
    view: hasOriginal ? view : ('text' as const),
    onView: (next: string) => setView(next === 'text' ? 'text' : 'original'),
    pdf: {
      url: pdfUrl,
      status: fileQuery.isError ? ('error' as const) : pdfUrl ? ('ready' as const) : ('loading' as const),
    },
    viewingVersion,
    versions: (document?.versions ?? []).map((version) => ({
      version: version.version,
      when: formatRelativeDate(version.createdAt, i18n.language) ?? '',
      isCurrent: version.version === document?.currentVersion,
      isViewing: viewingVersion === null ? version.version === document?.currentVersion : version.version === viewingVersion,
    })),
    onViewVersion: (version: number) => {
      setEditing(false)
      setViewingVersion(version === document?.currentVersion ? null : version)
    },
    source: source ? { id: source.id, title: source.title, version: document?.sourceVersion ?? source.currentVersion } : null,
    derived: derived.filter(live),
    writtenByAgent: Boolean(createdEvent?.apiKeyId),
    approvedOn: document?.approvedAt ? (formatDate(document.approvedAt, i18n.language) ?? '') : null,
    isPrd: document?.kind === 'prd',
    isBrdDraft: document?.kind === 'brd' && document.status === 'draft',
    actions: document ? documentActions(document.status, access.canManage) : [],
    canApprove: document !== null && access.canApprove && canApproveDocument(document),
    onAction: (status: DocumentAction | 'approved') => setStatus.mutate(status),
    isDiscarded: document?.status === 'discarded',
    canDiscard: removal.canDiscard && viewingVersion === null,
    onDiscard: () => setStatus.mutate('discarded'),
    canDelete: removal.canDelete && viewingVersion === null,
    onDelete: () => remove.mutate(),
    isBusy: setStatus.isPending || revise.isPending || remove.isPending,
    canEdit: access.canManage && viewingVersion === null && document !== null && live(document),
    editing,
    draft,
    setDraft,
    onEdit: () => {
      setDraft(document?.content ?? '')
      setEditing(true)
    },
    onCancelEdit: () => setEditing(false),
    canSave: editing && draft.trim() !== '' && draft !== document?.content && !revise.isPending,
    onSave: () => document && revise.mutate(document.currentVersion),
    canDownload: Boolean(document?.fileName) && viewingVersion === null,
    onDownload: () => download.mutate(),
    error: failure ? readErrorMessage(failure, t(PLANNING_TEXT.error)) : null,
    reset: () => {
      setViewingVersion(null)
      setEditing(false)
      setView('original')
    },
  }
}
