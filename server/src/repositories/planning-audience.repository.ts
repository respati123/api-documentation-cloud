import type { SQL } from 'bun'

// The owner and editors with the given project roles. These are the people the planning service treats as PM or approver.
export async function listMembersWithDiscipline(db: SQL, workspaceId: string, disciplines: string[]): Promise<string[]> {
  const rows: Array<{ userId: string }> = await db`
    SELECT m.user_id AS "userId" FROM memberships m
    WHERE m.workspace_id = ${workspaceId} AND (m.role = 'owner' OR (m.role = 'editor' AND EXISTS (
      SELECT 1 FROM project_members pm JOIN projects p ON p.id = pm.project_id
      WHERE p.workspace_id = ${workspaceId} AND pm.user_id = m.user_id AND pm.discipline = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(disciplines)}::text)::jsonb)))
    )))`
  return rows.map((row) => row.userId)
}

export async function findDocumentVisibility(db: SQL, workspaceId: string, documentId: string): Promise<{ kind: string; status: string } | undefined> {
  const [row] = await db`SELECT kind, status FROM planning_documents WHERE id = ${documentId} AND workspace_id = ${workspaceId}`
  return row
}

export async function findItemPublished(db: SQL, workspaceId: string, itemId: string): Promise<boolean> {
  const [row] = await db`SELECT i.published_at IS NOT NULL AS published FROM issues i JOIN projects p ON p.id = i.project_id WHERE i.id = ${itemId} AND p.workspace_id = ${workspaceId}`
  return Boolean(row?.published)
}

export async function findCommentTarget(db: SQL, workspaceId: string, commentId: string): Promise<{ targetKind: string; targetId: string } | undefined> {
  const [row] = await db`SELECT target_kind AS "targetKind", target_id AS "targetId" FROM planning_comments WHERE id = ${commentId} AND workspace_id = ${workspaceId}`
  return row
}

// Members holding any of the project roles, whatever their workspace role. Reading follows the project role alone.
export async function listMembersWithAnyDiscipline(db: SQL, workspaceId: string, disciplines: string[]): Promise<string[]> {
  const rows: Array<{ userId: string }> = await db`
    SELECT DISTINCT pm.user_id AS "userId" FROM project_members pm JOIN projects p ON p.id = pm.project_id
    JOIN memberships m ON m.workspace_id = p.workspace_id AND m.user_id = pm.user_id
    WHERE p.workspace_id = ${workspaceId} AND pm.discipline = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(disciplines)}::text)::jsonb)))`
  return rows.map((row) => row.userId)
}

export async function listUserDisciplines(db: SQL, workspaceId: string, userId: string): Promise<string[]> {
  const rows: Array<{ discipline: string }> = await db`
    SELECT DISTINCT pm.discipline FROM project_members pm JOIN projects p ON p.id = pm.project_id
    WHERE p.workspace_id = ${workspaceId} AND pm.user_id = ${userId}`
  return rows.map((row) => row.discipline)
}

// The roles a member holds in one project. listUserDisciplines above joins every project of the workspace.
export async function listProjectDisciplines(db: SQL, projectId: string, userId: string): Promise<string[]> {
  const rows: Array<{ discipline: string }> = await db`SELECT discipline FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId}`
  return rows.map((row) => row.discipline)
}

export async function findTaskVisibility(db: SQL, workspaceId: string, taskId: string): Promise<{ published: boolean; assigneeId: string | null } | undefined> {
  const [row] = await db`SELECT t.published_at IS NOT NULL AS published, t.assignee_id AS "assigneeId" FROM issues t JOIN projects p ON p.id = t.project_id WHERE t.id = ${taskId} AND p.workspace_id = ${workspaceId} AND t.type IN ('task', 'bug', 'subtask')`
  return row
}
