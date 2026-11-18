import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { BACKLOG_TEXT } from '@/features/projects/constants/backlog-text.constants'
import { ISSUE_PRIORITIES, type IssuePriority, type IssueType, POINT_VALUES } from '@/features/projects/models/issue.model'
import { issuesService } from '@/features/projects/services/issues.service'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import { projectKeys } from '@/features/projects/viewmodels/project-keys'
import { ApiError } from '@/shared/services/api-client'
import { readErrorMessage } from '@/shared/utils/error-message'

export interface BacklogAccess {
  // Any editor of the workspace. Sets points and files bugs.
  canEdit: boolean
  // The PM and the tech lead. They plan sprints, order the backlog, and publish drafts.
  canApprove: boolean
  // The PM. Sets the Product Goal and overrides the sprint gate.
  canManage: boolean
}

export interface BacklogActionsInput {
  workspaceId: string
  projectId: string | undefined
  access: BacklogAccess
  epics: Array<{ id: string; title: string }>
  openSprints: Array<{ id: string; name: string; status: 'planned' | 'active'; goal: string; startsOn: string; endsOn: string }>
  productGoal: string
}

type Text = (key: string, options?: Record<string, unknown>) => string
interface PendingOverride {
  issueId: string
  sprintId: string
  title: string
  missing: string[]
}

const today = () => new Date().toISOString().slice(0, 10)
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
const DEFAULT_SPRINT_DAYS = 13

// What can be done on the backlog screen: dialogs to make an issue or a sprint, to close a sprint, to override the gate,
// and to set the Product Goal, and the single actions on a row. Every change reloads the screen's data.
export function useBacklogActionsViewModel({ workspaceId, projectId, access, epics, openSprints, productGoal }: BacklogActionsInput) {
  const { t } = useTranslation('planning')
  const say = t as Text
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const project = projectId ?? ''
  const [rowError, setRowError] = useState<string | null>(null)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, project) })
    await queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) })
  }
  const failure = (error: unknown) => readErrorMessage(error, say(BACKLOG_TEXT.error))

  // A single action on a row. Its failure shows above the lists, in the words of the server.
  const row = useMutation({
    mutationFn: (job: () => Promise<unknown>) => job(),
    onMutate: () => setRowError(null),
    onSuccess: refresh,
    onError: (error) => setRowError(failure(error)),
  })

  // --- new issue
  const [issueOpen, setIssueOpen] = useState(false)
  const [type, setType] = useState<IssueType>('story')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [parentId, setParentId] = useState('')
  const [points, setPoints] = useState('')
  const [priority, setPriority] = useState<IssuePriority>('medium')
  const createIssue = useMutation({
    mutationFn: () =>
      issuesService.create(token, workspaceId, project, {
        type,
        title: title.trim(),
        description: description.trim(),
        parentId: type === 'epic' ? null : parentId || null,
        points: type === 'epic' || points === '' ? null : Number(points),
        priority,
      }),
    onSuccess: async () => {
      setIssueOpen(false)
      await refresh()
    },
  })
  const allowedTypes: IssueType[] = access.canApprove ? ['epic', 'story', 'task', 'bug'] : ['bug']

  // --- new or edited sprint
  const [sprintOpen, setSprintOpen] = useState(false)
  const [editingSprint, setEditingSprint] = useState<string | null>(null)
  const [sprintName, setSprintName] = useState('')
  const [sprintGoal, setSprintGoal] = useState('')
  const [startsOn, setStartsOn] = useState(today())
  const [endsOn, setEndsOn] = useState(inDays(DEFAULT_SPRINT_DAYS))
  const saveSprint = useMutation({
    mutationFn: () => {
      const input = { name: sprintName.trim(), goal: sprintGoal.trim(), startsOn, endsOn }
      return editingSprint
        ? issuesService.updateSprint(token, workspaceId, project, editingSprint, input)
        : issuesService.createSprint(token, workspaceId, project, input)
    },
    onSuccess: async () => {
      setSprintOpen(false)
      await refresh()
    },
  })

  // --- close a sprint
  const [closing, setClosing] = useState<{ id: string; name: string } | null>(null)
  const [carryTo, setCarryTo] = useState('backlog')
  const closeSprint = useMutation({
    mutationFn: () => issuesService.closeSprint(token, workspaceId, project, closing?.id ?? '', carryTo),
    onSuccess: async () => {
      setClosing(null)
      await refresh()
    },
  })

  // --- the gate: the PM adds an item that is not ready, with a reason
  const [pending, setPending] = useState<PendingOverride | null>(null)
  const [reason, setReason] = useState('')
  const override = useMutation({
    mutationFn: () =>
      issuesService.addSprintItem(token, workspaceId, project, pending?.sprintId ?? '', pending?.issueId ?? '', reason.trim()),
    onSuccess: async () => {
      setPending(null)
      await refresh()
    },
  })
  const addToSprint = useMutation({
    mutationFn: (input: { issueId: string; sprintId: string; title: string }) =>
      issuesService.addSprintItem(token, workspaceId, project, input.sprintId, input.issueId),
    onMutate: () => setRowError(null),
    onSuccess: refresh,
    onError: (error, input) => {
      // The gate refused the item. The PM may add it anyway, so the PM is asked for a reason. Anyone else sees the message.
      if (error instanceof ApiError && error.code === 'SPRINT_ITEM_NOT_READY' && access.canManage) {
        const missing = (error.details as { missing?: string[] } | undefined)?.missing ?? []
        override.reset()
        setReason('')
        setPending({ ...input, missing })
        return
      }
      setRowError(failure(error))
    },
  })

  // --- the Product Goal
  const [goalOpen, setGoalOpen] = useState(false)
  const [goal, setGoal] = useState('')
  const saveGoal = useMutation({
    mutationFn: () => issuesService.updateSettings(token, workspaceId, project, { productGoal: goal.trim() }),
    onSuccess: async () => {
      setGoalOpen(false)
      await refresh()
    },
  })

  const planned = openSprints.filter((sprint) => sprint.status === 'planned')
  const running = openSprints.some((sprint) => sprint.status === 'active')

  return {
    access,
    rowError,
    rankEnabled: access.canApprove,
    sprintTargets: openSprints.map((sprint) => ({ id: sprint.id, name: sprint.name })),
    canStartSprint: access.canApprove && !running,
    // Row actions. A move names the ids of the list it happens in, so the neighbours are those the person sees.
    setPoints: (issueId: string, value: string) =>
      row.mutate(() => issuesService.update(token, workspaceId, project, issueId, { points: value === '' ? null : Number(value) })),
    publish: (issueId: string) => row.mutate(() => issuesService.publish(token, workspaceId, project, issueId)),
    move: (ids: string[], index: number, direction: 'up' | 'down') => {
      const placement =
        direction === 'up'
          ? { afterId: ids[index - 2] ?? null, beforeId: ids[index - 1] }
          : { afterId: ids[index + 1], beforeId: ids[index + 2] ?? null }
      if ((direction === 'up' && index < 1) || (direction === 'down' && index >= ids.length - 1)) return
      row.mutate(() => issuesService.rank(token, workspaceId, project, ids[index], placement))
    },
    addToSprint: (issueId: string, sprintId: string, issueTitle: string) => addToSprint.mutate({ issueId, sprintId, title: issueTitle }),
    removeFromSprint: (sprintId: string, issueId: string) =>
      row.mutate(() => issuesService.removeSprintItem(token, workspaceId, project, sprintId, issueId)),
    startSprint: (sprintId: string) => row.mutate(() => issuesService.startSprint(token, workspaceId, project, sprintId)),

    issueDialog: {
      open: issueOpen,
      onOpen: () => {
        createIssue.reset()
        setType(allowedTypes[0] === 'bug' ? 'bug' : 'story')
        setTitle('')
        setDescription('')
        setParentId('')
        setPoints('')
        setPriority('medium')
        setIssueOpen(true)
      },
      onClose: () => setIssueOpen(false),
      type,
      setType: (value: string) => setType(value as IssueType),
      title,
      setTitle,
      description,
      setDescription,
      parentId,
      setParentId,
      points,
      setPoints,
      priority,
      setPriority: (value: string) => setPriority(value as IssuePriority),
      typeOptions: allowedTypes.map((value) => ({ value, label: say(BACKLOG_TEXT.type[value]) })),
      epicOptions: [{ value: '', label: say(BACKLOG_TEXT.noEpic) }, ...epics.map((epic) => ({ value: epic.id, label: epic.title }))],
      pointsOptions: [
        { value: '', label: say(BACKLOG_TEXT.noPoints) },
        ...POINT_VALUES.map((value) => ({ value: String(value), label: String(value) })),
      ],
      priorityOptions: ISSUE_PRIORITIES.map((value) => ({ value, label: say(BACKLOG_TEXT.priority[value]) })),
      takesParent: type !== 'epic',
      takesPoints: type !== 'epic',
      canSubmit: title.trim() !== '' && !createIssue.isPending,
      isSaving: createIssue.isPending,
      error: createIssue.error ? failure(createIssue.error) : null,
      onSubmit: () => createIssue.mutate(),
    },

    sprintDialog: {
      open: sprintOpen,
      editing: editingSprint !== null,
      onOpenCreate: () => {
        saveSprint.reset()
        setEditingSprint(null)
        setSprintName('')
        setSprintGoal('')
        setStartsOn(today())
        setEndsOn(inDays(DEFAULT_SPRINT_DAYS))
        setSprintOpen(true)
      },
      onOpenEdit: (sprintId: string) => {
        const sprint = openSprints.find((item) => item.id === sprintId)
        if (!sprint) return
        saveSprint.reset()
        setEditingSprint(sprint.id)
        setSprintName(sprint.name)
        setSprintGoal(sprint.goal)
        setStartsOn(sprint.startsOn)
        setEndsOn(sprint.endsOn)
        setSprintOpen(true)
      },
      onClose: () => setSprintOpen(false),
      name: sprintName,
      setName: setSprintName,
      goal: sprintGoal,
      setGoal: setSprintGoal,
      startsOn,
      setStartsOn,
      endsOn,
      setEndsOn,
      canSubmit: sprintName.trim() !== '' && startsOn !== '' && endsOn !== '' && !saveSprint.isPending,
      isSaving: saveSprint.isPending,
      error: saveSprint.error ? failure(saveSprint.error) : null,
      onSubmit: () => saveSprint.mutate(),
    },

    closeDialog: {
      open: closing !== null,
      name: closing?.name ?? '',
      onOpen: (sprintId: string) => {
        const sprint = openSprints.find((item) => item.id === sprintId)
        if (!sprint) return
        closeSprint.reset()
        setCarryTo('backlog')
        setClosing({ id: sprint.id, name: sprint.name })
      },
      onClose: () => setClosing(null),
      carryTo,
      setCarryTo,
      options: [
        { value: 'backlog', label: say(BACKLOG_TEXT.closeDialog.toBacklog) },
        ...planned.filter((sprint) => sprint.id !== closing?.id).map((sprint) => ({ value: sprint.id, label: sprint.name })),
      ],
      isSaving: closeSprint.isPending,
      error: closeSprint.error ? failure(closeSprint.error) : null,
      onSubmit: () => closeSprint.mutate(),
    },

    overrideDialog: {
      open: pending !== null,
      title: pending?.title ?? '',
      reasons: (pending?.missing ?? []).map((item) => ({
        id: item,
        label: say(item === 'points' ? BACKLOG_TEXT.override.needsPoints : BACKLOG_TEXT.override.notReady),
      })),
      reason,
      setReason,
      canSubmit: reason.trim() !== '' && !override.isPending,
      isSaving: override.isPending,
      error: override.error ? failure(override.error) : null,
      onClose: () => setPending(null),
      onSubmit: () => override.mutate(),
    },

    goalDialog: {
      open: goalOpen,
      onOpen: () => {
        saveGoal.reset()
        setGoal(productGoal)
        setGoalOpen(true)
      },
      onClose: () => setGoalOpen(false),
      goal,
      setGoal,
      isSaving: saveGoal.isPending,
      error: saveGoal.error ? failure(saveGoal.error) : null,
      onSubmit: () => saveGoal.mutate(),
    },
  }
}
