import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { Task } from '@/features/projects/models/project.model'
import {
  type StoryDetails,
  type StoryStage,
  storyStage,
  testCaseText,
  WORK_ROLES,
  type WorkRole,
} from '@/features/projects/models/story.model'
import { planningService } from '@/features/projects/services/planning.service'
import { progressOf } from '@/features/projects/utils/planning'
import { planningKeys } from '@/features/projects/viewmodels/planning-keys'
import { projectKeys } from '@/features/projects/viewmodels/project-keys'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatRelativeDate } from '@/shared/utils/format'
import { parseMarkdown } from '@/shared/utils/markdown'

export const storyKey = (workspaceId: string, storyId: string) => ['planning', workspaceId, 'story', storyId] as const

// Story parts from stages 2 and 3: user story, flow, Definition of Done, designs, API contracts, test cases, and role lanes.
export function useStoryExtrasViewModel(
  workspaceId: string,
  story: { id: string; status: string } | null,
  boardTasks: Task[],
  enabled: boolean,
  canApprove: boolean,
) {
  const { t, i18n } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{
    role: string
    action: string
    benefit: string
    flow: string
    dod: Array<{ id?: string; key: string; text: string; role: WorkRole }>
  } | null>(null)
  const storyId = story?.id ?? ''

  const details = useQuery({
    queryKey: storyKey(workspaceId, storyId),
    queryFn: () => planningService.story(token, workspaceId, storyId),
    enabled: enabled && story !== null,
  })
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: planningKeys.all(workspaceId) })
    await queryClient.invalidateQueries({ queryKey: projectKeys.all })
  }
  const save = useMutation({
    mutationFn: () =>
      planningService.updateStory(token, workspaceId, storyId, {
        userStory: { role: draft?.role.trim() ?? '', action: draft?.action.trim() ?? '', benefit: draft?.benefit.trim() ?? '' },
        flow: draft?.flow ?? '',
        definitionOfDone: (draft?.dod ?? [])
          .filter((entry) => entry.text.trim())
          .map((entry) => ({ id: entry.id, text: entry.text.trim(), role: entry.role })),
      }),
    onSuccess: async () => {
      setDraft(null)
      await refresh()
    },
  })
  const approve = useMutation({ mutationFn: () => planningService.approveDesign(token, workspaceId, storyId), onSuccess: refresh })
  const toggleDod = useMutation({
    mutationFn: ({ itemId, done }: { itemId: string; done: boolean }) =>
      planningService.setDodItem(token, workspaceId, storyId, itemId, done),
    onMutate: ({ itemId, done }) => {
      const key = storyKey(workspaceId, storyId)
      const previous = queryClient.getQueryData<StoryDetails>(key)
      queryClient.setQueryData<StoryDetails>(
        key,
        (current) =>
          current && {
            ...current,
            definitionOfDone: current.definitionOfDone.map((entry) => (entry.id === itemId ? { ...entry, done } : entry)),
          },
      )
      return { previous }
    },
    onError: (_error, _variables, context) =>
      context?.previous && queryClient.setQueryData(storyKey(workspaceId, storyId), context.previous),
  })

  const data = details.data ?? null
  const stage: StoryStage = data?.stage ?? storyStage(story?.status ?? 'draft')
  const storyTasks = boardTasks.filter((task) => task.storyId === storyId)
  const dodDone = data?.definitionOfDone.filter((entry) => entry.done).length ?? 0
  const labels = {
    precondition: t(PLANNING_TEXT.story.precondition),
    steps: t(PLANNING_TEXT.story.steps),
    expected: t(PLANNING_TEXT.story.expected),
  }
  const failure = approve.error ?? toggleDod.error ?? save.error ?? details.error

  return {
    available: enabled && data !== null,
    isLoading: enabled && story !== null && details.isPending,
    stage,
    userStory: data?.userStory ?? null,
    flow: data?.flow ?? '',
    flowBlocks: parseMarkdown(data?.flow ?? ''),
    dod: data?.definitionOfDone ?? [],
    dodDone,
    dodTotal: data?.definitionOfDone.length ?? 0,
    dodPercent: progressOf(dodDone, data?.definitionOfDone.length ?? 0),
    onToggleDod: (itemId: string, done: boolean) => toggleDod.mutate({ itemId, done }),
    designs: data?.designs ?? [],
    // Design links come from agents, so only http and https open, in a new tab without access back to this page.
    onOpenDesign: (url: string) => {
      if (/^https?:\/\//.test(url)) window.open(url, '_blank', 'noopener,noreferrer')
    },
    designApproval: data?.designApprovedBy
      ? { by: data.designApprovedBy, when: formatRelativeDate(data.designApprovedAt ?? '', i18n.language) ?? '' }
      : null,
    canApproveDesign: canApprove && stage === 'design' && (data?.designs.length ?? 0) > 0,
    isApproving: approve.isPending,
    onApproveDesign: () => approve.mutate(),
    contracts: data?.contracts ?? [],
    testCases: (data?.testCases ?? []).map((testCase) => ({ ...testCase, text: testCaseText(testCase, labels) })),
    copiedId,
    onCopyTestCase: async (id: string, text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedId(id)
        window.setTimeout(() => setCopiedId(null), 1600)
      } catch {
        setCopiedId(null)
      }
    },
    lanes: WORK_ROLES.map((role: WorkRole) => {
      const tasks = storyTasks.filter((task) => task.role === role)
      return {
        role,
        assignee: tasks[0]?.assigneeEmail ?? null,
        allDone: tasks.length > 0 && tasks.every((task) => task.status === 'done'),
        done: tasks.filter((task) => task.status === 'done').length,
        percent: progressOf(tasks.filter((task) => task.status === 'done').length, tasks.length),
        started: tasks.some((task) => task.status !== 'backlog' && task.status !== 'todo'),
        locked: tasks.some((task) => task.locked),
        tasks: tasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          locked: Boolean(task.locked),
          subtasks: task.subtaskTotal ? `${task.subtaskDone ?? 0}/${task.subtaskTotal}` : null,
          waitingFor: (task.dependsOn ?? [])
            .map((id) => boardTasks.find((row) => row.id === id))
            .filter((row): row is Task => row !== undefined && row.status !== 'done')
            .map((row) => row.title),
        })),
      }
    }).filter((lane) => lane.tasks.length > 0),
    tasksDone: storyTasks.filter((task) => task.status === 'done').length,
    tasksTotal: storyTasks.length,
    editor: draft && {
      ...draft,
      setRole: (role: string) => setDraft((current) => current && { ...current, role }),
      setAction: (action: string) => setDraft((current) => current && { ...current, action }),
      setBenefit: (benefit: string) => setDraft((current) => current && { ...current, benefit }),
      setFlow: (flow: string) => setDraft((current) => current && { ...current, flow }),
      setDodText: (key: string, text: string) =>
        setDraft((current) => current && { ...current, dod: current.dod.map((entry) => (entry.key === key ? { ...entry, text } : entry)) }),
      setDodRole: (key: string, role: WorkRole) =>
        setDraft((current) => current && { ...current, dod: current.dod.map((entry) => (entry.key === key ? { ...entry, role } : entry)) }),
      addDod: () =>
        setDraft((current) => current && { ...current, dod: [...current.dod, { key: crypto.randomUUID(), text: '', role: 'backend' }] }),
      removeDod: (key: string) => setDraft((current) => current && { ...current, dod: current.dod.filter((entry) => entry.key !== key) }),
    },
    isSaving: save.isPending,
    // The item form and this editor open and save together, so the PM edits the whole story in one place.
    startEdit: () =>
      setDraft({
        role: data?.userStory.role ?? '',
        action: data?.userStory.action ?? '',
        benefit: data?.userStory.benefit ?? '',
        flow: data?.flow ?? '',
        dod: (data?.definitionOfDone ?? []).map((entry) => ({ id: entry.id, key: entry.id, text: entry.text, role: entry.role })),
      }),
    cancelEdit: () => setDraft(null),
    saveEdit: () => draft && save.mutate(),
    error: failure ? readErrorMessage(failure, t(PLANNING_TEXT.error)) : null,
  }
}
