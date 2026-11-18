import type { SQL } from 'bun'
import type { ProjectRow, TaskPriority, TaskRow, TaskStatus } from '@/models/project'
import { RANK_STEP } from '@/models/issue'
import { makeProjectKey } from '@/models/project-key'
import { allocateIssueNumber, insertIssue, lastRank } from '@/repositories/issues.repository'

export async function listProjects(db: SQL, workspaceId: string): Promise<ProjectRow[]> {
  return db`SELECT p.id, p.workspace_id AS "workspaceId", p.name, p.description, p.key, p.mode, p.product_goal AS "productGoal", p.created_at AS "createdAt", count(t.id)::int AS "taskCount" FROM projects p LEFT JOIN issues t ON t.project_id = p.id AND t.type IN ('task', 'bug', 'subtask') WHERE p.workspace_id = ${workspaceId} GROUP BY p.id ORDER BY p.updated_at DESC, p.id`
}

export async function ensureWorkspaceProject(db: SQL, workspaceId: string): Promise<ProjectRow> {
  const [existing] = await db`SELECT p.id, p.workspace_id AS "workspaceId", p.name, p.description, p.key, p.mode, p.product_goal AS "productGoal", p.created_at AS "createdAt", count(t.id)::int AS "taskCount" FROM projects p LEFT JOIN issues t ON t.project_id = p.id AND t.type IN ('task', 'bug', 'subtask') WHERE p.workspace_id = ${workspaceId} GROUP BY p.id ORDER BY p.created_at, p.id LIMIT 1`
  if (existing) return existing

  // The workspace has no project yet, so its first one takes the plain key for the workspace name.
  const [workspace] = await db`SELECT name FROM workspaces WHERE id = ${workspaceId}`
  const key = makeProjectKey(workspace?.name ?? '', [])
  const [created] = await db`INSERT INTO projects (id, workspace_id, name, description, created_by, key) SELECT w.id, w.id, w.name, '', w.owner_id, ${key}::text FROM workspaces w WHERE w.id = ${workspaceId} ON CONFLICT (id) DO NOTHING RETURNING id, workspace_id AS "workspaceId", name, description, key, mode, product_goal AS "productGoal", created_by AS "createdBy", created_at AS "createdAt", 0::int AS "taskCount"`
  if (created) {
    await addProjectMember(db, created.id, created.createdBy, 'pm')
    return created
  }

  const [afterConflict] = await db`SELECT p.id, p.workspace_id AS "workspaceId", p.name, p.description, p.key, p.mode, p.product_goal AS "productGoal", p.created_at AS "createdAt", count(t.id)::int AS "taskCount" FROM projects p LEFT JOIN issues t ON t.project_id = p.id AND t.type IN ('task', 'bug', 'subtask') WHERE p.workspace_id = ${workspaceId} GROUP BY p.id ORDER BY p.created_at, p.id LIMIT 1`
  if (!afterConflict) throw new Error('Could not initialize workspace task board')
  return afterConflict
}

export async function listMemberProjects(db: SQL, workspaceId: string, userId: string, projectIds: string[]): Promise<ProjectRow[]> {
  return db`SELECT p.id, p.workspace_id AS "workspaceId", p.name, p.description, p.key, p.mode, p.product_goal AS "productGoal", p.created_at AS "createdAt", count(t.id)::int AS "taskCount" FROM projects p JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ${userId} LEFT JOIN issues t ON t.project_id = p.id AND t.type IN ('task', 'bug', 'subtask') WHERE p.workspace_id = ${workspaceId} AND p.id = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(projectIds)}::text)::jsonb))) GROUP BY p.id ORDER BY p.updated_at DESC, p.id`
}

export async function addProjectMember(db: SQL, projectId: string, userId: string, discipline: string): Promise<void> {
  await db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${projectId}, ${userId}, ${discipline}) ON CONFLICT DO NOTHING`
}

// Replaces the member's roles in the project. An empty list takes the member out of the project.
export async function setProjectMemberDisciplines(db: SQL, projectId: string, userId: string, disciplines: string[]): Promise<void> {
  await db.begin(async (tx) => {
    await tx`DELETE FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId}`
    for (const discipline of disciplines) await tx`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${projectId}, ${userId}, ${discipline})`
  })
}

// `discipline` is the first role, kept for clients that read one role. `disciplines` holds them all.
export async function listProjectMembers(db: SQL, projectId: string): Promise<Array<{ id: string; email: string; discipline: string; disciplines: string[] }>> {
  return db`SELECT u.id, u.email, (array_agg(pm.discipline ORDER BY pm.created_at, pm.discipline))[1] AS discipline, array_agg(pm.discipline ORDER BY pm.created_at, pm.discipline) AS disciplines FROM project_members pm JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ${projectId} GROUP BY u.id, u.email ORDER BY u.email`
}

export async function listWorkspaceMembers(db: SQL, workspaceId: string): Promise<Array<{ id: string; email: string; discipline: string | null; disciplines: string[] }>> {
  return db`SELECT u.id, u.email, r.disciplines[1] AS discipline, COALESCE(r.disciplines, '{}') AS disciplines FROM memberships m JOIN users u ON u.id = m.user_id LEFT JOIN LATERAL (SELECT array_agg(pm.discipline ORDER BY p.created_at, pm.created_at, pm.discipline) AS disciplines FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE p.workspace_id = ${workspaceId} AND pm.user_id = u.id) r ON true WHERE m.workspace_id = ${workspaceId} ORDER BY u.email`
}

// Each workspace the member belongs to, with the roles the owner gave them there.
export async function listUserRolesByWorkspace(db: SQL, userId: string): Promise<Array<{ id: string; name: string; roles: string[] }>> {
  return db`SELECT w.id, w.name, COALESCE(array_agg(DISTINCT pm.discipline) FILTER (WHERE pm.discipline IS NOT NULL), '{}') AS roles FROM memberships m JOIN workspaces w ON w.id = m.workspace_id LEFT JOIN projects p ON p.workspace_id = w.id LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = m.user_id WHERE m.user_id = ${userId} GROUP BY w.id, w.name ORDER BY w.name, w.id LIMIT 200`
}

// Tasks, bugs, and sub-tasks live in the issues table, and the board shows them as tasks. A task that was backlog is todo.
const WORK = `i.type IN ('task', 'bug', 'subtask')`
const workStatus = (status: string | null | undefined): string | null => (status === 'backlog' ? 'todo' : (status ?? null))

// Shared columns for a task on the board. A sub-task is locked while its story waits for design approval, unless it is UI/UX work.
// Its dependencies are the issues that block it, and its sub-task count is the lines of its checklist.
const taskColumns = `i.id, i.project_id AS "projectId", i.title, i.description, i.status, i.priority, i.assignee_id AS "assigneeId", u.email AS "assigneeEmail", i.due_date::text AS "dueDate", coalesce(i.rank, 0)::text AS position, i.created_at AS "createdAt", i.updated_at AS "updatedAt", CASE WHEN s.type = 'story' THEN i.parent_id END AS "storyId", i.role, (i.type = 'subtask' AND i.role IS NOT NULL AND i.role <> 'ui_ux' AND s.type = 'story' AND s.design_approved_at IS NULL AND s.status NOT IN ('in_progress', 'in_qa', 'done')) AS locked, coalesce((SELECT array_agg(l.from_id ORDER BY l.from_id) FROM issue_links l WHERE l.to_id = i.id AND l.kind = 'blocks'), ARRAY[]::text[]) AS "dependsOn", (SELECT count(*)::int FROM issue_checklist_items c WHERE c.issue_id = i.id AND c.done) AS "subtaskDone", (SELECT count(*)::int FROM issue_checklist_items c WHERE c.issue_id = i.id) AS "subtaskTotal"`
const taskJoins = 'FROM issues i LEFT JOIN users u ON u.id = i.assignee_id LEFT JOIN issues s ON s.id = i.parent_id'
// The columns an agent sees for its own tasks.
const plainTaskColumns = `i.id, i.project_id AS "projectId", i.title, i.description, i.status, i.priority, i.assignee_id AS "assigneeId", u.email AS "assigneeEmail", i.due_date::text AS "dueDate", coalesce(i.rank, 0)::text AS position, i.created_at AS "createdAt", i.updated_at AS "updatedAt"`
const projectIdList = (projectIds: string[]) => JSON.stringify(projectIds)

export async function listTasks(db: SQL, projectId: string): Promise<TaskRow[]> {
  return db`SELECT ${db.unsafe(taskColumns)} ${db.unsafe(taskJoins)} WHERE i.project_id = ${projectId} AND ${db.unsafe(WORK)} AND i.published_at IS NOT NULL ORDER BY i.status, coalesce(i.rank, 0), i.created_at`
}

export async function findTaskInWorkspace(db: SQL, taskId: string, workspaceId: string): Promise<TaskRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(taskColumns)} ${db.unsafe(taskJoins)} WHERE i.id = ${taskId} AND ${db.unsafe(WORK)} AND i.project_id IN (SELECT id FROM projects WHERE workspace_id = ${workspaceId})`
  return row
}

// A loose task is a backlog item, ranked after the others. A role belongs to a sub-task only, so a loose task has none.
export async function insertTask(db: SQL, input: { id: string; projectId: string; title: string; description: string; status: TaskStatus; priority: TaskPriority; assigneeId: string | null; dueDate: string | null; createdBy: string; role: string | null }): Promise<TaskRow> {
  await insertIssue(db, {
    id: input.id,
    projectId: input.projectId,
    number: await allocateIssueNumber(db, input.projectId),
    type: 'task',
    parentId: null,
    title: input.title,
    description: input.description,
    acceptanceCriteria: '',
    status: workStatus(input.status),
    points: null,
    priority: input.priority,
    rank: ((await lastRank(db, input.projectId)) ?? 0) + RANK_STEP,
    role: null,
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    sourceDocumentId: null,
    sourceVersion: null,
    sourceSection: null,
    published: true,
    createdBy: input.createdBy,
  })
  const [row] = await db`SELECT ${db.unsafe(taskColumns)} ${db.unsafe(taskJoins)} WHERE i.id = ${input.id}`
  return row
}

export async function updateTaskInWorkspace(db: SQL, taskId: string, workspaceId: string, input: { title?: string; description?: string; status?: TaskStatus; priority?: TaskPriority; assigneeId?: string | null; dueDate?: string | null; role?: string | null }): Promise<TaskRow | undefined> {
  const rows = await db`UPDATE issues SET title = coalesce(${input.title ?? null}, title), description = coalesce(${input.description ?? null}, description), status = coalesce(${workStatus(input.status)}, status), priority = coalesce(${input.priority ?? null}, priority), assignee_id = CASE WHEN ${input.assigneeId === undefined} THEN assignee_id ELSE ${input.assigneeId ?? null} END, due_date = CASE WHEN ${input.dueDate === undefined} THEN due_date ELSE ${input.dueDate ?? null}::date END, role = CASE WHEN type = 'subtask' THEN coalesce(${input.role ?? null}, role) ELSE NULL END, updated_at = now() WHERE id = ${taskId} AND type IN ('task', 'bug', 'subtask') AND published_at IS NOT NULL AND project_id IN (SELECT id FROM projects WHERE workspace_id = ${workspaceId}) AND (${input.assigneeId === undefined || input.assigneeId === null} OR EXISTS (SELECT 1 FROM projects p JOIN memberships m ON m.workspace_id = p.workspace_id WHERE p.id = issues.project_id AND m.user_id = ${input.assigneeId ?? ''})) RETURNING id`
  if (rows.length === 0) return undefined
  return findTaskInWorkspace(db, taskId, workspaceId)
}

// Dependencies stay inside one project. The whole list is replaced on each change. A task that depends on another is
// blocked by it, so each one becomes a link from the blocking issue to the task. An epic cannot block.
export async function replaceTaskDependencies(db: SQL, taskId: string, dependsOn: string[]): Promise<boolean> {
  return db.begin(async (tx) => {
    const ids = [...new Set(dependsOn)]
    const [valid] = await tx`SELECT count(*)::int AS count FROM issues d JOIN issues t ON t.project_id = d.project_id WHERE t.id = ${taskId} AND d.id <> ${taskId} AND d.type <> 'epic' AND d.id = ANY(ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(ids)}::text)::jsonb)))`
    if (valid.count !== ids.length) return false
    await tx`DELETE FROM issue_links WHERE to_id = ${taskId} AND kind = 'blocks'`
    for (const id of ids) await tx`INSERT INTO issue_links (id, from_id, to_id, kind, created_by) VALUES (${crypto.randomUUID()}, ${id}, ${taskId}, 'blocks', (SELECT created_by FROM issues WHERE id = ${taskId}))`
    return true
  })
}

// The lines of the checklist of a task. A line has no assignee.
export async function listSubtasks(db: SQL, taskId: string) {
  return db`SELECT c.id, c.title, c.done, NULL::text AS "assigneeEmail" FROM issue_checklist_items c WHERE c.issue_id = ${taskId} ORDER BY c.position, c.created_at`
}

export async function insertSubtask(db: SQL, input: { id: string; taskId: string; title: string; assigneeId: string | null }) {
  await db`INSERT INTO issue_checklist_items (id, issue_id, title, position) VALUES (${input.id}, ${input.taskId}, ${input.title}, (SELECT coalesce(max(position), 0) + 1 FROM issue_checklist_items WHERE issue_id = ${input.taskId}))`
  const [row] = await db`SELECT c.id, c.title, c.done, NULL::text AS "assigneeEmail" FROM issue_checklist_items c WHERE c.id = ${input.id}`
  return row
}

export async function setSubtaskDone(db: SQL, taskId: string, subtaskId: string, done: boolean) {
  const [row] = await db`UPDATE issue_checklist_items SET done = ${done} WHERE id = ${subtaskId} AND issue_id = ${taskId} RETURNING id, title, done, NULL::text AS "assigneeEmail"`
  return row
}

export async function findAssignedTask(db: SQL, taskId: string, projectIds: string[], assigneeId: string): Promise<TaskRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(plainTaskColumns)} FROM issues i JOIN memberships m ON m.user_id = ${assigneeId} LEFT JOIN users u ON u.id = i.assignee_id WHERE i.id = ${taskId} AND ${db.unsafe(WORK)} AND i.published_at IS NOT NULL AND i.project_id = ANY(ARRAY(SELECT jsonb_array_elements_text((${projectIdList(projectIds)}::text)::jsonb))) AND i.assignee_id = ${assigneeId} AND m.workspace_id = (SELECT workspace_id FROM projects WHERE id = i.project_id)`
  return row
}

export async function listAssignedTasks(db: SQL, projectIds: string[], assigneeId: string): Promise<TaskRow[]> {
  return db`SELECT ${db.unsafe(plainTaskColumns)} FROM issues i JOIN memberships m ON m.user_id = ${assigneeId} LEFT JOIN users u ON u.id = i.assignee_id WHERE ${db.unsafe(WORK)} AND i.published_at IS NOT NULL AND i.project_id = ANY(ARRAY(SELECT jsonb_array_elements_text((${projectIdList(projectIds)}::text)::jsonb))) AND i.assignee_id = ${assigneeId} AND m.workspace_id = (SELECT workspace_id FROM projects WHERE id = i.project_id) ORDER BY i.status, coalesce(i.rank, 0), i.created_at LIMIT 200`
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
  const [row] = await db`SELECT 1 FROM issues t JOIN projects p ON p.id = t.project_id JOIN memberships m ON m.workspace_id = p.workspace_id AND m.user_id = ${userId} WHERE t.id = ${taskId} AND t.type IN ('task', 'bug', 'subtask') AND p.workspace_id = ${workspaceId}`
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

export async function hasProjectDiscipline(db: SQL, projectId: string, userId: string, discipline: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM project_members WHERE project_id = ${projectId} AND user_id = ${userId} AND discipline = ${discipline}`
  return row !== undefined
}
