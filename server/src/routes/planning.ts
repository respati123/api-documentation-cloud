import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { created, noContent, ok } from '@/lib/http'
import { addStoryTestCase, approveStoryDesign, attachStoryDesign, getStoryDetails, linkStoryContract, setStoryDodItem, updateStoryDetails, linkStoryDataModel, unlinkStoryDataModel } from '@/services/stories'
import { appActorOf } from '@/services/app-integrations'
import { addPlanningComment, canApprovePlanning, canManagePlanning, canReadPlanningDocuments, createPlanningDocument, createPlanningItem, createPlanningTaskDraft, deletePlanningDocument, getPlanningDocument, getPlanningDocumentFile, getPlanningDocumentVersion, listPlanningComments, listPlanningDocuments, listPlanningEvents, listPlanningItems, listPlanningTasks, publishPlanningEpic, rebasePlanningEpic, requirePlanningPm, resolvePlanningComment, revisePlanningDocument, setPlanningDocumentStatus, updatePlanningItem, updatePlanningTaskDraft, type TargetKind } from '@/services/planning'
import { extractDocumentFile } from '@/services/document-upload'

const targetKinds: TargetKind[] = ['document', 'epic', 'story', 'task']

export async function handlePlanningRoutes(ctx: AppContext, request: Request, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  if (!action.startsWith('planning')) return undefined
  const db = ctx.db
  const actorId = user.id
  if (action === 'planning/documents') {
    if (method === 'GET') return ok({ documents: await listPlanningDocuments(db, workspaceId, actorId), canManage: await canManagePlanning(db, workspaceId, actorId), canApprove: await canApprovePlanning(db, workspaceId, actorId), canReadDocuments: await canReadPlanningDocuments(db, workspaceId, actorId) })
    if (method === 'POST') {
      const body = await bodyOf(request)
      return created({ document: await createPlanningDocument(db, workspaceId, actorId, { kind: body.kind, title: body.title, content: body.content, sourceDocumentId: body.sourceDocumentId }) })
    }
  }
  if (action === 'planning/documents/upload' && method === 'POST') {
    await requirePlanningPm(db, workspaceId, actorId)
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) throw new AppError('PLANNING_INPUT_INVALID')
    const extracted = await extractDocumentFile(file)
    return created({ document: await createPlanningDocument(db, workspaceId, actorId, { kind: form.get('kind'), title: form.get('title'), sourceDocumentId: form.get('sourceDocumentId') ?? undefined, ...extracted }) })
  }
  const fileMatch = action.match(/^planning\/documents\/([\w-]+)\/file$/)
  if (fileMatch && method === 'GET') {
    const file = await getPlanningDocumentFile(db, workspaceId, fileMatch[1], actorId)
    return new Response(new Uint8Array(file.bytes).buffer, { headers: { 'Content-Type': file.mimeType, 'Content-Disposition': `attachment; filename="${file.fileName.replace(/["\\\r\n]/g, '_')}"`, 'Cache-Control': 'no-store' } })
  }
  const versionMatch = action.match(/^planning\/documents\/([\w-]+)\/versions\/(\d+)$/)
  if (versionMatch && method === 'GET') return ok({ version: await getPlanningDocumentVersion(db, workspaceId, versionMatch[1], Number(versionMatch[2]), actorId) })
  const documentMatch = action.match(/^planning\/documents\/([\w-]+)$/)
  if (documentMatch) {
    if (method === 'GET') return ok({ document: await getPlanningDocument(db, workspaceId, documentMatch[1], actorId) })
    if (method === 'PATCH') return ok({ document: await revisePlanningDocument(db, workspaceId, documentMatch[1], actorId, await bodyOf(request)) })
    if (method === 'DELETE') {
      await deletePlanningDocument(db, workspaceId, documentMatch[1], actorId)
      return noContent()
    }
  }
  const documentStatusMatch = action.match(/^planning\/documents\/([\w-]+)\/status$/)
  if (documentStatusMatch && method === 'POST') {
    const body = await bodyOf(request)
    return ok({ document: await setPlanningDocumentStatus(db, workspaceId, documentStatusMatch[1], actorId, body.status) })
  }
  if (action === 'planning/items') {
    if (method === 'GET') return ok({ items: await listPlanningItems(db, workspaceId, actorId), tasks: await listPlanningTasks(db, workspaceId, actorId) })
    if (method === 'POST') return created({ item: await createPlanningItem(db, workspaceId, actorId, await bodyOf(request)) })
  }
  const itemMatch = action.match(/^planning\/items\/([\w-]+)$/)
  if (itemMatch && method === 'PATCH') return ok({ item: await updatePlanningItem(db, workspaceId, itemMatch[1], actorId, await bodyOf(request)) })
  const publishMatch = action.match(/^planning\/items\/([\w-]+)\/publish$/)
  if (publishMatch && method === 'POST') return ok({ item: await publishPlanningEpic(db, workspaceId, publishMatch[1], actorId) })
  const rebaseMatch = action.match(/^planning\/items\/([\w-]+)\/rebase$/)
  if (rebaseMatch && method === 'POST') return ok({ item: await rebasePlanningEpic(db, workspaceId, rebaseMatch[1], actorId) })
  if (action === 'planning/task-drafts' && method === 'POST') return created({ task: await createPlanningTaskDraft(db, workspaceId, actorId, await bodyOf(request)) })
  const draftTaskMatch = action.match(/^planning\/task-drafts\/([\w-]+)$/)
  if (draftTaskMatch && method === 'PATCH') return ok({ task: await updatePlanningTaskDraft(db, workspaceId, draftTaskMatch[1], actorId, await bodyOf(request)) })
  if (action === 'planning/events' && method === 'GET') return ok({ events: await listPlanningEvents(db, workspaceId, actorId) })
  const storyMatch = action.match(/^planning\/stories\/([\w-]+)(?:\/(approve-design|designs|contracts|test-cases|data-models|dod\/([\w-]+)|data-models\/([\w-]+)))?$/)
  if (storyMatch) {
    const [, storyId, part, dodItemId, dataModelId] = storyMatch
    if (!part && method === 'GET') return ok({ story: await getStoryDetails(db, workspaceId, storyId, actorId) })
    if (!part && method === 'PATCH') return ok({ story: await updateStoryDetails(db, workspaceId, storyId, actorId, await bodyOf(request)) })
    if (part === 'approve-design' && method === 'POST') return ok({ story: await approveStoryDesign(db, workspaceId, storyId, actorId) })
    if (dodItemId && method === 'PATCH') return ok({ story: await setStoryDodItem(db, workspaceId, storyId, dodItemId, actorId, (await bodyOf(request)).done) })
    if (part === 'designs' && method === 'POST') return created({ design: await attachStoryDesign(db, workspaceId, storyId, actorId, await bodyOf(request)) })
    if (part === 'contracts' && method === 'POST') return created({ contract: await linkStoryContract(db, workspaceId, storyId, actorId, await bodyOf(request)) })
    if (part === 'test-cases' && method === 'POST') return created({ testCase: await addStoryTestCase(db, workspaceId, storyId, actorId, await bodyOf(request)) })
    if (part === 'data-models' && method === 'POST')
      return created({ dataModel: await linkStoryDataModel(db, ctx.apps, await appActorOf(db, actorId), workspaceId, storyId, await bodyOf(request)) })
    if (dataModelId && method === 'DELETE') {
      await unlinkStoryDataModel(db, workspaceId, storyId, actorId, dataModelId)
      return noContent()
    }
  }
  const commentMatch = action.match(/^planning\/(document|epic|story|task)\/([\w-]+)\/comments$/)
  if (commentMatch) {
    const kind = commentMatch[1] as TargetKind
    if (!targetKinds.includes(kind)) throw new AppError('PLANNING_INPUT_INVALID')
    if (method === 'GET') return ok({ comments: await listPlanningComments(db, workspaceId, actorId, kind, commentMatch[2]) })
    if (method === 'POST') return created({ comment: await addPlanningComment(db, workspaceId, actorId, kind, commentMatch[2], await bodyOf(request)) })
  }
  const resolveMatch = action.match(/^planning\/comments\/([\w-]+)\/resolve$/)
  if (resolveMatch && method === 'POST') {
    await resolvePlanningComment(db, workspaceId, actorId, resolveMatch[1])
    return noContent()
  }
  return undefined
}
