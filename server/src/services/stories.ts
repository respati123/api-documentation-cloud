import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { isRecord } from '@/lib/validation'
import { type CollectionRequest, isWorkRole, storyStage, type WorkRole } from '@/models/story'
import {
  countDesigns,
  findHeadSnapshot,
  findStory,
  insertContractLink,
  insertDesign,
  insertTestCase,
  isStoryParticipantAny,
  listStoryParticipantIds,
  listContractLinks,
  listDesigns,
  listDodItems,
  listTestCases,
  replaceDodItems,
  setDesignApproval,
  setDodDone,
  updateStoryText,
} from '@/repositories/stories.repository'
import { insertPlanningEvent } from '@/repositories/planning-events.repository'
import { findUserById } from '@/repositories/users.repository'
import { deleteDataModel, findAppLink, insertDataModel, listDataModels } from '@/repositories/app-links.repository'
import type { AppsClient } from '@/services/apps-client'
import type { OidcUser } from '@/services/oidc-keys'
import { notify } from '@/services/notifications'
import { canManagePlanning, getPlanningItem, type PlanningVia, requirePlanningApprover, requirePlanningPm } from '@/services/planning'

function textOf(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new AppError('PLANNING_INPUT_INVALID')
  return value.trim()
}

function linesOf(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value) || value.length > maxItems || value.some((line) => typeof line !== 'string' || line.length > 1000)) throw new AppError('PLANNING_INPUT_INVALID')
  return (value as string[]).map((line) => line.trim()).filter(Boolean)
}

async function storyOf(db: SQL, workspaceId: string, storyId: string) {
  const story = await findStory(db, workspaceId, storyId)
  if (!story) throw new AppError('PLANNING_NOT_FOUND')
  return story
}

// Artifacts and the Definition of Done are written by the PM or by a participant of the story.
async function requireContributor(db: SQL, workspaceId: string, storyId: string, userId: string, via?: PlanningVia) {
  await getPlanningItem(db, workspaceId, storyId, userId, via)
  if (await canManagePlanning(db, workspaceId, userId, via)) return
  if (!(await isStoryParticipantAny(db, storyId, userId))) throw new AppError('ROLE_NOT_ALLOWED')
}

export function collectionRequests(snapshot: unknown): Map<string, CollectionRequest> {
  const found = new Map<string, CollectionRequest>()
  const walk = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return
    for (const node of nodes) {
      if (!isRecord(node)) continue
      if (node.kind === 'request' && typeof node.id === 'string')
        found.set(node.id, { id: node.id, method: String(node.method ?? 'GET').toUpperCase(), url: String(node.url ?? ''), name: String(node.name ?? '') })
      if (node.kind === 'folder') walk(node.children)
    }
  }
  if (isRecord(snapshot)) walk(snapshot.tree)
  return found
}

export function contractPath(url: string): string {
  return url.replace(/^\{\{[^}]+\}\}/, '').replace(/^https?:\/\/[^/]+/, '') || url
}

export async function getStoryDetails(db: SQL, workspaceId: string, storyId: string, userId: string, via?: PlanningVia) {
  await getPlanningItem(db, workspaceId, storyId, userId, via)
  const story = await storyOf(db, workspaceId, storyId)
  const [dod, designs, links, testCases, snapshot, dataModels] = await Promise.all([
    listDodItems(db, storyId),
    listDesigns(db, storyId),
    listContractLinks(db, storyId),
    listTestCases(db, storyId),
    findHeadSnapshot(db, workspaceId),
    listDataModels(db, storyId),
  ])
  const requests = collectionRequests(snapshot)
  return {
    storyId,
    stage: storyStage(story.status, story.designApprovedAt, designs.length),
    userStory: { role: story.userStoryRole, action: story.userStoryAction, benefit: story.userStoryBenefit },
    flow: story.flow,
    definitionOfDone: dod,
    designs,
    dataModels: dataModels.map((model) => ({ id: model.id, projectId: model.appProjectId, projectName: model.projectName, tableId: model.tableId, tableName: model.tableName })),
    designApprovedBy: story.designApprovedByEmail,
    designApprovedAt: story.designApprovedAt,
    contracts: links.map((link) => {
      const request = requests.get(link.requestId)
      return {
        id: link.id,
        requestId: link.requestId,
        method: request?.method ?? 'GET',
        path: request ? contractPath(request.url) : '',
        requestName: request?.name ?? '',
        missing: !request,
      }
    }),
    testCases: testCases.map((testCase: { id: string; number: number; title: string; precondition: string; steps: string[]; expected: string[]; createdBy: string; viaKey: string | null }) => ({
      id: testCase.id,
      code: `TC-${testCase.number}`,
      title: testCase.title,
      precondition: testCase.precondition,
      steps: testCase.steps,
      expected: testCase.expected,
      createdBy: testCase.createdBy,
      viaKey: testCase.viaKey,
    })),
  }
}

export async function updateStoryDetails(db: SQL, workspaceId: string, storyId: string, userId: string, input: Record<string, unknown>, via?: PlanningVia) {
  await requirePlanningPm(db, workspaceId, userId, via)
  await storyOf(db, workspaceId, storyId)
  const userStory = input.userStory === undefined ? undefined : isRecord(input.userStory) ? input.userStory : null
  if (userStory === null) throw new AppError('PLANNING_INPUT_INVALID')
  await updateStoryText(db, storyId, {
    ...(userStory && {
      userStoryRole: textOf(userStory.role ?? '', 300),
      userStoryAction: textOf(userStory.action ?? '', 1000),
      userStoryBenefit: textOf(userStory.benefit ?? '', 1000),
    }),
    ...(input.flow !== undefined && { flow: textOf(input.flow, 20000) }),
  })
  if (input.definitionOfDone !== undefined) {
    if (!Array.isArray(input.definitionOfDone) || input.definitionOfDone.length > 50) throw new AppError('PLANNING_INPUT_INVALID')
    const current = new Map((await listDodItems(db, storyId)).map((item) => [item.id, item]))
    const items = input.definitionOfDone.map((entry) => {
      if (!isRecord(entry) || !isWorkRole(entry.role)) throw new AppError('PLANNING_INPUT_INVALID')
      const kept = typeof entry.id === 'string' ? current.get(entry.id) : undefined
      return { id: kept?.id ?? randomUUID(), text: textOf(entry.text, 500, true), role: entry.role as WorkRole, done: kept?.done ?? false }
    })
    await replaceDodItems(db, storyId, items)
  }
  return getStoryDetails(db, workspaceId, storyId, userId, via)
}

export async function setStoryDodItem(db: SQL, workspaceId: string, storyId: string, itemId: string, userId: string, done: unknown, via?: PlanningVia) {
  if (typeof done !== 'boolean') throw new AppError('PLANNING_INPUT_INVALID')
  await requireContributor(db, workspaceId, storyId, userId, via)
  if (!(await setDodDone(db, storyId, itemId, done, userId))) throw new AppError('PLANNING_NOT_FOUND')
  return getStoryDetails(db, workspaceId, storyId, userId, via)
}

// Approving the design opens the tasks for the other roles. One approval from the owner, a PM, or a tech lead is enough.
export async function approveStoryDesign(db: SQL, workspaceId: string, storyId: string, userId: string) {
  await requirePlanningApprover(db, workspaceId, userId)
  await storyOf(db, workspaceId, storyId)
  if ((await countDesigns(db, storyId)) === 0) throw new AppError('PLANNING_CONFLICT')
  if (!(await setDesignApproval(db, storyId, userId))) throw new AppError('PLANNING_CONFLICT')
  await storyEvent(db, workspaceId, storyId, userId, 'design_approved')
  const story = await storyOf(db, workspaceId, storyId)
  const actor = await findUserById(db, userId)
  for (const participantId of await listStoryParticipantIds(db, storyId)) {
    if (participantId === userId) continue
    await notify(db, participantId, 'design_approved', `/w/${workspaceId}/projects`, { actor: actor?.email.split('@')[0] ?? '', title: story.title })
  }
  return getStoryDetails(db, workspaceId, storyId, userId)
}

export async function attachStoryDesign(db: SQL, workspaceId: string, storyId: string, userId: string, input: Record<string, unknown>, via?: PlanningVia) {
  await requireContributor(db, workspaceId, storyId, userId, via)
  await storyOf(db, workspaceId, storyId)
  const url = textOf(input.url, 2000, true)
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AppError('PLANNING_INPUT_INVALID')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new AppError('PLANNING_INPUT_INVALID')
  const id = randomUUID()
  await insertDesign(db, { id, storyId, title: textOf(input.title, 180, true), url, note: textOf(input.note ?? '', 500), createdBy: userId, apiKeyId: via?.apiKeyId ?? null })
  await storyEvent(db, workspaceId, storyId, userId, 'design_attached', via)
  return { id }
}

export async function linkStoryContract(db: SQL, workspaceId: string, storyId: string, userId: string, input: Record<string, unknown>, via?: PlanningVia) {
  await requireContributor(db, workspaceId, storyId, userId, via)
  await storyOf(db, workspaceId, storyId)
  const requestId = textOf(input.requestId, 200, true)
  if (!collectionRequests(await findHeadSnapshot(db, workspaceId)).has(requestId)) throw new AppError('CONTRACT_REQUEST_NOT_FOUND')
  const id = randomUUID()
  if (!(await insertContractLink(db, { id, storyId, requestId, createdBy: userId, apiKeyId: via?.apiKeyId ?? null }))) throw new AppError('PLANNING_CONFLICT')
  await storyEvent(db, workspaceId, storyId, userId, 'contract_linked', via)
  return { id }
}

export async function addStoryTestCase(db: SQL, workspaceId: string, storyId: string, userId: string, input: Record<string, unknown>, via?: PlanningVia) {
  await requireContributor(db, workspaceId, storyId, userId, via)
  await storyOf(db, workspaceId, storyId)
  const steps = linesOf(input.steps, 50)
  const expected = linesOf(input.expected, 50)
  if (steps.length === 0 || expected.length === 0) throw new AppError('PLANNING_INPUT_INVALID')
  const id = randomUUID()
  const number = await insertTestCase(db, { id, storyId, title: textOf(input.title, 180, true), precondition: textOf(input.precondition ?? '', 2000), steps, expected, createdBy: userId, apiKeyId: via?.apiKeyId ?? null })
  await storyEvent(db, workspaceId, storyId, userId, 'test_case_added', via)
  return { id, code: `TC-${number}` }
}

// Links a table from a DBDesign project linked to the workspace. The table must still exist in the app.
export async function linkStoryDataModel(
  db: SQL,
  apps: AppsClient,
  actor: OidcUser,
  workspaceId: string,
  storyId: string,
  input: Record<string, unknown>,
  via?: PlanningVia,
) {
  await requireContributor(db, workspaceId, storyId, actor.id, via)
  await storyOf(db, workspaceId, storyId)
  const projectId = textOf(input.projectId, 100, true)
  const tableId = textOf(input.tableId, 100, true)
  const link = await findAppLink(db, workspaceId, 'dbdesign', projectId)
  if (!link) throw new AppError('APP_PROJECT_NOT_LINKED')
  const { tables } = await apps.dbdesignTables(actor, projectId)
  const table = tables.find((item) => item.id === tableId)
  if (!table) throw new AppError('APP_TABLE_NOT_FOUND')
  const id = randomUUID()
  const added = await insertDataModel(db, {
    id,
    storyId,
    appProjectId: projectId,
    projectName: link.appProjectName,
    tableId,
    tableName: table.name.slice(0, 200),
    createdBy: actor.id,
    apiKeyId: via?.apiKeyId ?? null,
  })
  if (!added) throw new AppError('PLANNING_CONFLICT')
  await storyEvent(db, workspaceId, storyId, actor.id, 'data_model_linked', via)
  return { id }
}

export async function unlinkStoryDataModel(db: SQL, workspaceId: string, storyId: string, userId: string, dataModelId: string) {
  await requireContributor(db, workspaceId, storyId, userId)
  await storyOf(db, workspaceId, storyId)
  if (!(await deleteDataModel(db, storyId, dataModelId))) throw new AppError('DATA_MODEL_NOT_FOUND')
  await storyEvent(db, workspaceId, storyId, userId, 'data_model_unlinked')
}

function storyEvent(db: SQL, workspaceId: string, storyId: string, actorId: string, action: string, via?: PlanningVia) {
  return insertPlanningEvent(db, { workspaceId, actorId, apiKeyId: via?.apiKeyId ?? null, targetKind: 'story', targetId: storyId, action })
}
