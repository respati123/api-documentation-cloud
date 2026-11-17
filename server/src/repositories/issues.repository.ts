import type { SQL } from 'bun'
import type { IssueRow, IssueType } from '@/models/issue'

const columns = `i.id, i.project_id AS "projectId", i.number, p.key || '-' || i.number AS key, i.type, i.parent_id AS "parentId", i.title, i.description, i.acceptance_criteria AS "acceptanceCriteria", i.user_story_role AS "userStoryRole", i.user_story_action AS "userStoryAction", i.user_story_benefit AS "userStoryBenefit", i.flow, i.status, i.points, i.priority, i.rank::float8 AS rank, i.sprint_id AS "sprintId", i.role, i.assignee_id AS "assigneeId", u.email AS "assigneeEmail", i.due_date::text AS "dueDate", i.source_document_id AS "sourceDocumentId", i.source_version AS "sourceVersion", i.source_section AS "sourceSection", i.source_reviewed_version AS "sourceReviewedVersion", i.design_approved_by AS "designApprovedBy", i.design_approved_at AS "designApprovedAt", i.test_case_id AS "testCaseId", i.published_at AS "publishedAt", i.created_by AS "createdBy", i.created_at AS "createdAt", i.updated_at AS "updatedAt"`
const tables = 'FROM issues i JOIN projects p ON p.id = i.project_id LEFT JOIN users u ON u.id = i.assignee_id'

export interface NewIssue {
  id: string
  projectId: string
  number: number
  type: IssueType
  parentId: string | null
  title: string
  description: string
  acceptanceCriteria: string
  status: string | null
  points: number | null
  priority: string
  rank: number | null
  role: string | null
  assigneeId: string | null
  dueDate: string | null
  sourceDocumentId: string | null
  sourceVersion: number | null
  sourceSection: string | null
  published: boolean
  createdBy: string
}

// The columns a patch may change, with the column each one writes to. Anything else in a patch is ignored.
const patchColumns = {
  title: 'title',
  description: 'description',
  acceptanceCriteria: 'acceptance_criteria',
  status: 'status',
  points: 'points',
  priority: 'priority',
  parentId: 'parent_id',
  assigneeId: 'assignee_id',
  dueDate: 'due_date',
  role: 'role',
  sprintId: 'sprint_id',
  rank: 'rank',
  sourceReviewedVersion: 'source_reviewed_version',
} as const
export type IssuePatch = { [Key in keyof typeof patchColumns]?: unknown }

// Hands out the next issue number of a project. The update locks the project row, so two creations never share one.
export async function allocateIssueNumber(db: SQL, projectId: string): Promise<number> {
  const [row] = await db`UPDATE projects SET next_issue_number = next_issue_number + 1 WHERE id = ${projectId} RETURNING next_issue_number - 1 AS number`
  return Number(row.number)
}

export async function lastRank(db: SQL, projectId: string): Promise<number | null> {
  const [row] = await db`SELECT max(rank)::float8 AS rank FROM issues WHERE project_id = ${projectId}`
  return row?.rank ?? null
}

export async function insertIssue(db: SQL, issue: NewIssue): Promise<void> {
  await db`INSERT INTO issues (id, project_id, number, type, parent_id, title, description, acceptance_criteria, status, points, priority, rank, role, assignee_id, due_date, source_document_id, source_version, source_section, published_at, created_by)
    VALUES (${issue.id}, ${issue.projectId}, ${issue.number}, ${issue.type}, ${issue.parentId}, ${issue.title}, ${issue.description}, ${issue.acceptanceCriteria}, ${issue.status}, ${issue.points}, ${issue.priority}, ${issue.rank}, ${issue.role}, ${issue.assigneeId}, ${issue.dueDate}, ${issue.sourceDocumentId}, ${issue.sourceVersion}, ${issue.sourceSection}, CASE WHEN ${issue.published}::boolean THEN now() END, ${issue.createdBy})`
}

export async function findIssue(db: SQL, projectId: string, id: string): Promise<IssueRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(columns)} ${db.unsafe(tables)} WHERE i.project_id = ${projectId} AND i.id = ${id}`
  return row
}

export async function findIssueByNumber(db: SQL, projectId: string, number: number): Promise<IssueRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(columns)} ${db.unsafe(tables)} WHERE i.project_id = ${projectId} AND i.number = ${number}`
  return row
}

export interface IssueFilter {
  type?: IssueType
  sprintId?: string | null
  parentId?: string
  includeDrafts: boolean
  // A member always sees the drafts they made themselves.
  viewerId: string
}

export async function listIssues(db: SQL, projectId: string, filter: IssueFilter): Promise<IssueRow[]> {
  return db`SELECT ${db.unsafe(columns)} ${db.unsafe(tables)} WHERE i.project_id = ${projectId}
    AND (${filter.includeDrafts}::boolean OR i.published_at IS NOT NULL OR i.created_by = ${filter.viewerId})
    AND (${filter.type ?? null}::text IS NULL OR i.type = ${filter.type ?? null})
    AND (${filter.parentId ?? null}::text IS NULL OR i.parent_id = ${filter.parentId ?? null})
    AND (${filter.sprintId === undefined}::boolean OR i.sprint_id IS NOT DISTINCT FROM ${filter.sprintId ?? null})
    ORDER BY i.rank NULLS LAST, i.number`
}

// Writes the defined fields of a patch. A null value clears the column and an undefined one is skipped.
export async function updateIssueFields(db: SQL, projectId: string, id: string, patch: IssuePatch): Promise<void> {
  const row: Record<string, unknown> = {}
  for (const [field, column] of Object.entries(patchColumns)) {
    const value = patch[field as keyof IssuePatch]
    if (value !== undefined) row[column] = value
  }
  if (Object.keys(row).length === 0) return
  await db`UPDATE issues SET ${db(row)}, updated_at = now() WHERE project_id = ${projectId} AND id = ${id}`
}

export async function listChildren(db: SQL, parentId: string): Promise<Array<{ id: string; type: IssueType; status: string | null; assigneeId: string | null; role: string | null }>> {
  return db`SELECT id, type, status, assignee_id AS "assigneeId", role FROM issues WHERE parent_id = ${parentId}`
}

export async function insertStatusEvent(
  db: SQL,
  event: { id: string; issueId: string; fromStatus: string | null; toStatus: string; actorId: string; apiKeyId: string | null },
): Promise<void> {
  await db`INSERT INTO issue_status_events (id, issue_id, from_status, to_status, actor_id, api_key_id) VALUES (${event.id}, ${event.issueId}, ${event.fromStatus}, ${event.toStatus}, ${event.actorId}, ${event.apiKeyId})`
}
