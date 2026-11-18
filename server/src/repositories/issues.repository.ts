import type { SQL } from 'bun'
import type { IssueRow, IssueType } from '@/models/issue'

const columns = `i.id, i.project_id AS "projectId", i.number, p.key || '-' || i.number AS key, i.type, i.parent_id AS "parentId", i.title, i.description, i.acceptance_criteria AS "acceptanceCriteria", i.user_story_role AS "userStoryRole", i.user_story_action AS "userStoryAction", i.user_story_benefit AS "userStoryBenefit", i.flow, i.status, i.points, i.priority, i.rank::float8 AS rank, i.sprint_id AS "sprintId", i.role, i.assignee_id AS "assigneeId", u.email AS "assigneeEmail", i.due_date::text AS "dueDate", i.source_document_id AS "sourceDocumentId", i.source_version AS "sourceVersion", i.source_section AS "sourceSection", i.source_reviewed_version AS "sourceReviewedVersion", (src.current_version > i.source_version AND coalesce(i.source_reviewed_version, i.source_version) < src.current_version) AS "sourceOutdated", i.design_approved_by AS "designApprovedBy", i.design_approved_at AS "designApprovedAt", i.test_case_id AS "testCaseId", i.published_at AS "publishedAt", i.created_by AS "createdBy", i.created_at AS "createdAt", i.updated_at AS "updatedAt"`
const tables = 'FROM issues i JOIN projects p ON p.id = i.project_id LEFT JOIN users u ON u.id = i.assignee_id LEFT JOIN planning_documents src ON src.id = i.source_document_id'

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

// The rank of the closest backlog item above or below a rank, leaving one issue out. Null when there is none.
export async function neighbourRank(db: SQL, projectId: string, rank: number, direction: 'above' | 'below', excludeId: string): Promise<number | null> {
  const [row] =
    direction === 'above'
      ? await db`SELECT max(rank)::float8 AS rank FROM issues WHERE project_id = ${projectId} AND rank < ${rank} AND id <> ${excludeId}`
      : await db`SELECT min(rank)::float8 AS rank FROM issues WHERE project_id = ${projectId} AND rank > ${rank} AND id <> ${excludeId}`
  return row?.rank ?? null
}

// Spaces the whole backlog one step apart again, keeping its order.
export async function renumberRanks(db: SQL, projectId: string, step: number): Promise<void> {
  await db`UPDATE issues SET rank = ordered.position * ${step}
    FROM (SELECT id, row_number() OVER (ORDER BY rank, number) AS position FROM issues WHERE project_id = ${projectId} AND rank IS NOT NULL) AS ordered
    WHERE issues.id = ordered.id`
}

export async function markPublished(db: SQL, projectId: string, id: string): Promise<void> {
  await db`UPDATE issues SET published_at = coalesce(published_at, now()), updated_at = now() WHERE project_id = ${projectId} AND id = ${id}`
}

export interface ChecklistRow {
  id: string
  issueId: string
  title: string
  done: boolean
  position: number
}

const checklistColumns = 'id, issue_id AS "issueId", title, done, position'

export async function listChecklistRows(db: SQL, issueId: string): Promise<ChecklistRow[]> {
  return db`SELECT ${db.unsafe(checklistColumns)} FROM issue_checklist_items WHERE issue_id = ${issueId} ORDER BY position, created_at`
}

export async function insertChecklistRow(db: SQL, input: { id: string; issueId: string; title: string }): Promise<ChecklistRow> {
  const [row] = await db`INSERT INTO issue_checklist_items (id, issue_id, title, position)
    VALUES (${input.id}, ${input.issueId}, ${input.title}, (SELECT coalesce(max(position), 0) + 1 FROM issue_checklist_items WHERE issue_id = ${input.issueId}))
    RETURNING ${db.unsafe(checklistColumns)}`
  return row
}

export async function findChecklistRow(db: SQL, issueId: string, itemId: string): Promise<ChecklistRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(checklistColumns)} FROM issue_checklist_items WHERE issue_id = ${issueId} AND id = ${itemId}`
  return row
}

export async function setChecklistRowDone(db: SQL, itemId: string, done: boolean): Promise<void> {
  await db`UPDATE issue_checklist_items SET done = ${done} WHERE id = ${itemId}`
}

export async function deleteChecklistRow(db: SQL, itemId: string): Promise<void> {
  await db`DELETE FROM issue_checklist_items WHERE id = ${itemId}`
}

export interface LinkRow {
  id: string
  kind: string
  direction: 'out' | 'in'
  issueId: string
  issueKey: string
  issueTitle: string
  issuePublishedAt: Date | null
  issueCreatedBy: string
}

const linkEnd = (near: string, far: string, direction: string) =>
  `SELECT l.id, l.kind, '${direction}' AS direction, o.id AS "issueId", p.key || '-' || o.number AS "issueKey", o.title AS "issueTitle", o.published_at AS "issuePublishedAt", o.created_by AS "issueCreatedBy", l.created_at AS "createdAt"
   FROM issue_links l JOIN issues o ON o.id = l.${far} JOIN projects p ON p.id = o.project_id WHERE l.${near} = $1`

// Links in both directions: the ones this issue makes (out) and the ones that point at it (in).
export async function listLinkRows(db: SQL, issueId: string): Promise<LinkRow[]> {
  return db.unsafe(`${linkEnd('from_id', 'to_id', 'out')} UNION ALL ${linkEnd('to_id', 'from_id', 'in')} ORDER BY "createdAt", id`, [issueId])
}

export async function insertLinkRow(db: SQL, input: { id: string; fromId: string; toId: string; kind: string; createdBy: string }): Promise<void> {
  await db`INSERT INTO issue_links (id, from_id, to_id, kind, created_by) VALUES (${input.id}, ${input.fromId}, ${input.toId}, ${input.kind}, ${input.createdBy}) ON CONFLICT (from_id, to_id, kind) DO NOTHING`
}

export async function findLinkRow(db: SQL, issueId: string, linkId: string): Promise<{ id: string } | undefined> {
  const [row] = await db`SELECT id FROM issue_links WHERE id = ${linkId} AND (from_id = ${issueId} OR to_id = ${issueId})`
  return row
}

export async function deleteLinkRow(db: SQL, linkId: string): Promise<void> {
  await db`DELETE FROM issue_links WHERE id = ${linkId}`
}

// True when `startId` already blocks `targetId`, directly or through other issues.
export async function blocksReach(db: SQL, startId: string, targetId: string): Promise<boolean> {
  const [row] = await db`WITH RECURSIVE reach(id) AS (
      SELECT to_id FROM issue_links WHERE from_id = ${startId} AND kind = 'blocks'
      UNION
      SELECT l.to_id FROM issue_links l JOIN reach r ON l.from_id = r.id WHERE l.kind = 'blocks'
    ) SELECT 1 AS hit FROM reach WHERE id = ${targetId} LIMIT 1`
  return row !== undefined
}

export interface DraftVisibility {
  includeDrafts: boolean
  // A member always sees the drafts they made themselves.
  viewerId: string
}

// The open items that belong to no sprint, by rank. Finished items are left out. A page follows `after`.
// A Kanban project has no sprints, so it reads every open item, even one a planned sprint still holds.
export async function listBacklogPage(
  db: SQL,
  projectId: string,
  query: DraftVisibility & { limit: number; after: { rank: number; number: number } | null; anySprint?: boolean },
): Promise<IssueRow[]> {
  const rank = query.after?.rank ?? null
  const number = query.after?.number ?? null
  return db`SELECT ${db.unsafe(columns)} ${db.unsafe(tables)} WHERE i.project_id = ${projectId}
    AND (${query.anySprint ?? false}::boolean OR i.sprint_id IS NULL) AND i.rank IS NOT NULL AND i.status IS DISTINCT FROM 'done'
    AND (${query.includeDrafts}::boolean OR i.published_at IS NOT NULL OR i.created_by = ${query.viewerId})
    AND (${rank}::float8 IS NULL OR (i.rank::float8, i.number) > (${rank}::float8, ${number}::int))
    ORDER BY i.rank, i.number LIMIT ${query.limit}`
}

export async function listSprintIssues(db: SQL, sprintId: string, query: DraftVisibility & { limit: number }): Promise<IssueRow[]> {
  return db`SELECT ${db.unsafe(columns)} ${db.unsafe(tables)} WHERE i.sprint_id = ${sprintId} AND i.type IN ('story', 'task', 'bug')
    AND (${query.includeDrafts}::boolean OR i.published_at IS NOT NULL OR i.created_by = ${query.viewerId})
    ORDER BY i.rank NULLS LAST, i.number LIMIT ${query.limit}`
}

// Issues by number, one page at a time.
export async function listIssuesByNumber(
  db: SQL,
  projectId: string,
  query: DraftVisibility & { type?: IssueType; sprintId?: string | null; parentId?: string; limit: number; afterNumber: number | null },
): Promise<IssueRow[]> {
  return db`SELECT ${db.unsafe(columns)} ${db.unsafe(tables)} WHERE i.project_id = ${projectId}
    AND (${query.includeDrafts}::boolean OR i.published_at IS NOT NULL OR i.created_by = ${query.viewerId})
    AND (${query.type ?? null}::text IS NULL OR i.type = ${query.type ?? null})
    AND (${query.parentId ?? null}::text IS NULL OR i.parent_id = ${query.parentId ?? null})
    AND (${query.sprintId === undefined}::boolean OR i.sprint_id IS NOT DISTINCT FROM ${query.sprintId ?? null})
    AND (${query.afterNumber}::int IS NULL OR i.number > ${query.afterNumber}::int)
    ORDER BY i.number LIMIT ${query.limit}`
}

// The epics and stories already made from a document, so a second run does not make them again.
export async function listSourceEntries(db: SQL, projectId: string, documentId: string): Promise<Array<{ id: string; type: IssueType; parentId: string | null; title: string; sourceSection: string | null }>> {
  return db`SELECT id, type, parent_id AS "parentId", title, source_section AS "sourceSection" FROM issues WHERE project_id = ${projectId} AND source_document_id = ${documentId} AND type IN ('epic', 'story')`
}

export async function setSourceReviewed(db: SQL, projectId: string, id: string, version: number): Promise<void> {
  await db`UPDATE issues SET source_reviewed_version = ${version}, updated_at = now() WHERE project_id = ${projectId} AND id = ${id}`
}
