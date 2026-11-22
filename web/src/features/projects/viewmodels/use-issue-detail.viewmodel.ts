import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { BACKLOG_TEXT, ISSUE_DETAIL_TEXT, statusTextKey } from '@/features/projects/constants/backlog-text.constants'
import { displayCode, type Issue, POINT_VALUES, STORY_STATUSES, WORK_STATUSES } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { isSampleWorkspace } from '@/features/projects/services/workspace-transport'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import type { BacklogAccess } from '@/features/projects/viewmodels/use-backlog-actions.viewmodel'
import { ARTIFACT_STANDARD_ENABLED } from '@/shared/config/features'
import { usePageList } from '@/shared/hooks/use-page-list'
import { readErrorMessage } from '@/shared/utils/error-message'

type Text = (key: string, options?: Record<string, unknown>) => string

// The detail of one issue, in a sheet opened from the backlog or the board. `ref` is an id or a key such as PARI-12.
export function useIssueDetailViewModel(workspaceId: string, projectId: string | undefined, access: BacklogAccess) {
  const { t } = useTranslation('planning')
  const say = t as Text
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const queryClient = useQueryClient()
  const [ref, setRef] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const project = projectId ?? ''
  const active = signedIn && Boolean(projectId) && ref !== null
  const target = ref ?? ''

  const issue = useQuery({
    queryKey: issueKeys.issue(workspaceId, project, target),
    queryFn: () => issuesService.issue(token, workspaceId, project, target),
    enabled: active,
  })
  const current = issue.data
  const id = current?.id ?? ''
  const parent = useQuery({
    queryKey: issueKeys.issue(workspaceId, project, current?.parentId ?? ''),
    queryFn: () => issuesService.issue(token, workspaceId, project, current?.parentId ?? ''),
    enabled: active && Boolean(current?.parentId),
  })
  const children = usePageList<Issue>({
    queryKey: issueKeys.children(workspaceId, project, id),
    fetchPage: (cursor) => issuesService.children(token, workspaceId, project, id, cursor),
    enabled: active && Boolean(current) && current?.type !== 'subtask',
  })
  const checklist = useQuery({
    queryKey: issueKeys.checklist(workspaceId, project, id),
    queryFn: () => issuesService.checklist(token, workspaceId, project, id),
    enabled: active && Boolean(current),
  })
  const links = useQuery({
    queryKey: issueKeys.links(workspaceId, project, id),
    queryFn: () => issuesService.links(token, workspaceId, project, id),
    enabled: active && Boolean(current),
  })
  // CLOUD-001: a task shows its ticket fields, readiness and the criteria it delivers. The sample workspace has none.
  const showTicket = ARTIFACT_STANDARD_ENABLED && active && current?.type === 'task' && !isSampleWorkspace(workspaceId)
  const ticket = useQuery({
    queryKey: issueKeys.ticket(workspaceId, project, id),
    queryFn: () => issuesService.ticket(token, workspaceId, project, id),
    enabled: showTicket,
  })
  const delivered = useQuery({
    queryKey: issueKeys.delivered(workspaceId, project, id),
    queryFn: () => issuesService.delivered(token, workspaceId, project, id),
    enabled: showTicket,
  })
  // Only an issue with an outdated source needs to know whether its sprint is running.
  const sprints = useQuery({
    queryKey: issueKeys.sprints(workspaceId, project),
    queryFn: () => issuesService.sprints(token, workspaceId, project),
    enabled: active && current?.sourceOutdated === true && Boolean(current.sprintId),
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, project) })
  const act = useMutation({
    mutationFn: (job: () => Promise<unknown>) => job(),
    onMutate: () => setActionError(null),
    onSuccess: refresh,
    onError: (error) => setActionError(readErrorMessage(error, say(ISSUE_DETAIL_TEXT.error))),
  })

  const items = checklist.data ?? []
  const failure = issue.error ?? checklist.error ?? links.error ?? children.error
  const inRunningSprint = (sprints.data ?? []).some((sprint) => sprint.id === current?.sprintId && sprint.status === 'active')
  const isEpic = current?.type === 'epic'
  const canSetPoints = access.canEdit && (current?.type === 'story' || current?.type === 'task' || current?.type === 'bug')

  return {
    open: (value: string) => {
      setNewItem('')
      setActionError(null)
      setRef(value)
    },
    close: () => setRef(null),
    isOpen: ref !== null,
    status: failure ? ('error' as const) : issue.isPending || !current ? ('loading' as const) : ('ready' as const),
    error: failure ? readErrorMessage(failure, say(ISSUE_DETAIL_TEXT.error)) : null,
    onRetry: () => void refresh(),
    actionError,
    issue: current
      ? {
          id: current.id,
          key: ARTIFACT_STANDARD_ENABLED ? displayCode(current) : current.key,
          title: current.title,
          typeLabel: say(BACKLOG_TEXT.type[current.type]),
          description: current.description,
          acceptance: current.acceptanceCriteria,
          statusValue: current.status ?? '',
          statusLabel: current.status ? say(statusTextKey(current.status)) : say(ISSUE_DETAIL_TEXT.statusComputed),
          statusOptions: (current.type === 'story' ? STORY_STATUSES : WORK_STATUSES).map((value) => ({
            value,
            label: say(statusTextKey(value)),
          })),
          canSetStatus: access.canEdit && !isEpic,
          setStatus: (value: string) => act.mutate(() => issuesService.update(token, workspaceId, project, current.id, { status: value })),
          pointsValue: current.points === null ? '' : String(current.points),
          pointsLabel: current.points === null ? say(BACKLOG_TEXT.noPoints) : say(BACKLOG_TEXT.points, { count: current.points }),
          pointsOptions: [
            { value: '', label: say(BACKLOG_TEXT.noPoints) },
            ...POINT_VALUES.map((value) => ({ value: String(value), label: String(value) })),
          ],
          showPoints: current.type !== 'epic' && current.type !== 'subtask',
          canSetPoints,
          setPoints: (value: string) =>
            act.mutate(() =>
              issuesService.update(token, workspaceId, project, current.id, { points: value === '' ? null : Number(value) }),
            ),
          priorityLabel: say(BACKLOG_TEXT.priority[current.priority]),
          assignee: current.assigneeEmail?.split('@')[0] ?? say(BACKLOG_TEXT.unassigned),
          parent: parent.data
            ? { key: ARTIFACT_STANDARD_ENABLED ? displayCode(parent.data) : parent.data.key, title: parent.data.title }
            : null,
          sprintLabel: current.sprintId ? say(ISSUE_DETAIL_TEXT.inSprint) : say(ISSUE_DETAIL_TEXT.notInSprint),
          outdated: current.sourceOutdated ? (inRunningSprint ? ('sprint' as const) : ('plain' as const)) : null,
          canReview: access.canManage,
          markReviewed: () => act.mutate(() => issuesService.markSourceReviewed(token, workspaceId, project, current.id)),
        }
      : null,
    // The story whose Definition of Done, designs, contracts, and test cases the sheet shows.
    storyRef: current?.type === 'story' ? { id: current.id, status: current.status ?? 'draft' } : null,
    childrenHeading: say(current?.type === 'epic' ? ISSUE_DETAIL_TEXT.items : ISSUE_DETAIL_TEXT.subtasks),
    showChildren: current !== undefined && current.type !== 'subtask',
    children: {
      rows: children.items.map((child) => ({
        id: child.id,
        key: ARTIFACT_STANDARD_ENABLED ? displayCode(child) : child.key,
        title: child.title,
        typeLabel: say(BACKLOG_TEXT.type[child.type]),
        statusLabel: child.status ? say(statusTextKey(child.status)) : '',
        assignee: child.assigneeEmail?.split('@')[0] ?? say(BACKLOG_TEXT.unassigned),
      })),
      hasMore: children.hasMore,
      isLoadingMore: children.isLoadingMore,
      onLoadMore: children.loadMore,
    },
    checklist: {
      items: items.map((item) => ({ id: item.id, title: item.title, done: item.done })),
      progress: say(ISSUE_DETAIL_TEXT.checklistDone, { done: items.filter((item) => item.done).length, total: items.length }),
      canEdit: access.canEdit,
      newItem,
      setNewItem,
      canAdd: access.canEdit && newItem.trim() !== '' && !act.isPending,
      add: () => {
        const title = newItem.trim()
        if (title === '') return
        setNewItem('')
        act.mutate(() => issuesService.addChecklistItem(token, workspaceId, project, id, title))
      },
      toggle: (itemId: string, done: boolean) =>
        act.mutate(() => issuesService.setChecklistItemDone(token, workspaceId, project, id, itemId, done)),
      remove: (itemId: string) => act.mutate(() => issuesService.deleteChecklistItem(token, workspaceId, project, id, itemId)),
    },
    ticket:
      showTicket && ticket.data
        ? {
            code: displayCode(ticket.data.issue),
            fields: (['repo', 'goal', 'scope', 'outOfScope', 'designNotes', 'codeFollow', 'codeTouch', 'openQuestions'] as const)
              .filter((name) => name !== 'openQuestions' || ticket.data.details.openQuestions !== '')
              .map((name): { id: string; label: string; value: string } => ({
                id: name,
                label: say(ISSUE_DETAIL_TEXT.ticketField[name]),
                value: ticket.data.details[name] || say(ISSUE_DETAIL_TEXT.ticketEmpty),
              }))
              .concat({
                id: 'skills',
                label: say(ISSUE_DETAIL_TEXT.ticketField.skills),
                value: ticket.data.details.skills.join(', ') || say(ISSUE_DETAIL_TEXT.ticketEmpty),
              }),
            checks: ticket.data.details.ticketAcs.map((check, index) => ({
              id: String(index),
              given: check.given,
              when: check.when,
              outcomes: check.outcomes,
            })),
            tests: ticket.data.details.requiredTests.map((test, index) => ({ id: String(index), label: test.case, unhappy: test.unhappy })),
            ready: ticket.data.readiness.ready,
            readyLabel: say(ticket.data.readiness.ready ? ISSUE_DETAIL_TEXT.ready : ISSUE_DETAIL_TEXT.notReady),
            failing: ticket.data.readiness.failing.map((miss) => ({
              id: String(miss.item),
              label: say(ISSUE_DETAIL_TEXT.readinessItem, { item: miss.item, reason: miss.reason }),
              rule: miss.rule,
            })),
            criteria: (delivered.data ?? []).map((criterion) => ({
              id: criterion.id,
              code: criterion.code,
              title: criterion.title,
              given: criterion.given,
              when: criterion.when,
              outcomes: criterion.outcomes,
              struck: criterion.status === 'struck',
            })),
          }
        : null,
    // A ticket's engineer adds their own steps as sub-tasks.
    subtaskForm:
      ARTIFACT_STANDARD_ENABLED && current?.type === 'task' && access.canEdit
        ? {
            value: newSubtask,
            setValue: setNewSubtask,
            canAdd: newSubtask.trim() !== '' && !act.isPending,
            add: () => {
              const title = newSubtask.trim()
              if (title === '') return
              setNewSubtask('')
              act.mutate(() => issuesService.create(token, workspaceId, project, { type: 'subtask', title, parentId: id }))
            },
          }
        : null,
    links: (links.data ?? []).map((link) => ({
      id: link.id,
      label: say(ISSUE_DETAIL_TEXT.link[link.direction][link.kind]),
      key: link.issueKey,
      title: link.issueTitle,
    })),
  }
}
