import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { Task } from '@/features/projects/models/project.model'
import type { Subtask } from '@/features/projects/models/story.model'
import { planningService } from '@/features/projects/services/planning.service'
import { projectsService } from '@/features/projects/services/projects.service'
import { progressOf } from '@/features/projects/utils/planning'
import { projectKeys } from '@/features/projects/viewmodels/project-keys'
import { storyKey } from '@/features/projects/viewmodels/use-story-extras.viewmodel'
import { readErrorMessage } from '@/shared/utils/error-message'

// Task parts from stage 4: role, lock, dependencies, sub-tasks, and the story attachments the task works from.
export function useTaskExtrasViewModel(
  workspaceId: string,
  task: Task | null,
  boardTasks: Task[],
  codes: Record<string, string>,
  enabled: boolean,
) {
  const { t } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const [newSubtask, setNewSubtask] = useState('')
  const taskId = task?.id ?? ''
  const storyId = task?.storyId ?? ''
  const key = projectKeys.subtasks(workspaceId, taskId)

  const subtasks = useQuery({
    queryKey: key,
    queryFn: () => projectsService.subtasks(token, workspaceId, taskId),
    enabled: enabled && task !== null,
  })
  const story = useQuery({
    queryKey: storyKey(workspaceId, storyId),
    queryFn: () => planningService.story(token, workspaceId, storyId),
    enabled: enabled && Boolean(storyId),
  })
  const refreshCounts = () => queryClient.invalidateQueries({ queryKey: projectKeys.list(workspaceId) })
  const add = useMutation({
    mutationFn: () => projectsService.addSubtask(token, workspaceId, taskId, newSubtask.trim()),
    onSuccess: async () => {
      setNewSubtask('')
      await queryClient.invalidateQueries({ queryKey: key })
      await refreshCounts()
    },
  })
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => projectsService.setSubtaskDone(token, workspaceId, taskId, id, done),
    onMutate: ({ id, done }) => {
      const previous = queryClient.getQueryData<Subtask[]>(key)
      queryClient.setQueryData<Subtask[]>(key, (current) => current?.map((subtask) => (subtask.id === id ? { ...subtask, done } : subtask)))
      return { previous }
    },
    onError: (_error, _variables, context) => context?.previous && queryClient.setQueryData(key, context.previous),
    onSettled: refreshCounts,
  })

  const list = subtasks.data ?? []
  const done = list.filter((subtask) => subtask.done).length
  const related = (ids: string[]) =>
    ids
      .map((id) => boardTasks.find((row) => row.id === id))
      .filter((row): row is Task => row !== undefined)
      .map((row) => ({ id: row.id, title: row.title, done: row.status === 'done' }))
  const failure = add.error ?? toggle.error ?? subtasks.error

  return {
    available: enabled && task !== null,
    role: task?.role ?? null,
    locked: Boolean(task?.locked),
    storyCode: storyId ? (codes[storyId] ?? null) : null,
    dependsOn: related(task?.dependsOn ?? []),
    neededBy: related(boardTasks.filter((row) => row.dependsOn?.includes(taskId)).map((row) => row.id)),
    subtasks: list,
    subtaskDone: done,
    subtaskTotal: list.length,
    subtaskPercent: progressOf(done, list.length),
    onToggleSubtask: (id: string, value: boolean) => toggle.mutate({ id, done: value }),
    newSubtask,
    setNewSubtask,
    canAddSubtask: Boolean(newSubtask.trim()) && !add.isPending,
    onAddSubtask: () => add.mutate(),
    attachments: story.data
      ? {
          designs: story.data.designs.map((design) => design.title),
          contracts: story.data.contracts.map((contract) => `${contract.method} ${contract.path}`),
          testCases: story.data.testCases.map((testCase) => testCase.code),
        }
      : null,
    error: failure ? readErrorMessage(failure, t(PLANNING_TEXT.error)) : null,
  }
}
