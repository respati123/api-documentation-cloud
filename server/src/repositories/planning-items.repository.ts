import type { SQL } from 'bun'

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

export async function findPlanningItem(db: SQL, workspaceId: string, itemId: string): Promise<PlanningItemRow | undefined> {
  const [row] = await db`SELECT id, workspace_id AS "workspaceId", kind, parent_id AS "parentId", title, description, acceptance_criteria AS "acceptanceCriteria", status, published_at AS "publishedAt", source_document_id AS "sourceDocumentId", source_version AS "sourceVersion", source_section AS "sourceSection", created_at AS "createdAt", updated_at AS "updatedAt" FROM planning_items WHERE id = ${itemId} AND workspace_id = ${workspaceId}`
  return row
}

export async function listPlanningItemRows(db: SQL, workspaceId: string, includeDrafts: boolean): Promise<Array<Record<string, unknown> & { kind: string; status: string; designApprovedAt: Date | null; designCount: number }>> {
  return db`SELECT i.id, i.kind, i.parent_id AS "parentId", i.title, i.description, i.acceptance_criteria AS "acceptanceCriteria", i.status, i.published_at AS "publishedAt", i.source_document_id AS "sourceDocumentId", i.source_version AS "sourceVersion", i.source_section AS "sourceSection", (d.current_version > i.source_version) AS "sourceOutdated", i.created_at AS "createdAt", i.design_approved_at AS "designApprovedAt", (SELECT count(*)::int FROM story_designs sd WHERE sd.story_id = i.id) AS "designCount", COALESCE((SELECT array_agg(pp.user_id) FROM planning_participants pp WHERE pp.item_id = i.id), ARRAY[]::text[]) AS "participantIds" FROM planning_items i LEFT JOIN planning_documents d ON d.id = i.source_document_id WHERE i.workspace_id = ${workspaceId} AND (${includeDrafts} OR i.published_at IS NOT NULL) ORDER BY i.created_at LIMIT 500`
}

export async function insertPlanningItem(
  db: SQL,
  row: { id: string; workspaceId: string; kind: string; parentId: string | null; title: string; description: string; acceptanceCriteria: string; sourceDocumentId: string; sourceVersion: number; sourceSection: string | null; createdBy: string },
) {
  await db`INSERT INTO planning_items (id, workspace_id, kind, parent_id, title, description, acceptance_criteria, source_document_id, source_version, source_section, created_by) VALUES (${row.id}, ${row.workspaceId}, ${row.kind}, ${row.parentId}, ${row.title}, ${row.description}, ${row.acceptanceCriteria}, ${row.sourceDocumentId}, ${row.sourceVersion}, ${row.sourceSection}, ${row.createdBy})`
}

export async function updatePlanningItemFields(db: SQL, row: { workspaceId: string; itemId: string; title: string; description: string; acceptanceCriteria: string; status: string }) {
  await db`UPDATE planning_items SET title = ${row.title}, description = ${row.description}, acceptance_criteria = ${row.acceptanceCriteria}, status = ${row.status}, updated_at = now() WHERE id = ${row.itemId} AND workspace_id = ${row.workspaceId}`
}

export async function findItemDesignApprovedAt(db: SQL, itemId: string): Promise<Date | null> {
  const [row] = await db`SELECT design_approved_at AS "approvedAt" FROM planning_items WHERE id = ${itemId}`
  return row?.approvedAt ?? null
}

export async function replacePlanningParticipants(db: SQL, itemId: string, userIds: string[], { clear }: { clear: boolean }) {
  if (clear) await db`DELETE FROM planning_participants WHERE item_id = ${itemId}`
  for (const userId of userIds) await db`INSERT INTO planning_participants (item_id, user_id) VALUES (${itemId}, ${userId})`
}

export async function insertTaskDraft(
  db: SQL,
  row: { id: string; projectId: string; storyId: string; title: string; description: string; priority: string; assigneeId: string | null; createdBy: string; role: string | null },
) {
  await db`INSERT INTO tasks (id, project_id, story_id, title, description, status, priority, assignee_id, created_by, published_at, role) VALUES (${row.id}, ${row.projectId}, ${row.storyId}, ${row.title}, ${row.description}, 'backlog', ${row.priority}, ${row.assigneeId}, ${row.createdBy}, NULL, ${row.role})`
}

// Null leaves a field as it is. assigneeId is the exception: undefined keeps it, null clears it.
export async function updateTaskDraftRow(
  db: SQL,
  row: { workspaceId: string; taskId: string; title: string | null; description: string | null; assigneeId: string | null | undefined; priority: string | null },
) {
  const [task] = await db`UPDATE tasks SET title = coalesce(${row.title}, title), description = coalesce(${row.description}, description), assignee_id = CASE WHEN ${row.assigneeId === undefined} THEN assignee_id ELSE ${row.assigneeId ?? null} END, priority = coalesce(${row.priority}, priority), updated_at = now() WHERE id = ${row.taskId} AND published_at IS NULL AND story_id IN (SELECT id FROM planning_items WHERE workspace_id = ${row.workspaceId} AND kind = 'story' AND published_at IS NULL) RETURNING id, story_id AS "storyId", title, description, priority, assignee_id AS "assigneeId"`
  return task as Record<string, unknown> | undefined
}

export async function listPlanningTaskRows(db: SQL, workspaceId: string, includeDrafts: boolean) {
  return db`SELECT t.id, t.story_id AS "storyId", t.title, t.description, t.status, t.priority, t.assignee_id AS "assigneeId", t.published_at AS "publishedAt" FROM tasks t JOIN projects p ON p.id = t.project_id WHERE p.workspace_id = ${workspaceId} AND t.story_id IS NOT NULL AND (${includeDrafts} OR t.published_at IS NOT NULL) ORDER BY t.created_at LIMIT 500`
}

// What stops an epic from being published: a child not ready, no story at all, or a story without a task.
export async function findEpicPublishBlockers(db: SQL, epicId: string): Promise<{ notReady: boolean; storyCount: number; storyWithoutTask: boolean }> {
  const [notReady] = await db`SELECT 1 FROM planning_items WHERE parent_id = ${epicId} AND status <> 'ready' LIMIT 1`
  const [stories] = await db`SELECT count(*)::int AS count FROM planning_items WHERE parent_id = ${epicId} AND kind = 'story'`
  const [emptyStory] = await db`SELECT 1 FROM planning_items s WHERE s.parent_id = ${epicId} AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.story_id = s.id) LIMIT 1`
  return { notReady: notReady !== undefined, storyCount: Number(stories?.count ?? 0), storyWithoutTask: emptyStory !== undefined }
}

export async function publishEpicRows(db: SQL, epicId: string) {
  await db`UPDATE planning_items SET published_at = now(), updated_at = now() WHERE id = ${epicId} OR parent_id = ${epicId}`
  await db`UPDATE tasks SET published_at = now(), updated_at = now() WHERE story_id IN (SELECT id FROM planning_items WHERE parent_id = ${epicId}) AND published_at IS NULL`
}

export async function rebaseEpicSource(db: SQL, workspaceId: string, epicId: string, sourceVersion: number) {
  await db`UPDATE planning_items SET source_version = ${sourceVersion}, updated_at = now() WHERE workspace_id = ${workspaceId} AND (id = ${epicId} OR parent_id = ${epicId}) AND published_at IS NULL`
}

export async function findTaskAssignee(db: SQL, taskId: string): Promise<string | null> {
  const [task] = await db`SELECT assignee_id AS "assigneeId" FROM tasks WHERE id = ${taskId}`
  return task?.assigneeId ?? null
}
