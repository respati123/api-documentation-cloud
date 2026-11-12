import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { DocumentStatus, PlanningDocumentSummary, PlanningEvent } from '@/features/projects/models/planning.model'
import { planningService } from '@/features/projects/services/planning.service'
import { documentBlocks, headingsOf } from '@/features/projects/utils/planning'
import { planningKeys } from '@/features/projects/viewmodels/planning-keys'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatDate, formatRelativeDate } from '@/shared/utils/format'

export type DocumentAction = 'review_pm' | 'review_team' | 'superseded' | 'draft'

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
) {
  const { t, i18n } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const [viewingVersion, setViewingVersion] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

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

  const document = documentQuery.data ?? null
  const content = viewingVersion !== null ? (versionQuery.data?.content ?? '') : (document?.content ?? '')
  const source = document?.sourceDocumentId ? documents.find((row) => row.id === document.sourceDocumentId) : undefined
  const createdEvent = events.find(
    (event) => event.targetKind === 'document' && event.targetId === documentId && event.action === 'created',
  )
  const failure = setStatus.error ?? revise.error ?? download.error ?? documentQuery.error

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
    blocks: documentBlocks(content),
    headings: headingsOf(content),
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
    derived: documents.filter((row) => row.sourceDocumentId === documentId && row.status !== 'superseded'),
    writtenByAgent: Boolean(createdEvent?.apiKeyId),
    approvedOn: document?.approvedAt ? (formatDate(document.approvedAt, i18n.language) ?? '') : null,
    isPrd: document?.kind === 'prd',
    actions: document ? documentActions(document.status, access.canManage) : [],
    canApprove: document?.kind === 'prd' && document.status === 'review_team' && access.canApprove && !document.sourceOutdated,
    onAction: (status: DocumentAction | 'approved') => setStatus.mutate(status),
    isBusy: setStatus.isPending || revise.isPending,
    canEdit: access.canManage && viewingVersion === null && document !== null && document.status !== 'superseded',
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
    },
  }
}
