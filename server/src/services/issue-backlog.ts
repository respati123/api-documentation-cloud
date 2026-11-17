import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { isBacklogItem, type IssueRow, RANK_STEP, rankBetween } from '@/models/issue'
import { type CursorKeys, cursorValues, encodeCursor, pageOf } from '@/lib/pagination'
import { findIssue, listBacklogPage, listSprintIssues, markPublished, neighbourRank, renumberRanks, updateIssueFields } from '@/repositories/issues.repository'
import { findProjectSettings } from '@/repositories/project-settings.repository'
import { listSprintRows, type SprintRow } from '@/repositories/sprints.repository'
import { type Actor, invalid, isAgent, type IssueScope, loadVisible, logEvent } from '@/services/issues'
import { resolveProjectRoles } from '@/services/project-roles'

export interface Placement {
  // The issue that ends up directly above the moved one, and the one directly below it. Give at least one.
  afterId?: string | null
  beforeId?: string | null
}

// Moves a backlog item. The PM and the tech lead order the backlog. An AI agent key never does.
export async function rankIssue(db: SQL, scope: IssueScope, actor: Actor, ref: string, placement: Placement): Promise<IssueRow> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  if (isAgent(actor)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  if (!roles.isApprover) throw new AppError('ROLE_NOT_ALLOWED')

  const afterId = placement.afterId ?? null
  const beforeId = placement.beforeId ?? null
  if (!isBacklogItem(issue.type) || (!afterId && !beforeId) || afterId === issue.id || beforeId === issue.id) throw invalid()

  await db.begin(async (tx) => {
    const place = async () => {
      const after = afterId ? await rankOf(tx, scope, afterId) : null
      const before = beforeId ? await rankOf(tx, scope, beforeId) : null
      if (after !== null && before !== null && after >= before) throw invalid()
      const above = before !== null && after === null ? await neighbourRank(tx, scope.projectId, before, 'above', issue.id) : after
      const below = after !== null && before === null ? await neighbourRank(tx, scope.projectId, after, 'below', issue.id) : before
      return rankBetween(above, below)
    }
    let rank = await place()
    // Two neighbours with no whole number between them: space the backlog out again, then place the item.
    if (rank === null) {
      await renumberRanks(tx, scope.projectId, RANK_STEP)
      rank = await place()
    }
    if (rank === null) throw invalid()
    await updateIssueFields(tx, scope.projectId, issue.id, { rank })
    await logEvent(tx, scope, actor, issue.id, 'issue.ranked', {})
  })
  return (await findIssue(db, scope.projectId, issue.id)) as IssueRow
}

async function rankOf(tx: SQL, scope: IssueScope, id: string): Promise<number> {
  const neighbour = await findIssue(tx, scope.projectId, id)
  if (!neighbour || !isBacklogItem(neighbour.type) || neighbour.rank === null) throw invalid()
  return neighbour.rank
}

// Makes a draft visible to every member of the project. Publishing again changes nothing.
export async function publishIssue(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<IssueRow> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  if (isAgent(actor)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  if (!roles.isApprover) throw new AppError('ROLE_NOT_ALLOWED')
  if (!issue.publishedAt) {
    await db.begin(async (tx) => {
      await markPublished(tx, scope.projectId, issue.id)
      await logEvent(tx, scope, actor, issue.id, 'issue.published', {})
    })
  }
  return (await findIssue(db, scope.projectId, issue.id)) as IssueRow
}

const SPRINT_ITEM_LIMIT = 500

// What the Backlog screen shows: the planned and active sprints with their items, then the items that belong to no
// sprint. Only that second part is paged, because it is the one that grows without bound.
export async function readBacklog(
  db: SQL,
  scope: IssueScope,
  actor: Actor,
  page: { limit: number; cursor: CursorKeys | null },
): Promise<{ sprints: Array<SprintRow & { issues: IssueRow[] }>; backlog: { items: IssueRow[]; nextCursor: string | null } }> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const visibility = { includeDrafts: roles.isApprover, viewerId: actor.userId }
  const after = cursorValues(page.cursor, ['r', 'n'])
  if (after && (Number.isNaN(Number(after.r)) || !Number.isInteger(Number(after.n)))) throw new AppError('PAGINATION_INVALID')

  const kanban = (await findProjectSettings(db, scope.projectId))?.mode === 'kanban'
  const open = kanban ? [] : (await listSprintRows(db, scope.projectId)).filter((sprint) => sprint.status !== 'closed')
  const sprints = await Promise.all(open.map(async (sprint) => ({ ...sprint, issues: await listSprintIssues(db, sprint.id, { ...visibility, limit: SPRINT_ITEM_LIMIT }) })))
  const rows = await listBacklogPage(db, scope.projectId, { ...visibility, limit: page.limit + 1, after: after ? { rank: Number(after.r), number: Number(after.n) } : null })
  const items = pageOf(rows, page.limit, (row) => encodeCursor({ r: String(row.rank), n: String(row.number) }))
  return { sprints, backlog: items }
}
