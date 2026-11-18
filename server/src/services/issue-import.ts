import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { type IssueRow } from '@/models/issue'
import { outlineFromMarkdown } from '@/models/prd-outline'
import { findIssue, listSourceEntries, setSourceReviewed } from '@/repositories/issues.repository'
import { findPlanningDocument } from '@/repositories/planning-documents.repository'
import { type Actor, insertNewIssue, invalid, isAgent, type IssueScope, loadVisible, logEvent } from '@/services/issues'
import { resolveProjectRoles } from '@/services/project-roles'

export interface OutlineStoryInput {
  title: string
  description?: string
  acceptanceCriteria?: string
  points?: number | null
  sourceSection?: string | null
}

export interface OutlineEpicInput {
  title: string
  description?: string
  sourceSection?: string | null
  stories?: OutlineStoryInput[]
}

const MAX_ISSUES = 200

// Makes draft epics and stories from an approved PRD, all linked to its current version, or none of them.
// Without an outline the headings of the PRD give it: a level-2 heading is an epic and a level-3 heading a story.
// An item that was already made from this document is left alone, so running it twice adds nothing.
// Only the PM does it, and an AI agent key may, because everything it makes is a draft.
export async function draftBacklogFromPrd(
  db: SQL,
  scope: IssueScope,
  actor: Actor,
  documentId: string,
  outline?: { epics: OutlineEpicInput[] },
): Promise<IssueRow[]> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  if (!roles.isPm) throw new AppError('ROLE_NOT_ALLOWED')
  const document = await findPlanningDocument(db, scope.workspaceId, documentId)
  if (!document) throw new AppError('PLANNING_NOT_FOUND')
  if (document.kind !== 'prd' || document.status !== 'approved' || document.sourceOutdated) throw new AppError('PLANNING_CONFLICT')

  const epics: OutlineEpicInput[] = outline?.epics ?? outlineFromMarkdown(document.content, document.title)
  const total = epics.reduce((sum, epic) => sum + 1 + (epic.stories?.length ?? 0), 0)
  if (epics.length === 0 || total > MAX_ISSUES) throw invalid()
  const sections = epics.flatMap((epic) => [epic.sourceSection, ...(epic.stories ?? []).map((story) => story.sourceSection)])
  for (const section of sections) {
    if (typeof section === 'string' && section.trim() !== '' && !document.content.includes(section.trim())) throw invalid()
  }

  const ids = await db.begin(async (tx) => {
    // A story is told apart by its epic too, so the same title under two epics makes two stories.
    const key = (type: string, title: string, section: string | null | undefined, parentId: string | null = null) => `${type}|${parentId ?? ''}|${section?.trim() || title.trim()}`
    const known = new Map((await listSourceEntries(tx, scope.projectId, document.id)).map((entry) => [key(entry.type, entry.title, entry.sourceSection, entry.parentId), entry.id]))
    const made: string[] = []
    const source = { sourceDocumentId: document.id, sourceVersion: document.currentVersion }

    for (const epic of epics) {
      const epicKey = key('epic', epic.title, epic.sourceSection)
      let epicId = known.get(epicKey)
      if (!epicId) {
        epicId = await insertNewIssue(tx, scope, actor, { type: 'epic', title: epic.title, description: epic.description, sourceSection: epic.sourceSection ?? null, ...source })
        known.set(epicKey, epicId)
        made.push(epicId)
      }
      for (const story of epic.stories ?? []) {
        const storyKey = key('story', story.title, story.sourceSection, epicId)
        if (known.has(storyKey)) continue
        const storyId = await insertNewIssue(tx, scope, actor, {
          type: 'story',
          parentId: epicId,
          title: story.title,
          description: story.description,
          acceptanceCriteria: story.acceptanceCriteria,
          points: story.points ?? null,
          sourceSection: story.sourceSection ?? null,
          ...source,
        })
        known.set(storyKey, storyId)
        made.push(storyId)
      }
    }
    return made
  })
  const rows = await Promise.all(ids.map((id) => findIssue(db, scope.projectId, id)))
  return rows as IssueRow[]
}

// The PM has read the new version of the source document and the issue still stands. The warning goes away until
// the document changes again. An AI agent key never does this.
export async function markSourceReviewed(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<IssueRow> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, ref)
  if (!roles.isPm) throw new AppError('ROLE_NOT_ALLOWED')
  if (isAgent(actor)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  if (!issue.sourceDocumentId) throw invalid()
  const document = await findPlanningDocument(db, scope.workspaceId, issue.sourceDocumentId)
  if (!document) throw new AppError('PLANNING_NOT_FOUND')
  await db.begin(async (tx) => {
    await setSourceReviewed(tx, scope.projectId, issue.id, document.currentVersion)
    await logEvent(tx, scope, actor, issue.id, 'issue.source_reviewed', { fromVersion: issue.sourceVersion, toVersion: document.currentVersion })
  })
  return (await findIssue(db, scope.projectId, issue.id)) as IssueRow
}
