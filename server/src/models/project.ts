export const PROJECT_DISCIPLINES = ['backend', 'frontend', 'mobile', 'pm', 'qa', 'ui_ux', 'devops', 'other', 'tech_lead'] as const
export type ProjectDiscipline = (typeof PROJECT_DISCIPLINES)[number]
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface ProjectRow {
  id: string
  workspaceId: string
  name: string
  description: string
  createdAt: Date
  taskCount: number
}

export interface TaskRow {
  id: string
  projectId: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assigneeId: string | null
  assigneeEmail: string | null
  dueDate: string | null
  position: string
  createdAt: Date
  updatedAt: Date
  storyId: string | null
  role: string | null
  locked: boolean
  dependsOn: string[]
  subtaskDone: number
  subtaskTotal: number
}
