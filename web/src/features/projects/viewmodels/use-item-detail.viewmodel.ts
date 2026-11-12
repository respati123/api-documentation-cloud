import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { PlanningDocumentSummary, PlanningItem, PlanningStatus, PlanningTask } from '@/features/projects/models/planning.model'
import { storyStage } from '@/features/projects/models/story.model'
import { planningService } from '@/features/projects/services/planning.service'
import { ITEM_NEXT, progressOf } from '@/features/projects/utils/planning'
import { planningKeys } from '@/features/projects/viewmodels/planning-keys'
import { readErrorMessage } from '@/shared/utils/error-message'

interface Member {
  id: string
  email: string
  discipline: string | null
}

export function useItemDetailViewModel(
  workspaceId: string,
  itemId: string | null,
  data: {
    items: PlanningItem[]
    tasks: PlanningTask[]
    documents: PlanningDocumentSummary[]
    members: Member[]
    codes: Record<string, string>
  },
  access: { canManage: boolean; canApprove: boolean },
) {
  const { t } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskAssigneeId, setTaskAssigneeId] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const item = data.items.find((row) => row.id === itemId) ?? null
  const refresh = () => queryClient.invalidateQueries({ queryKey: planningKeys.all(workspaceId) })

  const update = useMutation({
    mutationFn: (input: Parameters<typeof planningService.updateItem>[3]) =>
      planningService.updateItem(token, workspaceId, itemId ?? '', input),
    onSuccess: async () => {
      setEditing(false)
      await refresh()
    },
  })
  const publish = useMutation({ mutationFn: () => planningService.publishEpic(token, workspaceId, itemId ?? ''), onSuccess: refresh })
  const rebase = useMutation({ mutationFn: () => planningService.rebaseEpic(token, workspaceId, itemId ?? ''), onSuccess: refresh })
  const saveTask = useMutation({
    mutationFn: () =>
      editingTaskId
        ? planningService.updateTaskDraft(token, workspaceId, editingTaskId, {
            title: taskTitle.trim(),
            assigneeId: taskAssigneeId || null,
          })
        : planningService.createTaskDraft(token, workspaceId, {
            storyId: itemId ?? '',
            title: taskTitle.trim(),
            description: '',
            assigneeId: taskAssigneeId || null,
          }),
    onSuccess: async () => {
      setTaskTitle('')
      setTaskAssigneeId('')
      setEditingTaskId(null)
      await refresh()
    },
  })

  const memberEmail = (id: string | null) => data.members.find((member) => member.id === id)?.email ?? null
  const tasksOf = (storyId: string) => data.tasks.filter((task) => task.storyId === storyId)
  const parent = item?.parentId ? data.items.find((row) => row.id === item.parentId) : undefined
  const stories = item?.kind === 'epic' ? data.items.filter((row) => row.parentId === item.id) : []
  const epicTasks = stories.flatMap((story) => tasksOf(story.id))
  const storyTasks = item?.kind === 'story' ? tasksOf(item.id) : []
  const source = item?.sourceDocumentId ? data.documents.find((document) => document.id === item.sourceDocumentId) : undefined
  const next = item ? ITEM_NEXT[item.status] : null
  // Moving to ready is an approval; later steps need the epic published, which the server checks.
  const nextAllowed =
    next !== null &&
    (next === 'ready' ? access.canApprove : access.canManage) &&
    (next === 'ready' || next === 'refinement' || Boolean(item?.publishedAt))
  const failure = update.error ?? publish.error ?? rebase.error ?? saveTask.error

  return {
    item,
    code: item ? (data.codes[item.id] ?? '') : '',
    parent: parent ? { id: parent.id, title: parent.title, code: data.codes[parent.id] ?? '' } : null,
    source: source ? { id: source.id, title: source.title, version: item?.sourceVersion ?? source.currentVersion } : null,
    stories: stories.map((story) => {
      const tasks = tasksOf(story.id)
      return {
        id: story.id,
        code: data.codes[story.id] ?? '',
        title: story.title,
        status: story.status,
        stage: story.stage ?? storyStage(story.status),
        published: Boolean(story.publishedAt),
        tasksDone: tasks.filter((task) => task.status === 'done').length,
        tasksTotal: tasks.length,
        participants: story.participantIds.map((id) => memberEmail(id) ?? id),
      }
    }),
    progress: {
      storiesDone: stories.filter((story) => story.status === 'done').length,
      storiesTotal: stories.length,
      storiesPercent: progressOf(stories.filter((story) => story.status === 'done').length, stories.length),
      tasksDone: epicTasks.filter((task) => task.status === 'done').length,
      tasksTotal: epicTasks.length,
      tasksPercent: progressOf(epicTasks.filter((task) => task.status === 'done').length, epicTasks.length),
    },
    participants: (item?.participantIds ?? []).map((id) => {
      const member = data.members.find((row) => row.id === id)
      return { id, email: member?.email ?? id, discipline: member?.discipline ?? null }
    }),
    tasks: storyTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      assignee: memberEmail(task.assigneeId),
      assigneeDiscipline: data.members.find((member) => member.id === task.assigneeId)?.discipline ?? null,
      published: Boolean(task.publishedAt),
      canEdit: access.canManage && !task.publishedAt,
    })),
    canManage: access.canManage,
    next,
    canMoveNext: nextAllowed,
    onMoveNext: () => next && update.mutate({ status: next as PlanningStatus }),
    canPublish: access.canApprove && item?.kind === 'epic' && item.status === 'ready' && !item.publishedAt,
    onPublish: () => publish.mutate(),
    canRebase: access.canManage && item?.kind === 'epic' && Boolean(item.sourceOutdated) && !item.publishedAt,
    onRebase: () => rebase.mutate(),
    isBusy: update.isPending || publish.isPending || rebase.isPending,
    editing,
    title,
    setTitle,
    description,
    setDescription,
    criteria,
    setCriteria,
    members: data.members,
    selectedParticipants: participants,
    toggleParticipant: (id: string) =>
      setParticipants((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id])),
    onEdit: () => {
      if (!item) return
      setTitle(item.title)
      setDescription(item.description)
      setCriteria(item.acceptanceCriteria)
      setParticipants(item.participantIds)
      setEditing(true)
    },
    onCancelEdit: () => setEditing(false),
    canSave: editing && Boolean(title.trim()) && !update.isPending,
    onSave: () =>
      item &&
      update.mutate({
        title: title.trim(),
        description: description.trim(),
        acceptanceCriteria: criteria.trim(),
        participantIds: item.kind === 'story' ? participants : undefined,
      }),
    canAddTask: access.canManage && item?.kind === 'story' && !item.publishedAt,
    taskTitle,
    setTaskTitle,
    taskAssigneeId,
    setTaskAssigneeId,
    editingTaskId,
    onEditTask: (taskId: string) => {
      const task = data.tasks.find((row) => row.id === taskId)
      if (!task) return
      setEditingTaskId(task.id)
      setTaskTitle(task.title)
      setTaskAssigneeId(task.assigneeId ?? '')
    },
    onCancelTask: () => {
      setEditingTaskId(null)
      setTaskTitle('')
      setTaskAssigneeId('')
    },
    canSaveTask: Boolean(taskTitle.trim()) && !saveTask.isPending,
    onSaveTask: () => saveTask.mutate(),
    error: failure ? readErrorMessage(failure, t(PLANNING_TEXT.error)) : null,
    reset: () => {
      setEditing(false)
      setEditingTaskId(null)
      setTaskTitle('')
    },
  }
}
