import type { SQL } from 'bun'
import type { ProjectRow, TaskPriority, TaskRow, TaskStatus } from '@/models/project'

export async function listProjects(db: SQL, workspaceId: string): Promise<ProjectRow[]> {
  return db`SELECT p.id, p.workspace_id AS "workspaceId", p.name, p.description, p.created_at AS "createdAt", count(t.id)::int AS "taskCount" FROM projects p LEFT JOIN tasks t ON t.project_id = p.id WHERE p.workspace_id = ${workspaceId} GROUP BY p.id ORDER BY p.updated_at DESC, p.id`
}

export async function ensureWorkspaceProject(db: SQL, workspaceId: string): Promise<ProjectRow> {
  const [existing] = await db`SELECT p.id, p.workspace_id AS "workspaceId", p.name, p.description, p.created_at AS "createdAt", count(t.id)::int AS "taskCount" FROM projects p LEFT JOIN tasks t ON t.project_id = p.id WHERE p.workspace_id = ${workspaceId} GROUP BY p.id ORDER BY p.created_at, p.id LIMIT 1`
  if (existing) return existing

  const [created] = await db`INSERT INTO projects (id, workspace_id, name, description, created_by) SELECT w.id, w.id, w.name, '', w.owner_id FROM workspaces w WHERE w.id = ${workspaceId} ON CONFLICT (id) DO NOTHING RETURNING id, workspace_id AS "workspaceId", name, description, created_by AS "createdBy", created_at AS "createdAt", 0::int AS "taskCount"`
  if (created) {
    await addProjectMember(db, created.id, created.createdBy, 'pm')
    return created
  }

  const [afterConflict] = await db`SELECT p.id, p.workspace_id AS "workspaceId", p.name, p.description, p.created_at AS "createdAt", count(t.id)::int AS "taskCount" FROM projects p LEFT JOIN tasks t ON t.project_id = p.id WHERE p.workspace_id = ${workspaceId} GROUP BY p.id ORDER BY p.created_at, p.id LIMIT 1`
  if (!afterConflict) throw new Error('Could not initialize workspace task board')
  return afterConflict
}

export async function listMemberProjects(db: SQL, workspaceId: string, userId: string, projectIds: string[]): Promise<ProjectRow[]> {
  return db`SELECT p.id, p.workspace_id AS "workspaceId", p.name, p.description, p.created_at AS "createdAt", count(t.id)::int AS "taskCount" FROM projects p JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ${userId} LEFT JOIN tasks t ON t.project_id = p.id WHERE p.workspace_id = ${workspaceId} AND p.id = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(projectIds)}::text)::jsonb))) GROUP BY p.id ORDER BY p.updated_at DESC, p.id`
}

export async function addProjectMember(db: SQL, projectId: string, userId: string, discipline: string): Promise<void> {
  await db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${projectId}, ${userId}, ${discipline}) ON CONFLICT (project_id, user_id) DO UPDATE SET discipline = EXCLUDED.discipline`
}

export async function listProjectMembers(db: SQL, projectId: string): Promise<Array<{ id: string; email: string; discipline: string }>> {
  return db`SELECT u.id, u.email, pm.discipline FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ${projectId} ORDER BY u.email`
}

export async function listWorkspaceMembers(db: SQL, workspaceId: string): Promise<Array<{ id: string; email: string; discipline: string | null }>> {
  return db`SELECT u.id, u.email, (SELECT pm.discipline FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE p.workspace_id = ${workspaceId} AND pm.user_id = u.id ORDER BY p.created_at, p.id LIMIT 1) AS discipline FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ${workspaceId} ORDER BY u.email`
}

// Shared columns for a task on the board. A task is locked while its story waits for design approval, unless it is UI/UX work.
const taskColumns = `t.id, t.project_id AS "projectId", t.title, t.description, t.status, t.priority, t.assignee_id AS "assigneeId", u.email AS "assigneeEmail", t.due_date::text AS "dueDate", t.position::text AS position, t.created_at AS "createdAt", t.updated_at AS "updatedAt", t.story_id AS "storyId", t.role, (t.role IS NOT NULL AND t.role <> 'ui_ux' AND s.id IS NOT NULL AND s.design_approved_at IS NULL AND s.status NOT IN ('in_progress', 'review', 'done')) AS locked, coalesce((SELECT array_agg(d.depends_on_id ORDER BY d.depends_on_id) FROM task_dependencies d WHERE d.task_id = t.id), ARRAY[]::text[]) AS "dependsOn", (SELECT count(*)::int FROM task_subtasks st WHERE st.task_id = t.id AND st.done) AS "subtaskDone", (SELECT count(*)::int FROM task_subtasks st WHERE st.task_id = t.id) AS "subtaskTotal"`
const taskJoins = 'FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id LEFT JOIN planning_items s ON s.id = t.story_id'

export async function listTasks(db: SQL, projectId: string): Promise<TaskRow[]> {
  return db`SELECT ${db.unsafe(taskColumns)} ${db.unsafe(taskJoins)} WHERE t.project_id = ${projectId} AND t.published_at IS NOT NULL ORDER BY t.status, t.position, t.created_at`
}

export async function findTaskInWorkspace(db: SQL, taskId: string, workspaceId: string): Promise<TaskRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(taskColumns)} ${db.unsafe(taskJoins)} WHERE t.id = ${taskId} AND t.project_id IN (SELECT id FROM projects WHERE workspace_id = ${workspaceId})`
  return row
}

export async function insertTask(db: SQL, input: { id: string; projectId: string; title: string; description: string; status: TaskStatus; priority: TaskPriority; assigneeId: string | null; dueDate: string | null; createdBy: string; role: string | null }): Promise<TaskRow> {
  await db`INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, due_date, created_by, role) VALUES (${input.id}, ${input.projectId}, ${input.title}, ${input.description}, ${input.status}, ${input.priority}, ${input.assigneeId}, ${input.dueDate}, ${input.createdBy}, ${input.role})`
  const [row] = await db`SELECT ${db.unsafe(taskColumns)} ${db.unsafe(taskJoins)} WHERE t.id = ${input.id}`
  return row
}

export async function updateTaskInWorkspace(db: SQL, taskId: string, workspaceId: string, input: { title?: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigneeId?: string | null; dueDate?: string | null; role?: string | null }): Promise<TaskRow | undefined> {
  const rows = await db`UPDATE tasks SET title = coalesce(${input.title ?? null}, title), description = coalesce(${input.description ?? null}, description), status = coalesce(${input.status ?? null}, status), priority = coalesce(${input.priority ?? null}, priority), assignee_id = CASE WHEN ${input.assigneeId === undefined} THEN assignee_id ELSE ${input.assigneeId ?? null} END, due_date = CASE WHEN ${input.dueDate === undefined} THEN due_date ELSE ${input.dueDate ?? null}::date END, role = CASE WHEN ${input.role === undefined} THEN role ELSE ${input.role ?? null} END, updated_at = now() WHERE id = ${taskId} AND published_at IS NOT NULL AND project_id IN (SELECT id FROM projects WHERE workspace_id = ${workspaceId}) AND (${input.assigneeId === undefined || input.assigneeId === null} OR EXISTS (SELECT 1 FROM projects p JOIN memberships m ON m.workspace_id = p.workspace_id WHERE p.id = tasks.project_id AND m.user_id = ${input.assigneeId ?? ''})) RETURNING id`
  if (rows.length === 0) return undefined
  return findTaskInWorkspace(db, taskId, workspaceId)
}

// Dependencies stay inside one project. The whole list is replaced on each change.
export async function replaceTaskDependencies(db: SQL, taskId: string, dependsOn: string[]): Promise<boolean> {
  return db.begin(async (tx) => {
    const ids = [...new Set(dependsOn)]
    const [valid] = await tx`SELECT count(*)::int AS count FROM tasks d JOIN tasks t ON t.project_id = d.project_id WHERE t.id = ${taskId} AND d.id <> ${taskId} AND d.id = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(ids)}::text)::jsonb)))`
    if (valid.count !== ids.length) return false
    await tx`DELETE FROM task_dependencies WHERE task_id = ${taskId}`
    for (const id of ids) await tx`INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (${taskId}, ${id})`
    return true
  })
}

export async function listSubtasks(db: SQL, taskId: string) {
  return db`SELECT st.id, st.title, st.done, u.email AS "assigneeEmail" FROM task_subtasks st LEFT JOIN users u ON u.id = st.assignee_id WHERE st.task_id = ${taskId} ORDER BY st.position, st.created_at`
}

export async function insertSubtask(db: SQL, input: { id: string; taskId: string; title: string; assigneeId: string | null }) {
  await db`INSERT INTO task_subtasks (id, task_id, title, assignee_id, position) VALUES (${input.id}, ${input.taskId}, ${input.title}, ${input.assigneeId}, (SELECT coalesce(max(position), 0) + 1 FROM task_subtasks WHERE task_id = ${input.taskId}))`
  const [row] = await db`SELECT st.id, st.title, st.done, u.email AS "assigneeEmail" FROM task_subtasks st LEFT JOIN users u ON u.id = st.assignee_id WHERE st.id = ${input.id}`
  return row
}

export async function setSubtaskDone(db: SQL, taskId: string, subtaskId: string, done: boolean) {
  const [row] = await db`UPDATE task_subtasks SET done = ${done} WHERE id = ${subtaskId} AND task_id = ${taskId} RETURNING id, title, done, (SELECT email FROM users WHERE id = task_subtasks.assignee_id) AS "assigneeEmail"`
  return row
}

export async function findAssignedTask(db: SQL, taskId: string, projectIds: string[], assigneeId: string): Promise<TaskRow | undefined> {
  const [row] = await db`SELECT t.id, t.project_id AS "projectId", t.title, t.description, t.status, t.priority, t.assignee_id AS "assigneeId", u.email AS "assigneeEmail", t.due_date::text AS "dueDate", t.position::text AS position, t.created_at AS "createdAt", t.updated_at AS "updatedAt" FROM tasks t JOIN memberships m ON m.user_id = ${assigneeId} LEFT JOIN users u ON u.id = t.assignee_id WHERE t.id = ${taskId} AND t.published_at IS NOT NULL AND t.project_id = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(projectIds)}::text)::jsonb))) AND t.assignee_id = ${assigneeId} AND m.workspace_id = (SELECT workspace_id FROM projects WHERE id = t.project_id)`
  return row
}

export async function listAssignedTasks(db: SQL, projectIds: string[], assigneeId: string): Promise<TaskRow[]> {
  return db`SELECT t.id, t.project_id AS "projectId", t.title, t.description, t.status, t.priority, t.assignee_id AS "assigneeId", u.email AS "assigneeEmail", t.due_date::text AS "dueDate", t.position::text AS position, t.created_at AS "createdAt", t.updated_at AS "updatedAt" FROM tasks t JOIN memberships m ON m.user_id = ${assigneeId} LEFT JOIN users u ON u.id = t.assignee_id WHERE t.published_at IS NOT NULL AND t.project_id = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(projectIds)}::text)::jsonb))) AND t.assignee_id = ${assigneeId} AND m.workspace_id = (SELECT workspace_id FROM projects WHERE id = t.project_id) ORDER BY t.status, t.position, t.created_at LIMIT 200`
}

export async function updateAssignedTaskStatus(db: SQL, taskId: string, projectIds: string[], assigneeId: string, status: TaskStatus): Promise<TaskRow | undefined> {
  const [row] = await db`UPDATE tasks SET status = ${status}, updated_at = now() WHERE id = ${taskId} AND published_at IS NOT NULL AND project_id = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(projectIds)}::text)::jsonb))) AND assignee_id = ${assigneeId} AND EXISTS (SELECT 1 FROM projects p JOIN memberships m ON m.workspace_id = p.workspace_id WHERE p.id = tasks.project_id AND m.user_id = ${assigneeId}) RETURNING id, project_id AS "projectId", title, description, status, priority, assignee_id AS "assigneeId", (SELECT email FROM users WHERE id = tasks.assignee_id) AS "assigneeEmail", due_date::text AS "dueDate", position::text AS position, created_at AS "createdAt", updated_at AS "updatedAt"`
  return row
}

export async function isWorkspaceMember(db: SQL, workspaceId: string, userId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
  return row !== undefined
}

export async function isProjectInWorkspace(db: SQL, projectId: string, workspaceId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM projects WHERE id = ${projectId} AND workspace_id = ${workspaceId}`
  return row !== undefined
}

export async function isProjectMemberInWorkspace(db: SQL, projectId: string, workspaceId: string, userId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE pm.project_id = ${projectId} AND p.workspace_id = ${workspaceId} AND pm.user_id = ${userId}`
  return row !== undefined
}

export async function isTaskAssigneeInProject(db: SQL, taskId: string, workspaceId: string, userId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM tasks t JOIN projects p ON p.id = t.project_id JOIN memberships m ON m.workspace_id = p.workspace_id AND m.user_id = ${userId} WHERE t.id = ${taskId} AND p.workspace_id = ${workspaceId}`
  return row !== undefined
}

export async function ensureAssigneeInWorkspace(db: SQL, workspaceId: string, assigneeId: string | null): Promise<boolean> {
  if (!assigneeId) return true
  return isWorkspaceMember(db, workspaceId, assigneeId)
}

export async function ensureAssigneeInProject(db: SQL, workspaceId: string, projectId: string, assigneeId: string | null): Promise<boolean> {
  if (!assigneeId) return true
  if (!(await isProjectInWorkspace(db, projectId, workspaceId))) return false
  return isWorkspaceMember(db, workspaceId, assigneeId)
}
