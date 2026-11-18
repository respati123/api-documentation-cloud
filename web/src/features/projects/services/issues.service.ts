import * as z from 'zod/mini'
import {
  backlogSchema,
  burndownSchema,
  checklistItemSchema,
  flowSchema,
  type IssuePriority,
  type IssueType,
  issueLinkSchema,
  issueSchema,
  type LinkKind,
  projectSettingsSchema,
  sprintReportSchema,
  sprintSchema,
  velocitySchema,
  wipLimitsSchema,
} from '@/features/projects/models/issue.model'
import { isSampleWorkspace, workspaceCall } from '@/features/projects/services/workspace-transport'
import { apiPage } from '@/shared/services/api-client'

export interface NewIssueInput {
  type: IssueType
  title: string
  description?: string
  acceptanceCriteria?: string
  parentId?: string | null
  points?: number | null
  priority?: IssuePriority
  role?: string | null
  assigneeId?: string | null
  dueDate?: string | null
}

export interface IssuePatchInput {
  title?: string
  description?: string
  acceptanceCriteria?: string
  status?: string
  points?: number | null
  priority?: IssuePriority
  parentId?: string | null
  assigneeId?: string | null
  dueDate?: string | null
}

export interface SprintInput {
  name: string
  goal?: string
  startsOn: string
  endsOn: string
}

const issueOf = z.object({ issue: issueSchema })
const sprintOf = z.object({ sprint: sprintSchema })

// Every call is project-scoped: /api/workspaces/{workspaceId}/projects/{projectId}/...
const at = (projectId: string, path: string) => `/projects/${projectId}${path}`

// One page of an issue list. The sample workspace answers from its own data, which has no cursor, so it is one page.
async function issuePage(token: string, workspaceId: string, projectId: string, query: string, cursor?: string | null) {
  const path = at(projectId, `/issues?${query}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
  const page = isSampleWorkspace(workspaceId)
    ? { data: await workspaceCall(workspaceId, path, { token }), nextCursor: null }
    : await apiPage(`/api/workspaces/${workspaceId}${path}`, { token })
  return { items: z.parse(z.object({ issues: z.array(issueSchema) }), page.data).issues, nextCursor: page.nextCursor }
}

export const issuesService = {
  backlog: async (token: string, workspaceId: string, projectId: string, cursor?: string | null) =>
    z.parse(
      backlogSchema,
      await workspaceCall(workspaceId, at(projectId, `/backlog?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`), {
        token,
      }),
    ),

  // Epics, a page at a time. The panel in the backlog needs them all, so the caller follows the cursor.
  epics: (token: string, workspaceId: string, projectId: string, cursor?: string | null) =>
    issuePage(token, workspaceId, projectId, 'type=epic', cursor),

  // The sub-tasks of the whole project, a page at a time. The board keeps those of the items in the sprint.
  subtasks: (token: string, workspaceId: string, projectId: string, cursor?: string | null) =>
    issuePage(token, workspaceId, projectId, 'type=subtask', cursor),

  // What sits under an issue: the items of an epic, or the sub-tasks of an item.
  children: (token: string, workspaceId: string, projectId: string, parentId: string, cursor?: string | null) =>
    issuePage(token, workspaceId, projectId, `epic=${encodeURIComponent(parentId)}`, cursor),

  issue: async (token: string, workspaceId: string, projectId: string, ref: string) =>
    z.parse(issueOf, await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}`), { token })).issue,
  create: async (token: string, workspaceId: string, projectId: string, input: NewIssueInput) =>
    z.parse(issueOf, await workspaceCall(workspaceId, at(projectId, '/issues'), { token, method: 'POST', body: input })).issue,
  update: async (token: string, workspaceId: string, projectId: string, ref: string, patch: IssuePatchInput) =>
    z.parse(
      issueOf,
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}`), { token, method: 'PATCH', body: patch }),
    ).issue,
  rank: async (
    token: string,
    workspaceId: string,
    projectId: string,
    ref: string,
    placement: { afterId?: string | null; beforeId?: string | null },
  ) =>
    z.parse(
      issueOf,
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/rank`), {
        token,
        method: 'POST',
        body: placement,
      }),
    ).issue,
  publish: async (token: string, workspaceId: string, projectId: string, ref: string) =>
    z.parse(
      issueOf,
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/publish`), { token, method: 'POST' }),
    ).issue,
  markSourceReviewed: async (token: string, workspaceId: string, projectId: string, ref: string) =>
    z.parse(
      issueOf,
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/source-reviewed`), { token, method: 'POST' }),
    ).issue,

  checklist: async (token: string, workspaceId: string, projectId: string, ref: string) =>
    z.parse(
      z.object({ items: z.array(checklistItemSchema) }),
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/checklist`), { token }),
    ).items,
  addChecklistItem: async (token: string, workspaceId: string, projectId: string, ref: string, title: string) =>
    z.parse(
      z.object({ item: checklistItemSchema }),
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/checklist`), {
        token,
        method: 'POST',
        body: { title },
      }),
    ).item,
  setChecklistItemDone: async (token: string, workspaceId: string, projectId: string, ref: string, itemId: string, done: boolean) =>
    z.parse(
      z.object({ item: checklistItemSchema }),
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/checklist/${itemId}`), {
        token,
        method: 'PATCH',
        body: { done },
      }),
    ).item,
  deleteChecklistItem: (token: string, workspaceId: string, projectId: string, ref: string, itemId: string) =>
    workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/checklist/${itemId}`), { token, method: 'DELETE' }),

  links: async (token: string, workspaceId: string, projectId: string, ref: string) =>
    z.parse(
      z.object({ links: z.array(issueLinkSchema) }),
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/links`), { token }),
    ).links,
  addLink: async (token: string, workspaceId: string, projectId: string, ref: string, toId: string, kind: LinkKind) =>
    z.parse(
      z.object({ links: z.array(issueLinkSchema) }),
      await workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/links`), {
        token,
        method: 'POST',
        body: { toId, kind },
      }),
    ).links,
  removeLink: (token: string, workspaceId: string, projectId: string, ref: string, linkId: string) =>
    workspaceCall(workspaceId, at(projectId, `/issues/${encodeURIComponent(ref)}/links/${linkId}`), { token, method: 'DELETE' }),

  sprints: async (token: string, workspaceId: string, projectId: string) =>
    z.parse(z.object({ sprints: z.array(sprintSchema) }), await workspaceCall(workspaceId, at(projectId, '/sprints'), { token })).sprints,
  createSprint: async (token: string, workspaceId: string, projectId: string, input: SprintInput) =>
    z.parse(sprintOf, await workspaceCall(workspaceId, at(projectId, '/sprints'), { token, method: 'POST', body: input })).sprint,
  updateSprint: async (token: string, workspaceId: string, projectId: string, sprintId: string, patch: Partial<SprintInput>) =>
    z.parse(sprintOf, await workspaceCall(workspaceId, at(projectId, `/sprints/${sprintId}`), { token, method: 'PATCH', body: patch }))
      .sprint,
  startSprint: async (token: string, workspaceId: string, projectId: string, sprintId: string) =>
    z.parse(sprintOf, await workspaceCall(workspaceId, at(projectId, `/sprints/${sprintId}/start`), { token, method: 'POST' })).sprint,
  closeSprint: async (token: string, workspaceId: string, projectId: string, sprintId: string, carryTo: string) =>
    z.parse(
      sprintOf,
      await workspaceCall(workspaceId, at(projectId, `/sprints/${sprintId}/close`), { token, method: 'POST', body: { carryTo } }),
    ).sprint,
  addSprintItem: (token: string, workspaceId: string, projectId: string, sprintId: string, issueId: string, overrideReason?: string) =>
    workspaceCall(workspaceId, at(projectId, `/sprints/${sprintId}/items`), {
      token,
      method: 'POST',
      body: { issueId, ...(overrideReason ? { overrideReason } : {}) },
    }),
  removeSprintItem: (token: string, workspaceId: string, projectId: string, sprintId: string, issueId: string) =>
    workspaceCall(workspaceId, at(projectId, `/sprints/${sprintId}/items/${issueId}`), { token, method: 'DELETE' }),

  burndown: async (token: string, workspaceId: string, projectId: string, sprintId: string) =>
    z.parse(burndownSchema, await workspaceCall(workspaceId, at(projectId, `/sprints/${sprintId}/burndown`), { token })),
  sprintReport: async (token: string, workspaceId: string, projectId: string, sprintId: string) =>
    z.parse(sprintReportSchema, await workspaceCall(workspaceId, at(projectId, `/sprints/${sprintId}/report`), { token })),
  velocity: async (token: string, workspaceId: string, projectId: string, limit = 6) =>
    z.parse(velocitySchema, await workspaceCall(workspaceId, at(projectId, `/reports/velocity?limit=${limit}`), { token })),
  flow: async (token: string, workspaceId: string, projectId: string, days: number) =>
    z.parse(flowSchema, await workspaceCall(workspaceId, at(projectId, `/flow?days=${days}`), { token })),
  wipLimits: async (token: string, workspaceId: string, projectId: string) =>
    z.parse(wipLimitsSchema, await workspaceCall(workspaceId, at(projectId, '/wip-limits'), { token })).limits,
  setWipLimit: async (token: string, workspaceId: string, projectId: string, status: string, limit: number | null) =>
    z.parse(
      wipLimitsSchema,
      await workspaceCall(workspaceId, at(projectId, `/wip-limits/${status}`), { token, method: 'PUT', body: { limit } }),
    ).limits,

  updateSettings: async (
    token: string,
    workspaceId: string,
    projectId: string,
    patch: { key?: string; mode?: 'scrum' | 'kanban'; productGoal?: string },
  ) =>
    z.parse(
      z.object({ project: projectSettingsSchema }),
      await workspaceCall(workspaceId, `/projects/${projectId}`, { token, method: 'PATCH', body: patch }),
    ).project,
  draftBacklog: async (token: string, workspaceId: string, projectId: string, documentId: string) =>
    z.parse(
      z.object({ issues: z.array(issueSchema) }),
      await workspaceCall(workspaceId, at(projectId, `/documents/${documentId}/draft-backlog`), { token, method: 'POST' }),
    ).issues,
}
