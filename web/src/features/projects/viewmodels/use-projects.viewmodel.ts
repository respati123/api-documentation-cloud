import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PROJECT_STATUS_ORDER, PROJECTS_TEXT } from '@/features/projects/constants/projects-text.constants'
import type { Task, TaskStatus } from '@/features/projects/models/project.model'
import type { WorkRole } from '@/features/projects/models/story.model'
import { projectsService } from '@/features/projects/services/projects.service'
import { isOverdue } from '@/features/projects/utils/planning'
import { projectKeys } from '@/features/projects/viewmodels/project-keys'
import { useBacklogViewModel } from '@/features/projects/viewmodels/use-backlog.viewmodel'
import { useDraftBacklogViewModel } from '@/features/projects/viewmodels/use-draft-backlog.viewmodel'
import { useIssueDetailViewModel } from '@/features/projects/viewmodels/use-issue-detail.viewmodel'
import { useKanbanBoardViewModel } from '@/features/projects/viewmodels/use-kanban-board.viewmodel'
import { usePlanningViewModel } from '@/features/projects/viewmodels/use-planning.viewmodel'
import { usePlanningCommentsViewModel } from '@/features/projects/viewmodels/use-planning-comments.viewmodel'
import { useReportsViewModel } from '@/features/projects/viewmodels/use-reports.viewmodel'
import { useSprintBoardViewModel } from '@/features/projects/viewmodels/use-sprint-board.viewmodel'
import { useSprintSummaryViewModel } from '@/features/projects/viewmodels/use-sprint-summary.viewmodel'
import { useStoryExtrasViewModel } from '@/features/projects/viewmodels/use-story-extras.viewmodel'
import { useTaskExtrasViewModel } from '@/features/projects/viewmodels/use-task-extras.viewmodel'
import { AGILE_PROJECT_ENABLED } from '@/shared/config/features'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatDate } from '@/shared/utils/format'

export const DONE_PREVIEW = 3
export type PriorityFilter = '' | Task['priority']

export interface BoardFilters {
  search: string
  mine: boolean
  overdue: boolean
  priority: PriorityFilter
  assigneeId: string
  role: '' | WorkRole
}

export function filterTasks(tasks: Task[], filters: BoardFilters, userId: string, today = new Date()): Task[] {
  const query = filters.search.trim().toLowerCase()
  return tasks.filter(
    (task) =>
      (!filters.mine || task.assigneeId === userId) &&
      (!filters.overdue || isOverdue(task.dueDate, task.status, today)) &&
      (!filters.priority || task.priority === filters.priority) &&
      (!filters.assigneeId || task.assigneeId === filters.assigneeId) &&
      (!filters.role || task.role === filters.role) &&
      (!query || `${task.title} ${task.description} ${task.assigneeEmail ?? ''}`.toLowerCase().includes(query)),
  )
}

export function useProjectsViewModel(workspaceId: string, workspaceName: string, canEdit: boolean, enabled: boolean) {
  const { t, i18n } = useTranslation('projects')
  const token = useAuthSessionStore((state) => state.token)
  const signedIn = useAuthSessionStore((state) => state.signedIn)
  const userId = useAuthSessionStore((state) => state.userId)
  const queryClient = useQueryClient()
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskPriority, setTaskPriority] = useState<Task['priority']>('medium')
  const [taskDueDate, setTaskDueDate] = useState('')
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('backlog')
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [assigneeId, setAssigneeId] = useState('')
  const [filters, setFilters] = useState<BoardFilters>({ search: '', mine: false, overdue: false, priority: '', assigneeId: '', role: '' })
  const [showAllDone, setShowAllDone] = useState(false)
  // Small screens show one column at a time.
  const [mobileStatus, setMobileStatus] = useState<TaskStatus>('todo')

  const projects = useQuery({
    queryKey: projectKeys.list(workspaceId),
    queryFn: () => projectsService.list(token, workspaceId),
    enabled: signedIn && enabled,
    staleTime: 30_000,
  })
  const selectedProject = projects.data?.[0]
  const tasksKey = projectKeys.tasks(workspaceId, selectedProject?.id ?? '')
  const tasks = useQuery({
    queryKey: tasksKey,
    queryFn: () => projectsService.tasks(token, workspaceId, selectedProject?.id ?? ''),
    enabled: signedIn && enabled && Boolean(selectedProject),
    staleTime: 10_000,
  })
  const members = useQuery({
    queryKey: [...projectKeys.all, workspaceId, 'members'],
    queryFn: () => projectsService.members(token, workspaceId),
    enabled: signedIn && enabled,
    staleTime: 60_000,
  })
  const memberList = members.data ?? []
  const planning = usePlanningViewModel(workspaceId, memberList, tasks.data ?? [], enabled)

  const taskInput = () => ({
    title: taskTitle,
    description: taskDescription,
    assigneeId: assigneeId || null,
    priority: taskPriority,
    dueDate: taskDueDate || null,
    status: taskStatus,
  })
  const createTask = useMutation({
    mutationFn: () => projectsService.createTask(token, workspaceId, selectedProject?.id ?? '', taskInput()),
    onSuccess: async () => {
      setTaskDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: tasksKey })
    },
  })
  const updateTask = useMutation({
    mutationFn: () => projectsService.updateTask(token, workspaceId, editingTaskId ?? '', taskInput()),
    onSuccess: async () => {
      setTaskDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: tasksKey })
    },
  })
  // The card moves at once. If the server refuses, the board goes back to what it was and the server's message shows.
  const moveTask = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      projectsService.moveTask(token, workspaceId, taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: tasksKey })
      const previous = queryClient.getQueryData<Task[]>(tasksKey)
      queryClient.setQueryData<Task[]>(tasksKey, (current) => current?.map((task) => (task.id === taskId ? { ...task, status } : task)))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(tasksKey, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  })

  const editingTask = (tasks.data ?? []).find((task) => task.id === editingTaskId)
  const canSeeTaskComments = Boolean(editingTask) && (planning.access.canManage || editingTask?.assigneeId === userId)
  const taskComments = usePlanningCommentsViewModel(
    workspaceId,
    canSeeTaskComments && editingTaskId ? { kind: 'task', id: editingTaskId } : null,
    planning.access.canManage,
    memberList,
  )

  const mode = selectedProject?.mode ?? 'scrum'
  const backlog = useBacklogViewModel(
    workspaceId,
    selectedProject?.id,
    selectedProject?.productGoal ?? '',
    enabled && AGILE_PROJECT_ENABLED && planning.section === 'backlog',
    { canEdit, canApprove: planning.access.canApprove, canManage: planning.access.canManage },
    mode,
  )

  const issueDetail = useIssueDetailViewModel(workspaceId, selectedProject?.id, {
    canEdit,
    canApprove: planning.access.canApprove,
    canManage: planning.access.canManage,
  })

  // The parts of a story (Definition of Done, designs, contracts, test cases) come from the story routes, which share the issue ids.
  const issueStory = useStoryExtrasViewModel(
    workspaceId,
    issueDetail.storyRef,
    [],
    AGILE_PROJECT_ENABLED && issueDetail.storyRef !== null,
    planning.access.canApprove,
  )

  const sprintBoard = useSprintBoardViewModel(
    workspaceId,
    selectedProject?.id,
    enabled && AGILE_PROJECT_ENABLED && mode === 'scrum' && planning.section === 'board',
    canEdit,
  )
  const kanbanBoard = useKanbanBoardViewModel(
    workspaceId,
    selectedProject?.id,
    enabled && AGILE_PROJECT_ENABLED && mode === 'kanban' && planning.section === 'board',
    { canEdit, canApprove: planning.access.canApprove },
  )

  const sprintSummary = useSprintSummaryViewModel(
    workspaceId,
    selectedProject?.id,
    enabled && AGILE_PROJECT_ENABLED && mode === 'scrum' && planning.section === 'flow',
  )
  const draftBacklog = useDraftBacklogViewModel(workspaceId, selectedProject?.id, AGILE_PROJECT_ENABLED && planning.access.canManage, () =>
    planning.go('backlog'),
  )

  const reports = useReportsViewModel(
    workspaceId,
    selectedProject?.id,
    mode,
    enabled && AGILE_PROJECT_ENABLED && planning.section === 'reports',
  )

  const allTasks = tasks.data ?? []
  const taskExtras = useTaskExtrasViewModel(workspaceId, editingTask ?? null, allTasks, planning.codes, true)
  const visible = filterTasks(allTasks, filters, userId)
  const failure = projects.error ?? tasks.error ?? moveTask.error

  return {
    workspaceId,
    workspaceName,
    selectedProject,
    planning,
    backlog,
    sprintBoard,
    kanbanBoard,
    mode,
    issueDetail,
    issueStory,
    sprintSummary,
    draftBacklog,
    reports,
    taskComments,
    canSeeTaskComments,
    filters,
    setSearch: (search: string) => setFilters((current) => ({ ...current, search })),
    toggleMine: () => setFilters((current) => ({ ...current, mine: !current.mine })),
    toggleOverdue: () => setFilters((current) => ({ ...current, overdue: !current.overdue })),
    setPriorityFilter: (priority: PriorityFilter) => setFilters((current) => ({ ...current, priority })),
    setAssigneeFilter: (id: string) => setFilters((current) => ({ ...current, assigneeId: id })),
    setRoleFilter: (role: '' | WorkRole) => setFilters((current) => ({ ...current, role })),
    hasRoles: allTasks.some((task) => task.role),
    taskExtras,
    taskActivity: editingTaskId ? planning.activityFor(editingTaskId) : [],
    shownCount: visible.length,
    totalCount: allTasks.length,
    columns: PROJECT_STATUS_ORDER.map((status) => {
      const items = visible.filter((task) => task.status === status)
      const collapsed = status === 'done' && !showAllDone
      return {
        status,
        title: t(PROJECTS_TEXT.statuses[status]),
        total: items.length,
        hiddenCount: collapsed ? Math.max(0, items.length - DONE_PREVIEW) : 0,
        canCollapse: status === 'done' && showAllDone && items.length > DONE_PREVIEW,
        items: (collapsed ? items.slice(0, DONE_PREVIEW) : items).map((task) => ({
          ...task,
          overdue: isOverdue(task.dueDate, task.status),
          storyCode: task.storyId ? (planning.codes[task.storyId] ?? null) : null,
          subtasks: task.subtaskTotal ? `${task.subtaskDone ?? 0}/${task.subtaskTotal}` : null,
          draggable: canEdit && !task.locked,
          due: task.dueDate ? (formatDate(task.dueDate, i18n.language) ?? task.dueDate) : null,
        })),
      }
    }),
    onToggleDone: () => setShowAllDone((current) => !current),
    mobileStatus,
    setMobileStatus,
    taskDialogOpen,
    setTaskDialogOpen,
    editingTaskId,
    taskStatus,
    setTaskStatus,
    openCreate: (status: TaskStatus) => {
      createTask.reset()
      setEditingTaskId(null)
      setTaskTitle('')
      setTaskDescription('')
      setAssigneeId('')
      setTaskPriority('medium')
      setTaskDueDate('')
      setTaskStatus(status)
      setTaskDialogOpen(true)
    },
    openTask: (taskId: string) => {
      const task = allTasks.find((row) => row.id === taskId)
      if (!task) return
      updateTask.reset()
      setEditingTaskId(task.id)
      setTaskTitle(task.title)
      setTaskDescription(task.description)
      setAssigneeId(task.assigneeId ?? '')
      setTaskPriority(task.priority)
      setTaskDueDate(task.dueDate ?? '')
      setTaskStatus(task.status)
      setTaskDialogOpen(true)
    },
    members: memberList,
    taskTitle,
    setTaskTitle,
    taskDescription,
    setTaskDescription,
    taskPriority,
    setTaskPriority,
    taskDueDate,
    setTaskDueDate,
    assigneeId,
    setAssigneeId,
    canEdit,
    status: projects.isPending ? ('loading' as const) : projects.isError ? ('error' as const) : ('ready' as const),
    tasksLoading: tasks.isPending && Boolean(selectedProject),
    error: failure ? readErrorMessage(failure, t(PROJECTS_TEXT.error)) : null,
    taskError:
      (createTask.error ?? updateTask.error) ? readErrorMessage(createTask.error ?? updateTask.error, t(PROJECTS_TEXT.error)) : null,
    isSavingTask: createTask.isPending || updateTask.isPending,
    onSaveTask: () => (editingTaskId ? updateTask.mutate() : createTask.mutate()),
    onMoveTask: (taskId: string, status: TaskStatus) => {
      if (allTasks.find((task) => task.id === taskId)?.status !== status) moveTask.mutate({ taskId, status })
    },
  }
}
