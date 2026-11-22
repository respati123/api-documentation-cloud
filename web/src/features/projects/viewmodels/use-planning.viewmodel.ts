import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod/mini'
import { useAuthSessionStore } from '@/features/auth'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import { planningChangedSchema } from '@/features/projects/models/planning.model'
import type { ProjectMember, Task } from '@/features/projects/models/project.model'
import { resetDemoState } from '@/features/projects/services/mock/planning-mock-api'
import { planningService } from '@/features/projects/services/planning.service'
import { usePlanningDemoStore, useSampleMode } from '@/features/projects/stores/planning-demo.store'
import { buildEpicRows } from '@/features/projects/utils/epics'
import { itemCodes, pipelineCounts, type WaitingEntry, waitingQueue } from '@/features/projects/utils/planning'
import { planningKeys } from '@/features/projects/viewmodels/planning-keys'
import { useDocumentDetailViewModel } from '@/features/projects/viewmodels/use-document-detail.viewmodel'
import { useEpicsListViewModel } from '@/features/projects/viewmodels/use-epics-list.viewmodel'
import { useItemDetailViewModel } from '@/features/projects/viewmodels/use-item-detail.viewmodel'
import { type CommentTarget, usePlanningCommentsViewModel } from '@/features/projects/viewmodels/use-planning-comments.viewmodel'
import { usePlanningDialogsViewModel } from '@/features/projects/viewmodels/use-planning-dialogs.viewmodel'
import { useStoryExtrasViewModel } from '@/features/projects/viewmodels/use-story-extras.viewmodel'
import { AGILE_PROJECT_ENABLED, ARTIFACT_STANDARD_ENABLED } from '@/shared/config/features'
import { useRealtimeEvent } from '@/shared/realtime/use-realtime-event'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatRelativeDate } from '@/shared/utils/format'

export const PROJECT_SECTIONS = ['flow', 'documents', 'epics', 'backlog', 'board', 'timeline', 'reports'] as const
export type ProjectSection = (typeof PROJECT_SECTIONS)[number]
type Detail = { kind: 'document'; id: string } | { kind: 'item'; id: string } | null

// The order roles are listed in on the flow screen, the same order as the Team tab picker.
const TEAM_ORDER = ['pm', 'tech_lead', 'ui_ux', 'backend', 'frontend', 'mobile', 'qa', 'devops', 'other']

export function usePlanningViewModel(workspaceId: string, members: ProjectMember[], boardTasks: Task[], enabled: boolean) {
  const { t, i18n } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const [section, setSection] = useState<ProjectSection>('flow')
  const [detail, setDetail] = useState<Detail>(null)
  const queryClient = useQueryClient()
  const sample = useSampleMode(workspaceId)
  const userId = useAuthSessionStore((state) => state.userId)
  // Someone else changed this project, from the portal or through an agent: reload the part they touched.
  // Our own writes already refresh through their mutations.
  useRealtimeEvent((raw) => {
    const result = z.safeParse(planningChangedSchema, raw)
    if (!result.success || result.data.workspaceId !== workspaceId || result.data.actorId === userId || sample) return
    if (result.data.scope === 'tasks' || result.data.scope === 'members')
      void queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] })
    void queryClient.invalidateQueries({ queryKey: planningKeys.all(workspaceId) })
  })
  const setDemo = usePlanningDemoStore((state) => state.setDemo)
  const ready = signedIn && enabled && Boolean(workspaceId)

  const documentsQuery = useQuery({
    queryKey: planningKeys.documents(workspaceId),
    queryFn: () => planningService.documents(token, workspaceId),
    enabled: ready,
  })
  const itemsQuery = useQuery({
    queryKey: planningKeys.items(workspaceId),
    queryFn: () => planningService.items(token, workspaceId),
    enabled: ready,
  })
  const canManage = documentsQuery.data?.canManage ?? false
  const canApprove = documentsQuery.data?.canApprove ?? canManage
  const access = { canManage, canApprove }
  // Only the PM, the tech lead, and backend read BRDs and PRDs. Other roles do not see the Documents section.
  const canReadDocuments = documentsQuery.data?.canReadDocuments ?? canManage
  // Only a PM may read the planning activity log, so others never ask for it.
  const eventsQuery = useQuery({
    queryKey: planningKeys.events(workspaceId),
    queryFn: () => planningService.events(token, workspaceId),
    enabled: ready && canManage,
  })

  const documents = documentsQuery.data?.documents ?? []
  const items = itemsQuery.data?.items ?? []
  const tasks = itemsQuery.data?.tasks ?? []
  const events = eventsQuery.data ?? []
  const activityFor = (targetId: string | undefined) =>
    events
      .filter((event) => event.targetId === targetId)
      .slice(0, 12)
      .map((event) => ({
        id: event.id,
        actor: members.find((member) => member.id === event.actorId)?.email ?? '',
        action: event.action.startsWith('status:') ? 'status' : event.action,
        viaAgent: event.apiKeyId !== null,
        keyName: event.apiKeyName,
        when: formatRelativeDate(event.createdAt, i18n.language) ?? '',
      }))
  const codes = itemCodes(items)
  const epics = items.filter((item) => item.kind === 'epic')
  const sourceTitle = (id: string | null) => documents.find((document) => document.id === id)?.title ?? null
  const epicsList = useEpicsListViewModel(buildEpicRows({ items, tasks, members, codes, sourceTitle }))

  const documentDetail = useDocumentDetailViewModel(
    workspaceId,
    detail?.kind === 'document' ? detail.id : null,
    documents,
    events,
    access,
    () => {
      setDetail(null)
      setSection('documents')
    },
  )
  const itemDetail = useItemDetailViewModel(
    workspaceId,
    detail?.kind === 'item' ? detail.id : null,
    { items, tasks, documents, members, codes },
    access,
  )
  const commentTarget: CommentTarget | null =
    detail?.kind === 'document'
      ? { kind: 'document', id: detail.id }
      : itemDetail.item
        ? { kind: itemDetail.item.kind, id: itemDetail.item.id }
        : null
  const storyItem = itemDetail.item?.kind === 'story' ? { id: itemDetail.item.id, status: itemDetail.item.status } : null
  const storyExtras = useStoryExtrasViewModel(workspaceId, storyItem, boardTasks, true, canApprove)
  const comments = usePlanningCommentsViewModel(workspaceId, commentTarget, canManage, members)
  const dialogs = usePlanningDialogsViewModel(workspaceId, documents, epics, members, () => setSection('documents'))

  const go = (next: ProjectSection) => {
    setSection(next === 'documents' && !canReadDocuments ? 'flow' : next)
    setDetail(null)
    documentDetail.reset()
    itemDetail.reset()
  }
  const openDocument = (id: string) => {
    documentDetail.reset()
    setSection('documents')
    setDetail({ kind: 'document', id })
  }
  const openItem = (id: string) => {
    itemDetail.reset()
    setSection('epics')
    setDetail({ kind: 'item', id })
  }
  const describeWaiting = (entry: WaitingEntry) => {
    const item = entry.target.kind === 'item' ? items.find((row) => row.id === entry.target.id) : undefined
    const document = entry.target.kind === 'document' ? documents.find((row) => row.id === entry.target.id) : undefined
    return {
      key: `${entry.reason}-${entry.target.id}`,
      reason: entry.reason,
      title: entry.title,
      code: item ? codes[item.id] : document ? document.kind : '',
      kind: item ? item.kind : (document?.kind ?? 'prd'),
      byAgent: events.some((event) => event.targetId === entry.target.id && event.apiKeyId !== null && /created/.test(event.action)),
      onOpen: () => (entry.target.kind === 'document' ? openDocument(entry.target.id) : openItem(entry.target.id)),
    }
  }

  const failure = documentsQuery.error ?? itemsQuery.error

  return {
    sample: {
      on: sample,
      // Switching data sources drops the cached project data, so every screen reloads from the new source.
      onToggle: () => {
        if (!sample) resetDemoState()
        setDemo(workspaceId, !sample)
        queryClient.removeQueries({ queryKey: ['planning', workspaceId] })
        queryClient.removeQueries({ queryKey: ['projects', workspaceId] })
        go('flow')
      },
    },
    codes,
    storyExtras,
    section,
    sections: PROJECT_SECTIONS.filter(
      (id) =>
        (id !== 'documents' || canReadDocuments) &&
        ((id !== 'backlog' && id !== 'reports') || AGILE_PROJECT_ENABLED) &&
        (id !== 'epics' || !AGILE_PROJECT_ENABLED || ARTIFACT_STANDARD_ENABLED) &&
        (id !== 'timeline' || (AGILE_PROJECT_ENABLED && ARTIFACT_STANDARD_ENABLED)),
    ).map((id) => ({
      id,
      count: id === 'documents' ? documents.length : id === 'epics' && !AGILE_PROJECT_ENABLED ? epics.length : null,
    })),
    go,
    detail: detail?.kind ?? null,
    access,
    status: documentsQuery.isPending || itemsQuery.isPending ? ('loading' as const) : failure ? ('error' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, t(PLANNING_TEXT.error)) : null,
    flow: {
      counts: pipelineCounts(documents, items, tasks),
      waiting: waitingQueue(documents, items, access).map(describeWaiting),
      team: members
        .filter((member) => member.discipline)
        .sort((a, b) => TEAM_ORDER.indexOf(a.discipline ?? '') - TEAM_ORDER.indexOf(b.discipline ?? ''))
        .map((member) => ({ id: member.id, email: member.email, discipline: member.discipline ?? 'other' })),
    },
    documents: {
      brds: documents.filter((document) => document.kind === 'brd'),
      prds: documents
        .filter((document) => document.kind === 'prd')
        .map((document) => ({ ...document, sourceTitle: sourceTitle(document.sourceDocumentId) })),
      when: (value: string) => formatRelativeDate(value, i18n.language) ?? '',
      open: openDocument,
    },
    epics: {
      ...epicsList,
      canCreate: dialogs.item.canCreateEpic,
      open: openItem,
    },
    documentDetail,
    itemDetail,
    comments,
    dialogs,
    activity: activityFor(detail?.id),
    activityFor,
    openDocument,
    openItem,
  }
}
