import * as z from 'zod/mini'
import { workRoleSchema } from '@/features/projects/models/story.model'

export const projectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  description: z.string(),
  createdAt: z.string(),
  taskCount: z.number(),
})
export const taskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  assigneeId: z.nullable(z.string()),
  assigneeEmail: z.nullable(z.string()),
  dueDate: z.nullable(z.string()),
  position: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Plan 4.1 to 4.4. Optional until the server sends them, so the board keeps working against today's API.
  storyId: z.optional(z.nullable(z.string())),
  role: z.optional(z.nullable(workRoleSchema)),
  locked: z.optional(z.boolean()),
  dependsOn: z.optional(z.array(z.string())),
  subtaskDone: z.optional(z.number()),
  subtaskTotal: z.optional(z.number()),
})
export const projectMemberSchema = z.object({ id: z.string(), email: z.string(), discipline: z.nullable(z.string()) })
export const projectDisciplineSchema = z.enum(['backend', 'frontend', 'mobile', 'pm', 'qa', 'ui_ux', 'devops', 'other', 'tech_lead'])
export type Project = z.infer<typeof projectSchema>
export type Task = z.infer<typeof taskSchema>
export type TaskStatus = Task['status']
export type ProjectMember = { id: string; email: string; discipline: string | null }
export type ProjectDiscipline = z.infer<typeof projectDisciplineSchema>
