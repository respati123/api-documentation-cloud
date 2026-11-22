import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { ISSUE_DETAIL_TEXT } from '@/features/projects/constants/backlog-text.constants'
import { EPIC_TEXT } from '@/features/projects/constants/epic-text.constants'
import {
  EPIC_DOCUMENT_OWNER,
  EPIC_DOCUMENT_SECTIONS,
  type EpicDocument,
  type EpicDocumentKind,
  type EpicTicket,
} from '@/features/projects/models/epic.model'
import { displayCode, type Issue } from '@/features/projects/models/issue.model'
import type { ProjectMember } from '@/features/projects/models/project.model'
import { epicService } from '@/features/projects/services/epic.service'
import { issuesService } from '@/features/projects/services/issues.service'
import {
  coverageSummary,
  criteriaFlows,
  dependencyWaves,
  designMatrix,
  documentOf,
  documentState,
  epicStages,
  filterCriteria,
  loadAfter,
  proposeAssignment,
  type StageState,
} from '@/features/projects/utils/epic'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import { usePageList } from '@/shared/hooks/use-page-list'
import { showToast } from '@/shared/toast/toast-manager'
import { readErrorMessage } from '@/shared/utils/error-message'
import { parseMarkdown } from '@/shared/utils/markdown'

type Text = (key: string, options?: Record<string, unknown>) => string

export const EPIC_TABS = ['overview', 'spec', 'design', 'contract', 'tickets', 'assign'] as const
export type EpicTab = (typeof EPIC_TABS)[number]

const epicKeys = {
  documents: (workspaceId: string, projectId: string, epicId: string) =>
    [...issueKeys.issue(workspaceId, projectId, epicId), 'documents'] as const,
  criteria: (workspaceId: string, projectId: string, epicId: string) =>
    [...issueKeys.issue(workspaceId, projectId, epicId), 'criteria'] as const,
  tickets: (workspaceId: string, projectId: string, epicId: string) =>
    [...issueKeys.issue(workspaceId, projectId, epicId), 'tickets'] as const,
}

const rolesOf = (member: ProjectMember | undefined) => member?.disciplines ?? (member?.discipline ? [member.discipline] : [])

// CLOUD-001: the epics of the project, and inside one epic its stepper, spec with acceptance criteria, design with
// the AC × repo map, contract, ticket split in waves, and the assignment proposal the tech lead confirms.
// Writing the documents and tickets happens through the role agents over MCP; people read and approve here.
export function useEpicWorkspaceViewModel(
  workspaceId: string,
  projectId: string | undefined,
  enabled: boolean,
  members: ProjectMember[],
  canManage: boolean,
) {
  const { t } = useTranslation('planning')
  const say = t as Text
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const userId = useAuthSessionStore((state) => state.userId)
  const queryClient = useQueryClient()
  const project = projectId ?? ''
  const active = signedIn && enabled && Boolean(projectId)

  const [epicId, setEpicId] = useState<string | null>(null)
  const [tab, setTab] = useState<EpicTab>('overview')
  const [flow, setFlow] = useState<string | null>(null)
  const [choices, setChoices] = useState<Record<string, string>>({})

  const epics = usePageList<Issue>({
    queryKey: issueKeys.epics(workspaceId, project),
    fetchPage: (cursor) => issuesService.epics(token, workspaceId, project, cursor),
    enabled: active,
  })
  const selected = epicId ? epics.items.find((epic) => epic.id === epicId) : undefined
  const inside = active && epicId !== null
  const id = epicId ?? ''

  const documents = useQuery({
    queryKey: epicKeys.documents(workspaceId, project, id),
    queryFn: () => epicService.documents(token, workspaceId, project, id),
    enabled: inside,
  })
  const criteria = useQuery({
    queryKey: epicKeys.criteria(workspaceId, project, id),
    queryFn: () => epicService.criteria(token, workspaceId, project, id),
    enabled: inside,
  })
  const tickets = useQuery({
    queryKey: epicKeys.tickets(workspaceId, project, id),
    queryFn: () => epicService.tickets(token, workspaceId, project, id),
    enabled: inside,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: issueKeys.issue(workspaceId, project, id) })
  const approve = useMutation({
    mutationFn: (documentId: string) => epicService.approveDocument(token, workspaceId, project, id, documentId),
    onSuccess: refresh,
  })

  const me = members.find((member) => member.id === userId)
  const isPm = canManage || rolesOf(me).includes('pm')
  const isTechLead = canManage || rolesOf(me).includes('tech_lead')
  const mayApprove = (kind: EpicDocumentKind) => (EPIC_DOCUMENT_OWNER[kind] === 'pm' ? isPm : isTechLead)

  const ticketList = tickets.data?.tickets ?? []
  const { waves, looped } = dependencyWaves(ticketList)
  const proposal = proposeAssignment(waves, members, tickets.data?.load ?? [])
  const chosen = proposal.rows.map((row) => ({ ticket: row.ticket, assigneeId: (choices[row.ticket.issue.id] ?? row.proposedId) || null }))

  const assign = useMutation({
    mutationFn: async (rows: Array<{ ticket: EpicTicket; assigneeId: string | null }>) => {
      for (const row of rows) {
        if (row.assigneeId) await issuesService.update(token, workspaceId, project, row.ticket.issue.id, { assigneeId: row.assigneeId })
      }
      return rows.filter((row) => row.assigneeId).length
    },
    onSuccess: async (count) => {
      setChoices({})
      showToast({ kind: 'success', message: say(EPIC_TEXT.assign.confirmed, { count }) })
      await queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, project) })
    },
  })

  const codeOf = (ticketId: string) => {
    const found = ticketList.find((ticket) => ticket.issue.id === ticketId)
    return found ? displayCode(found.issue) : null
  }
  const memberName = (memberId: string) => members.find((member) => member.id === memberId)?.email ?? memberId

  const documentView = (kind: EpicDocumentKind) => {
    const document: EpicDocument | undefined = documentOf(documents.data?.documents ?? [], kind)
    const blocked = documents.data?.blocked[kind] ?? null
    return {
      kind,
      exists: Boolean(document),
      title: document?.title ?? '',
      version: document ? say(EPIC_TEXT.document.version, { version: document.version }) : '',
      state: say(EPIC_TEXT.stageState[documentState(document)]),
      tone: toneOf(documentState(document)),
      stale: document?.stale ?? false,
      missing: say(EPIC_TEXT.document.missing[kind]),
      blocked: !document && blocked ? say(EPIC_TEXT.document.blocked, { needs: blocked }) : null,
      sections: EPIC_DOCUMENT_SECTIONS[kind].map((name) => ({
        id: name,
        label: say(EPIC_TEXT.section[name as keyof typeof EPIC_TEXT.section]),
        blocks: parseMarkdown(document?.sections[name]?.trim() || say(EPIC_TEXT.document.empty)),
      })),
      canApprove: Boolean(document) && document?.status === 'draft' && !document.stale && mayApprove(kind),
      approving: approve.isPending && approve.variables === document?.id,
      onApprove: () => document && approve.mutate(document.id),
    }
  }

  const criteriaList = criteria.data?.criteria ?? []
  const stages = epicStages(documents.data?.documents ?? [], ticketList)
  const failure = epics.error ?? documents.error ?? criteria.error ?? tickets.error
  const actionFailure = approve.error ?? assign.error
  const matrix = designMatrix(criteriaList)

  return {
    status: failure ? ('error' as const) : active && epics.isPending ? ('loading' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, say(EPIC_TEXT.error)) : null,
    actionError: actionFailure ? readErrorMessage(actionFailure, say(EPIC_TEXT.error)) : null,
    onRetry: () => void queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, project) }),
    list: epics.items.map((epic) => ({
      id: epic.id,
      code: displayCode(epic),
      title: epic.title,
      status: epic.status,
      onOpen: () => open(epic.id),
    })),
    more: { hasMore: epics.hasMore, isLoadingMore: epics.isLoadingMore, onLoadMore: epics.loadMore },
    open,
    epic: selected
      ? {
          id: selected.id,
          code: displayCode(selected),
          title: selected.title,
          description: selected.description,
          loading: documents.isPending || criteria.isPending || tickets.isPending,
          onBack: () => setEpicId(null),
          tab,
          tabs: EPIC_TABS.map((value) => ({ value, label: say(EPIC_TEXT.tab[value]) })),
          onTab: (value: string) => EPIC_TABS.includes(value as EpicTab) && setTab(value as EpicTab),
          stages: stages.map((stage) => ({
            id: stage.id,
            label: say(EPIC_TEXT.stage[stage.id]),
            state: stage.state,
            stateLabel:
              stage.id === 'tickets' && stage.total
                ? say(EPIC_TEXT.tickets.summary, { ready: stage.ready, total: stage.total })
                : say(EPIC_TEXT.stageState[stage.state]),
            owner: say(EPIC_TEXT.stageOwner[stage.id]),
            current: stage.current,
            tone: toneOf(stage.state),
            onOpen: () => setTab(stage.id),
          })),
          spec: documentView('spec'),
          design: documentView('design'),
          contract: documentView('contract'),
          criteria: {
            coverage: say(EPIC_TEXT.criteria.coverage, coverageSummary(criteriaList)),
            flow: flow ?? '',
            flows: [
              { value: '', label: say(EPIC_TEXT.criteria.allFlows) },
              ...criteriaFlows(criteriaList).map((name) => ({ value: name, label: name })),
            ],
            onFlow: (value: string) => setFlow(value === '' ? null : value),
            items: filterCriteria(criteriaList, flow).map((criterion) => ({
              id: criterion.id,
              code: criterion.code,
              title: criterion.title,
              flow: criterion.flow,
              given: criterion.given,
              when: criterion.when,
              outcomes: criterion.outcomes,
              struck: criterion.status === 'struck',
              struckReason: criterion.struckReason ? say(EPIC_TEXT.criteria.struckReason, { reason: criterion.struckReason }) : null,
              coverage: [
                { id: 'inDesign', label: say(EPIC_TEXT.criteria.inDesign), on: criterion.coverage.inDesign },
                { id: 'inTask', label: say(EPIC_TEXT.criteria.inTask), on: criterion.coverage.inTask },
                { id: 'hasTestCase', label: say(EPIC_TEXT.criteria.hasTestCase), on: criterion.coverage.hasTestCase },
              ],
            })),
          },
          matrix: {
            repos: matrix.repos,
            rows: matrix.rows.map((row) => ({
              id: row.id,
              code: row.code,
              title: row.title,
              cells: row.cells.map((entries, index) => ({
                id: `${row.id}-${matrix.repos[index]}`,
                text:
                  entries.length === 0
                    ? say(EPIC_TEXT.matrix.none)
                    : entries.map((entry) => `${entry.component} · ${entry.testLevel}`).join('\n'),
                empty: entries.length === 0,
              })),
            })),
          },
          tickets: {
            total: ticketList.length,
            waves: waves.map((wave, index) => ({
              id: `wave-${index + 1}`,
              label: say(EPIC_TEXT.tickets.wave, { number: index + 1 }),
              items: wave.map(ticketView),
            })),
            looped: looped.map(ticketView),
          },
          assign: {
            rows: proposal.rows.map((row) => ({
              id: row.ticket.issue.id,
              code: displayCode(row.ticket.issue),
              title: row.ticket.issue.title,
              points: row.ticket.issue.points ?? 0,
              value: (choices[row.ticket.issue.id] ?? row.proposedId) || '',
              options:
                row.candidates.length === 0
                  ? [{ value: '', label: say(EPIC_TEXT.assign.nobody) }]
                  : [
                      ...row.candidates.map((member) => ({ value: member.id, label: member.email })),
                      { value: '', label: say(EPIC_TEXT.assign.none) },
                    ],
              disabled: row.candidates.length === 0,
              onChange: (value: string) => setChoices((current) => ({ ...current, [row.ticket.issue.id]: value })),
            })),
            load: loadAfter(members, proposal.before, chosen).map((row) => ({
              id: row.member.id,
              name: row.member.email,
              before: row.before,
              after: row.after,
            })),
            canConfirm: isTechLead && chosen.some((row) => row.assigneeId),
            onlyLead: !isTechLead,
            confirming: assign.isPending,
            onConfirm: () => assign.mutate(chosen),
          },
        }
      : null,
  }

  function open(next: string) {
    setEpicId(next)
    setTab('overview')
    setFlow(null)
    setChoices({})
  }

  function ticketView(ticket: EpicTicket) {
    const codes = ticket.dependsOn.map(codeOf).filter((code): code is string => code !== null)
    return {
      id: ticket.issue.id,
      code: displayCode(ticket.issue),
      title: ticket.issue.title,
      role: ticket.issue.role,
      size: ticket.issue.size ?? null,
      ready: ticket.readiness.ready,
      readyLabel: say(ticket.readiness.ready ? EPIC_TEXT.tickets.ready : EPIC_TEXT.tickets.notReady),
      failing: ticket.readiness.failing.map((miss) => ({
        id: `${ticket.issue.id}-${miss.item}`,
        label: say(ISSUE_DETAIL_TEXT.readinessItem, { item: miss.item, reason: miss.reason }),
      })),
      dependsOn: codes.length > 0 ? say(EPIC_TEXT.tickets.dependsOn, { codes: codes.join(', ') }) : null,
      assignee: ticket.issue.assigneeId ? memberName(ticket.issue.assigneeId) : say(EPIC_TEXT.tickets.unassigned),
    }
  }
}

function toneOf(state: StageState): 'success' | 'accent' | 'warning' | 'secondary' {
  return state === 'approved' ? 'success' : state === 'review' ? 'accent' : state === 'stale' ? 'warning' : 'secondary'
}
