import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { McpPrincipal } from '@/models/mcp'
import {
  addCriterionTestCase,
  addEpicCriterion,
  listCriteriaOfIssue,
  listEpicCriteria,
  mapEpicCriterion,
  setIssueCriteria,
  strikeEpicCriterion,
  updateEpicCriterion,
} from '@/services/acceptance-criteria'
import { createEpicDocument, listEpicDocuments, reviseEpicDocument } from '@/services/epic-documents'
import { createIssue, getIssue, listIssuePage } from '@/services/issues'
import { asAgent, issueRef, issueScope, requireWorkspace } from '@/services/mcp-access'
import { getReadiness, getTicket, saveTicket, setTicketDependencies } from '@/services/tickets'

// The MCP side of the team standard: the epic's documents and acceptance criteria, tickets, and their sub-tasks.
// Every call works as the member who owns the key, so the services apply the same roles as the web app,
// and an agent key never approves.

const TICKET_FIELDS = ['repo', 'goal', 'scope', 'designNotes', 'codeFollow', 'codeTouch', 'ticketAcs', 'requiredTests', 'outOfScope', 'skills', 'size', 'usesApi', 'openQuestions', 'role'] as const

const pickTicketFields = (args: Record<string, unknown>) => Object.fromEntries(TICKET_FIELDS.filter((name) => args[name] !== undefined).map((name) => [name, args[name]]))

const numberOf = (value: unknown): number => {
  if (!Number.isInteger(value) || (value as number) < 1) throw new AppError('ISSUE_INPUT_INVALID')
  return value as number
}

export async function readMcpEpicDocuments(db: SQL, principal: McpPrincipal, workspaceId: unknown, epicId: unknown) {
  const id = await requireWorkspace(db, principal, 'epic_documents_read', workspaceId)
  return listEpicDocuments(db, await issueScope(db, id), asAgent(principal), issueRef(epicId))
}

export async function draftMcpEpicDocument(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'epic_document_draft', workspaceId)
  return createEpicDocument(db, await issueScope(db, id), asAgent(principal), issueRef(args.epicId), { kind: args.kind, title: args.title, sections: args.sections })
}

export async function reviseMcpEpicDocument(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'epic_document_revise', workspaceId)
  if (typeof args.documentId !== 'string') throw new AppError('ISSUE_INPUT_INVALID')
  return reviseEpicDocument(db, await issueScope(db, id), asAgent(principal), issueRef(args.epicId), args.documentId, { expectedVersion: args.expectedVersion, title: args.title, sections: args.sections })
}

export async function listMcpCriteria(db: SQL, principal: McpPrincipal, workspaceId: unknown, epicId: unknown) {
  const id = await requireWorkspace(db, principal, 'acceptance_criteria_list', workspaceId)
  return listEpicCriteria(db, await issueScope(db, id), asAgent(principal), issueRef(epicId))
}

const criterionInput = (args: Record<string, unknown>) => ({ flow: args.flow, title: args.title, given: args.given, when: args.when, then: args.then })

export async function addMcpCriterion(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'acceptance_criterion_add', workspaceId)
  return addEpicCriterion(db, await issueScope(db, id), asAgent(principal), issueRef(args.epicId), criterionInput(args))
}

export async function updateMcpCriterion(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'acceptance_criterion_update', workspaceId)
  return updateEpicCriterion(db, await issueScope(db, id), asAgent(principal), issueRef(args.epicId), numberOf(args.number), criterionInput(args))
}

export async function strikeMcpCriterion(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'acceptance_criterion_strike', workspaceId)
  return strikeEpicCriterion(db, await issueScope(db, id), asAgent(principal), issueRef(args.epicId), numberOf(args.number), args.reason)
}

export async function mapMcpCriterion(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'acceptance_criterion_map', workspaceId)
  return mapEpicCriterion(db, await issueScope(db, id), asAgent(principal), issueRef(args.epicId), numberOf(args.number), args.entries)
}

export async function writeMcpCriterionTestCase(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'criterion_test_case_write', workspaceId)
  return addCriterionTestCase(db, await issueScope(db, id), asAgent(principal), issueRef(args.epicId), numberOf(args.number), {
    title: args.title,
    precondition: args.precondition,
    steps: args.steps,
    expected: args.expected,
  })
}

// One ticket in one call: the task under the epic, its ticket fields, the criteria it delivers and what it depends on.
// The task is a draft until the PM or the tech lead publishes it.
export async function draftMcpTicket(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'ticket_draft', workspaceId)
  const scope = await issueScope(db, id)
  const actor = asAgent(principal)
  const epic = await getIssue(db, scope, actor, issueRef(args.epicId))
  if (epic.type !== 'epic') throw new AppError('ISSUE_INPUT_INVALID')
  if (typeof args.title !== 'string') throw new AppError('ISSUE_INPUT_INVALID')
  const task = await createIssue(db, scope, actor, {
    type: 'task',
    title: args.title,
    parentId: epic.id,
    priority: typeof args.priority === 'string' ? args.priority : undefined,
    assigneeId: typeof args.assigneeId === 'string' ? args.assigneeId : undefined,
  })
  return updateTicketParts(db, scope, actor, task.id, args)
}

export async function updateMcpTicket(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'ticket_update', workspaceId)
  const scope = await issueScope(db, id)
  return updateTicketParts(db, scope, asAgent(principal), issueRef(args.ticketId), args)
}

async function updateTicketParts(db: SQL, scope: { workspaceId: string; projectId: string }, actor: ReturnType<typeof asAgent>, ref: string, args: Record<string, unknown>) {
  const fields = pickTicketFields(args)
  if (Object.keys(fields).length > 0) await saveTicket(db, scope, actor, ref, fields)
  if (args.acNumbers !== undefined) await setIssueCriteria(db, scope, actor, ref, args.acNumbers)
  if (args.dependsOn !== undefined) await setTicketDependencies(db, scope, actor, ref, args.dependsOn)
  return readTicket(db, scope, actor, ref)
}

async function readTicket(db: SQL, scope: { workspaceId: string; projectId: string }, actor: ReturnType<typeof asAgent>, ref: string) {
  const ticket = await getTicket(db, scope, actor, ref)
  const criteria = await listCriteriaOfIssue(db, scope, actor, ticket.issue.id)
  const subtasks = await listIssuePage(db, scope, actor, { type: 'subtask', parentId: ticket.issue.id }, { limit: 100, cursor: null })
  const contract = ticket.issue.parentId ? (await listEpicDocuments(db, scope, actor, ticket.issue.parentId)).documents.find((document) => document.kind === 'contract') : undefined
  return { ...ticket, criteria, subtasks: subtasks.items, contract: contract ? { status: contract.status, version: contract.version, sections: contract.sections } : null }
}

// Everything an engineer needs to start: the ticket fields, readiness, the criteria with their Given / When / Then,
// the sub-tasks, and the epic's contract.
export async function readMcpTicket(db: SQL, principal: McpPrincipal, workspaceId: unknown, ticketId: unknown) {
  const id = await requireWorkspace(db, principal, 'ticket_read', workspaceId)
  return readTicket(db, await issueScope(db, id), asAgent(principal), issueRef(ticketId))
}

export async function readMcpReadiness(db: SQL, principal: McpPrincipal, workspaceId: unknown, ticketId: unknown) {
  const id = await requireWorkspace(db, principal, 'ticket_readiness', workspaceId)
  return getReadiness(db, await issueScope(db, id), asAgent(principal), issueRef(ticketId))
}

// A step of the ticket for the member who owns the key. It goes to them and shows right away.
export async function addMcpSubtask(db: SQL, principal: McpPrincipal, workspaceId: unknown, args: Record<string, unknown>) {
  const id = await requireWorkspace(db, principal, 'subtask_add', workspaceId)
  const scope = await issueScope(db, id)
  const actor = asAgent(principal)
  const ticket = await getIssue(db, scope, actor, issueRef(args.ticketId))
  if (ticket.type !== 'task' || typeof args.title !== 'string') throw new AppError('ISSUE_INPUT_INVALID')
  return createIssue(db, scope, actor, { type: 'subtask', title: args.title, parentId: ticket.id, description: typeof args.description === 'string' ? args.description : undefined })
}
