import type { SQL } from 'bun'
import { listMemberIds } from '@/repositories/memberships.repository'
import {
  findCommentTarget,
  findDocumentVisibility,
  findItemPublished,
  findTaskVisibility,
  listMembersWithAnyDiscipline,
  listMembersWithDiscipline,
} from '@/repositories/planning-audience.repository'

// What a write touched, so the change can be announced only to people who may read it.
export type AudienceTarget =
  | { kind: 'everyone' }
  | { kind: 'managers' }
  | { kind: 'document'; id: string }
  | { kind: 'item'; id: string }
  | { kind: 'task-thread'; id: string }
  | { kind: 'comment'; id: string }

// Reads the target from the route after /api/workspaces/{id}/. Board tasks, sub-tasks, and project roles are visible
// to every member. New documents, drafts, and task drafts start out visible to managers only.
export function audienceFromAction(action: string): AudienceTarget | null {
  let match = action.match(/^planning\/(document|epic|story|task)\/([\w-]+)\/comments$/)
  if (match) return commentTarget(match[1], match[2])
  match = action.match(/^planning\/comments\/([\w-]+)\/resolve$/)
  if (match) return { kind: 'comment', id: match[1] }
  match = action.match(/^planning\/documents\/([\w-]+)/)
  if (match && match[1] !== 'upload') return { kind: 'document', id: match[1] }
  if (action.startsWith('planning/documents') || action.startsWith('planning/task-drafts') || action === 'planning/items') return { kind: 'managers' }
  match = action.match(/^planning\/(?:items|stories)\/([\w-]+)/)
  if (match) return { kind: 'item', id: match[1] }
  if (/^tasks\//.test(action) || /^projects\/[\w-]+\/(tasks|members)$/.test(action)) return { kind: 'everyone' }
  return null
}

export function commentTarget(targetKind: string, targetId: string): AudienceTarget {
  if (targetKind === 'document') return { kind: 'document', id: targetId }
  if (targetKind === 'task') return { kind: 'task-thread', id: targetId }
  return { kind: 'item', id: targetId }
}

// The PM and the tech lead read drafts. Besides them, a viewer holding the tech lead role reads the BRD and PRDs from
// team review on, and backend reads the BRD and approved PRDs.
const managers = (db: SQL, workspaceId: string) => listMembersWithDiscipline(db, workspaceId, ['pm', 'tech_lead'])
async function documentReaders(db: SQL, workspaceId: string, disciplines: string[]): Promise<string[]> {
  return unique([...(await managers(db, workspaceId)), ...(await listMembersWithAnyDiscipline(db, workspaceId, disciplines))])
}

// The member ids that may read the target, following the read rules of the planning service.
export async function planningAudience(db: SQL, workspaceId: string, target: AudienceTarget): Promise<string[]> {
  if (target.kind === 'everyone') return listMemberIds(db, workspaceId)
  if (target.kind === 'managers') return managers(db, workspaceId)
  if (target.kind === 'comment') {
    const found = await findCommentTarget(db, workspaceId, target.id)
    return found ? planningAudience(db, workspaceId, commentTarget(found.targetKind, found.targetId)) : managers(db, workspaceId)
  }
  if (target.kind === 'document') {
    const document = await findDocumentVisibility(db, workspaceId, target.id)
    if (document?.status === 'approved') return documentReaders(db, workspaceId, ['tech_lead', 'backend'])
    if (document?.kind === 'prd' && document.status === 'review_team') return documentReaders(db, workspaceId, ['tech_lead'])
    return managers(db, workspaceId)
  }
  // Published epics, stories, and tasks, with their discussions, are open to every member. Drafts stay with the managers.
  if (target.kind === 'task-thread') {
    const task = await findTaskVisibility(db, workspaceId, target.id)
    return task?.published ? listMemberIds(db, workspaceId) : managers(db, workspaceId)
  }
  return (await findItemPublished(db, workspaceId, target.id)) ? listMemberIds(db, workspaceId) : managers(db, workspaceId)
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)]
}
