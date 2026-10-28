import type { WorkspaceVariables } from '@/models/workspace'
import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { broadcastWorkspaceUpdate } from '@/services/events'
import { created, ok } from '@/lib/http'
import { cursorText, decodeCursor, encodeCursor, pageOf, readLimit } from '@/lib/pagination'
import { emptyWorkspaceVariables, parseJson, parseSnapshot, sanitizeWorkspaceVariables, validateTree, validateWorkspaceVariables } from '@/lib/validation'
import { randomUUID } from 'node:crypto'
import { requireRole } from '@/services/access'


export async function handleSync(ctx: AppContext, request: Request, url: URL, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx
  if (method === 'GET' && action === 'sync/pull') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const [workspace] = await db`SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", c.parent_ids AS "parentIds", c.message, c.snapshot, c.created_at AS "createdAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE w.id = ${workspaceId} AND m.user_id = ${user.id}`
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
    const snapshot = parseSnapshot(parseJson<unknown>(workspace.snapshot, []))
    const { snapshot: _snapshot, ...workspaceData } = workspace
    return ok({ workspace: { ...workspaceData, parentIds: parseJson<string[]>(workspace.parentIds, []), ...snapshot } })
  }

  if (method === 'GET' && action === 'sync/history') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const limit = readLimit(url)
    const cursor = decodeCursor(url.searchParams.get('cursor'))
    const cursorAt = cursorText(cursor, 't')
    const cursorId = cursorText(cursor, 'i')
    const rows: Array<{ id: unknown; parentIds: unknown; message: unknown; createdAt: string | Date; authorEmail: unknown; sortAt: string }> = await db`SELECT * FROM (SELECT c.id, c.parent_ids AS "parentIds", c.message, c.created_at AS "createdAt", u.email AS "authorEmail", c.created_at::text AS "sortAt" FROM commits c JOIN users u ON u.id = c.author_id WHERE c.workspace_id = ${workspaceId}) q WHERE ${cursorAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id::text) < (${cursorAt}::timestamptz, ${cursorId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${limit + 1}`
    const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: String(row.id) }))
    const commits = page.items.map((row) => ({
      id: String(row.id),
      parentIds: parseJson<string[]>(row.parentIds, []),
      message: String(row.message),
      createdAt: row.createdAt,
      authorEmail: String(row.authorEmail)
    }))
    return ok({ commits }, { nextCursor: page.nextCursor })
  }

  const historyCommitMatch = action.match(/^sync\/history\/([\w-]+)$/)

  if (method === 'GET' && historyCommitMatch) {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const [row] = await db`SELECT id, parent_ids AS "parentIds", message, snapshot, created_at AS "createdAt" FROM commits WHERE workspace_id = ${workspaceId} AND id = ${historyCommitMatch[1]}`
    if (!row) throw new AppError('COMMIT_NOT_FOUND')
    return ok({ commit: {
      id: String(row.id),
      parentIds: parseJson<string[]>(row.parentIds, []),
      message: String(row.message),
      createdAt: row.createdAt,
      ...parseSnapshot(parseJson<unknown>(row.snapshot, []))
    } })
  }

  const restoreMatch = action.match(/^sync\/restore\/([\w-]+)$/)

  if (method === 'POST' && restoreMatch) {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor'])
    const sourceId = restoreMatch[1]
    const result = await db.begin(async (tx) => {
      const [workspace] = await tx`SELECT head_commit_id AS "headCommitId" FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`
      if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
      if (workspace.headCommitId === sourceId) throw new AppError('VERSION_ALREADY_LATEST')
      const [source] = await tx`SELECT snapshot FROM commits WHERE workspace_id = ${workspaceId} AND id = ${sourceId}`
      if (!source) throw new AppError('COMMIT_NOT_FOUND')
      const snapshot = parseSnapshot(parseJson<unknown>(source.snapshot, []))
      const restoredId = randomUUID()
      const parents = workspace.headCommitId ? [workspace.headCommitId] : []
      const message = `Restore to ${sourceId.slice(0, 7)}`
      await tx`INSERT INTO commits (id, workspace_id, author_id, parent_ids, message, snapshot) VALUES (${restoredId}, ${workspaceId}, ${user.id}, ${JSON.stringify(parents)}::jsonb, ${message}, ${JSON.stringify(snapshot)}::jsonb)`
      await tx`UPDATE workspaces SET head_commit_id = ${restoredId} WHERE id = ${workspaceId}`
      return { headId: restoredId, message }
    })
    await broadcastWorkspaceUpdate(ctx, workspaceId, result.headId, result.message, user, 1)
    return created({ headCommitId: result.headId })
  }

  if (method === 'POST' && action === 'sync/push') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor'])
    const body = await bodyOf(request)
    if (!Array.isArray(body.commits) || body.commits.length === 0 || body.commits.length > 100) throw new AppError('PUSH_COMMITS_COUNT_INVALID')
    const commits = body.commits as Record<string, unknown>[]
    for (const commit of commits) {
      const variables = commit.variables === undefined ? emptyWorkspaceVariables() : commit.variables
      if (typeof commit.id !== 'string' || !Array.isArray(commit.parentIds) || typeof commit.message !== 'string' || !validateTree(commit.tree) || !validateWorkspaceVariables(variables)) throw new AppError('PUSH_COMMIT_INVALID')
    }
    const result = await db.begin(async (tx) => {
      const [workspace] = await tx`SELECT head_commit_id AS "headCommitId" FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`
      if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
      let headId = workspace.headCommitId as string | null
      for (const commit of commits) {
        const parents = commit.parentIds as string[]
        if (headId && !parents.includes(headId)) {
          const [remote] = await tx`SELECT id, parent_ids AS "parentIds", message, snapshot, created_at AS "createdAt" FROM commits WHERE id = ${headId}`
          const snapshot = remote ? parseSnapshot(parseJson<unknown>(remote.snapshot, [])) : null
          const { snapshot: _snapshot, ...remoteData } = remote ?? {}
          return { conflict: remote && snapshot ? { ...remoteData, parentIds: parseJson<string[]>(remote.parentIds, []), ...snapshot } : null }
        }
        if (!headId && parents.length > 0) return { conflict: null }
        const variables = sanitizeWorkspaceVariables(commit.variables === undefined ? emptyWorkspaceVariables() : commit.variables as WorkspaceVariables)
        await tx`INSERT INTO commits (id, workspace_id, author_id, parent_ids, message, snapshot) VALUES (${commit.id}, ${workspaceId}, ${user.id}, ${JSON.stringify(parents)}::jsonb, ${commit.message}, ${JSON.stringify({ tree: commit.tree, variables })}::jsonb) ON CONFLICT (id) DO NOTHING`
        headId = commit.id as string
        await tx`UPDATE workspaces SET head_commit_id = ${headId} WHERE id = ${workspaceId}`
      }
      return { headId }
    })
    if ('conflict' in result) throw new AppError('SYNC_REMOTE_ADVANCED', { details: { remote: result.conflict } })
    if (result.headId) {
      const lastCommit = commits[commits.length - 1]
      await broadcastWorkspaceUpdate(ctx, workspaceId, result.headId, typeof lastCommit.message === 'string' ? lastCommit.message : 'Workspace updated', user, commits.length)
    }
    return created({ headCommitId: result.headId })
  }
  return undefined
}
