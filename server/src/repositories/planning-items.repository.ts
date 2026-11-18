import type { SQL } from 'bun'
import { RANK_STEP } from '@/models/issue'
import { allocateIssueNumber, insertIssue, lastRank } from '@/repositories/issues.repository'

// Epics and stories live in the issues table. This file keeps the shapes that the planning service and the MCP tools
// already know, and answers them from issues.

export type PlanningItemRow = {
  id: string
  workspaceId: string
  kind: 'epic' | 'story'
  parentId: string | null
  title: string
  description: string
  acceptanceCriteria: string
  status: string
  publishedAt: Date | null
  sourceDocumentId: string | null
  sourceVersion: number | null
  sourceSection: string | null
  createdAt: Date
  updatedAt: Date
}

// A story has its own status. An epic has none, so it is worked out from its stories: a draft until it is published,
// then done when every story is done, in progress when any item under it has started, and todo otherwise.
const itemStatus = `CASE
  WHEN i.type = 'story' THEN i.status
  WHEN i.published_at IS NULL THEN 'draft'
  WHEN EXISTS (SELECT 1 FROM issues c WHERE c.parent_id = i.id AND c.type = 'story') AND NOT EXISTS (SELECT 1 FROM issues c WHERE c.parent_id = i.id AND c.type = 'story' AND c.status <> 'done') THEN 'done'
  WHEN EXISTS (SELECT 1 FROM issues c WHERE c.parent_id = i.id AND c.type IN ('story', 'task', 'bug') AND c.status IN ('in_progress', 'in_qa', 'in_review', 'done')) THEN 'in_progress'
  ELSE 'todo'
END`

const itemFrom = 'FROM issues i JOIN projects p ON p.id = i.project_id'
const ofWorkspace = (workspaceId: string) => workspaceId

export async function findPlanningItem(db: SQL, workspaceId: string, itemId: string): Promise<PlanningItemRow | undefined> {
  const [row] = await db`SELECT i.id, p.workspace_id AS "workspaceId", i.type AS kind, i.parent_id AS "parentId", i.title, i.description, i.acceptance_criteria AS "acceptanceCriteria", ${db.unsafe(itemStatus)} AS status, i.published_at AS "publishedAt", i.source_document_id AS "sourceDocumentId", i.source_version AS "sourceVersion", i.source_section AS "sourceSection", i.created_at AS "createdAt", i.updated_at AS "updatedAt" ${db.unsafe(itemFrom)} WHERE i.id = ${itemId} AND p.workspace_id = ${ofWorkspace(workspaceId)} AND i.type IN ('epic', 'story')`
  return row
}

export async function listPlanningItemRows(db: SQL, workspaceId: string, includeDrafts: boolean): Promise<Array<Record<string, unknown> & { kind: string; status: string; designApprovedAt: Date | null; designCount: number }>> {
  return db`SELECT i.id, i.type AS kind, i.parent_id AS "parentId", i.title, i.description, i.acceptance_criteria AS "acceptanceCriteria", ${db.unsafe(itemStatus)} AS status, i.published_at AS "publishedAt", i.source_document_id AS "sourceDocumentId", i.source_version AS "sourceVersion", i.source_section AS "sourceSection", (d.current_version > i.source_version) AS "sourceOutdated", i.created_at AS "createdAt", i.design_approved_at AS "designApprovedAt", (SELECT count(*)::int FROM story_designs sd WHERE sd.story_id = i.id) AS "designCount", COALESCE((SELECT array_agg(pp.user_id) FROM planning_participants pp WHERE pp.item_id = i.id), ARRAY[]::text[]) AS "participantIds" ${db.unsafe(itemFrom)} LEFT JOIN planning_documents d ON d.id = i.source_document_id WHERE p.workspace_id = ${workspaceId} AND i.type IN ('epic', 'story') AND (${includeDrafts} OR i.published_at IS NOT NULL) ORDER BY i.created_at LIMIT 500`
}

export async function insertPlanningItem(
  db: SQL,
  row: { id: string; workspaceId: string; kind: string; parentId: string | null; title: string; description: string; acceptanceCriteria: string; sourceDocumentId: string; sourceVersion: number; sourceSection: string | null; createdBy: string },
) {
  const [project] = await db`SELECT id FROM projects WHERE workspace_id = ${row.workspaceId} ORDER BY created_at, id LIMIT 1`
  if (!project) throw new Error('The workspace has no project to hold the item.')
  const story = row.kind === 'story'
  await insertIssue(db, {
    id: row.id,
    projectId: project.id,
    number: await allocateIssueNumber(db, project.id),
    type: story ? 'story' : 'epic',
    parentId: row.parentId,
    title: row.title,
    description: row.description,
    acceptanceCriteria: row.acceptanceCriteria,
    status: story ? 'draft' : null,
    points: null,
    priority: 'medium',
    rank: story ? ((await lastRank(db, project.id)) ?? 0) + RANK_STEP : null,
    role: null,
    assigneeId: null,
    dueDate: null,
    sourceDocumentId: row.sourceDocumentId,
    sourceVersion: row.sourceVersion,
    sourceSection: row.sourceSection,
    published: false,
    createdBy: row.createdBy,
  })
}

// An epic has no status of its own, so a status sent for it changes nothing.
export async function updatePlanningItemFields(db: SQL, row: { workspaceId: string; itemId: string; title: string; description: string; acceptanceCriteria: string; status: string }) {
  await db`UPDATE issues SET title = ${row.title}, description = ${row.description}, acceptance_criteria = ${row.acceptanceCriteria}, status = CASE WHEN type = 'story' THEN ${row.status} ELSE status END, updated_at = now() WHERE id = ${row.itemId} AND project_id IN (SELECT id FROM projects WHERE workspace_id = ${row.workspaceId})`
}

export async function findItemDesignApprovedAt(db: SQL, itemId: string): Promise<Date | null> {
  const [row] = await db`SELECT design_approved_at AS "approvedAt" FROM issues WHERE id = ${itemId}`
  return row?.approvedAt ?? null
}

export async function replacePlanningParticipants(db: SQL, itemId: string, userIds: string[], { clear }: { clear: boolean }) {
  if (clear) await db`DELETE FROM planning_participants WHERE item_id = ${itemId}`
  for (const userId of userIds) await db`INSERT INTO planning_participants (item_id, user_id) VALUES (${itemId}, ${userId})`
}

// A task draft under a story is a sub-task. It needs a role: the one given, else the first work role of its assignee
// in the project, else backend.
export async function insertTaskDraft(
  db: SQL,
  row: { id: string; projectId: string; storyId: string; title: string; description: string; priority: string; assigneeId: string | null; createdBy: string; role: string | null },
) {
  const [assigned] = row.assigneeId
    ? await db`SELECT discipline FROM project_members WHERE project_id = ${row.projectId} AND user_id = ${row.assigneeId} AND discipline IN ('ui_ux', 'backend', 'frontend', 'mobile', 'qa') ORDER BY created_at, discipline LIMIT 1`
    : []
  await insertIssue(db, {
    id: row.id,
    projectId: row.projectId,
    number: await allocateIssueNumber(db, row.projectId),
    type: 'subtask',
    parentId: row.storyId,
    title: row.title,
    description: row.description,
    acceptanceCriteria: '',
    status: 'todo',
    points: null,
    priority: row.priority,
    rank: null,
    role: row.role ?? assigned?.discipline ?? 'backend',
    assigneeId: row.assigneeId,
    dueDate: null,
    sourceDocumentId: null,
    sourceVersion: null,
    sourceSection: null,
    published: false,
    createdBy: row.createdBy,
  })
}

// Null leaves a field as it is. assigneeId is the exception: undefined keeps it, null clears it.
export async function updateTaskDraftRow(
  db: SQL,
  row: { workspaceId: string; taskId: string; title: string | null; description: string | null; assigneeId: string | null | undefined; priority: string | null },
) {
  const [task] = await db`UPDATE issues SET title = coalesce(${row.title}, title), description = coalesce(${row.description}, description), assignee_id = CASE WHEN ${row.assigneeId === undefined} THEN assignee_id ELSE ${row.assigneeId ?? null} END, priority = coalesce(${row.priority}, priority), updated_at = now() WHERE id = ${row.taskId} AND type = 'subtask' AND published_at IS NULL AND parent_id IN (SELECT s.id FROM issues s JOIN projects p ON p.id = s.project_id WHERE p.workspace_id = ${row.workspaceId} AND s.type = 'story' AND s.published_at IS NULL) RETURNING id, parent_id AS "storyId", title, description, priority, assignee_id AS "assigneeId"`
  return task as Record<string, unknown> | undefined
}

export async function listPlanningTaskRows(db: SQL, workspaceId: string, includeDrafts: boolean) {
  return db`SELECT i.id, i.parent_id AS "storyId", i.title, i.description, i.status, i.priority, i.assignee_id AS "assigneeId", i.published_at AS "publishedAt" ${db.unsafe(itemFrom)} WHERE p.workspace_id = ${workspaceId} AND i.type = 'subtask' AND (${includeDrafts} OR i.published_at IS NOT NULL) ORDER BY i.created_at LIMIT 500`
}

// Publishing an epic publishes its stories and their sub-tasks too. Nothing else is checked: an approver may publish at any time.
export async function publishEpicRows(db: SQL, epicId: string) {
  await db`UPDATE issues SET published_at = now(), updated_at = now() WHERE published_at IS NULL AND (id = ${epicId} OR parent_id = ${epicId} OR parent_id IN (SELECT id FROM issues WHERE parent_id = ${epicId}))`
}

export async function rebaseEpicSource(db: SQL, workspaceId: string, epicId: string, sourceVersion: number) {
  await db`UPDATE issues SET source_version = ${sourceVersion}, updated_at = now() WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = ${workspaceId}) AND (id = ${epicId} OR parent_id = ${epicId}) AND published_at IS NULL`
}

export async function findTaskAssignee(db: SQL, taskId: string): Promise<string | null> {
  const [task] = await db`SELECT assignee_id AS "assigneeId" FROM issues WHERE id = ${taskId}`
  return task?.assigneeId ?? null
}
