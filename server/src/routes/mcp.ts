import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { isRecord } from '@/lib/validation'
import { isReadTool, listedTools, type McpPrincipal, type McpTool } from '@/models/mcp'
import { findMcpReplay, releaseMcpReplay, reserveMcpReplay, saveMcpReplay } from '@/repositories/mcp-replays.repository'
import { bearerToken } from '@/services/auth'
import { broadcastPlanningChange, type PlanningScope } from '@/services/events'
import { type AudienceTarget, commentTarget, planningAudience } from '@/services/planning-audience'
import { guideIsFresh, readMcpGuide, writeMcpStoryDetails } from '@/services/mcp-access'
import { promptsFor, serverInstructions } from '@/services/mcp-guides'
import { addMcpSubtask, attachMcpDesign, linkMcpContract, listMcpReadyTasks, listMcpSubtasks, readMcpStory, setMcpSubtaskDone, writeMcpTestCase } from '@/services/mcp-access'
import { authenticateMcpKey, changeMcpAssignedTaskStatus, commentMcpAssignedTask, commentMcpParticipatingStory, commentMcpPlanning, draftMcpItem, draftMcpPrd, draftMcpTask, getMcpAssignedTask, listMcpAssignedTasks, listMcpParticipatingStories, listMcpPlanning, listMcpProjects, listMcpWorkspaces, readMcpDocument, readMcpParticipatingStory, uploadMcpBrd } from '@/services/mcp-access'
import { listMcpDocuments, listMcpProjectItems, listMcpProjectTasks, readMcpReadableDocument } from '@/services/mcp-access'
import { DOCUMENT_URI_TEMPLATE, listMcpDocumentResources, listMcpTeamMembers, readMcpDiscussion, listMcpNotifications, markMcpNotificationsRead, readMcpDocumentResource, searchMcpApiRequests } from '@/services/mcp-access'

export const MCP_CALLS_PER_MINUTE = 240
// Newest first. initialize answers with the client's version when it is here, and with the first one otherwise.
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26']

const RPC = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, unauthorized: -32001, resourceNotFound: -32002, rateLimited: -32003 }

// Tools that change project data: which part of the project open pages should reload, and who may read the change.
const MCP_WRITES: Partial<Record<McpTool, { scope: PlanningScope; target: (args: Args) => AudienceTarget }>> = {
  tasks_update_assigned_status: { scope: 'tasks', target: () => ({ kind: 'everyone' }) },
  tasks_comment_assigned: { scope: 'comments', target: (a) => ({ kind: 'task-thread', id: String(a.taskId) }) },
  stories_comment_participating: { scope: 'comments', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  planning_upload_brd: { scope: 'documents', target: () => ({ kind: 'managers' }) },
  planning_draft_prd: { scope: 'documents', target: () => ({ kind: 'managers' }) },
  planning_draft_item: { scope: 'items', target: () => ({ kind: 'managers' }) },
  planning_draft_task: { scope: 'items', target: () => ({ kind: 'managers' }) },
  planning_comment: { scope: 'comments', target: (a) => commentTarget(String(a.targetKind), String(a.targetId)) },
  story_attach_design: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  story_link_api_contract: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  story_write_test_case: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  subtask_add: { scope: 'tasks', target: () => ({ kind: 'everyone' }) },
  subtask_set_done: { scope: 'tasks', target: () => ({ kind: 'everyone' }) },
  story_write_details: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
}

// Writes that add something. A retry with the same clientRequestId returns the first result instead of adding twice.
const REPLAYABLE = new Set<McpTool>([
  'planning_upload_brd',
  'planning_draft_prd',
  'planning_draft_item',
  'planning_draft_task',
  'planning_comment',
  'tasks_comment_assigned',
  'stories_comment_participating',
  'story_attach_design',
  'story_link_api_contract',
  'story_write_test_case',
  'subtask_add',
])
// story_write_details replaces the Definition of Done. Setting a status or a done flag twice changes nothing more.
const DESTRUCTIVE = new Set<McpTool>(['story_write_details'])
const IDEMPOTENT = new Set<McpTool>(['tasks_update_assigned_status', 'subtask_set_done', 'story_write_details', 'notifications_mark_read'])

type RpcRequest = { id?: string | number | null; method?: string; params?: unknown }
type Args = Record<string, unknown>
type ToolDefinition = { title: string; description: string; properties: Record<string, unknown>; required: string[]; run: (db: SQL, principal: McpPrincipal, args: Args) => Promise<unknown> }

const text = { type: 'string' }
const workspaceId = { type: 'string', description: 'Workspace id from workspaces_list.' }
const commentBody = { type: 'string', description: 'The comment. Write @handle to mention a member; find handles with team_members_list.' }
const parentId = { type: 'string', description: 'Id of the comment you answer, from discussion_read. Leave out to start a new thread.' }
const clientRequestId = { type: 'string', maxLength: 100, description: 'Optional id you choose for this write. Send the same id when you retry after a timeout, and the first result comes back instead of a second copy.' }

function inWorkspace(title: string, properties: Record<string, unknown>, required: string[], description: string, run: ToolDefinition['run']): ToolDefinition {
  return { title, description, properties: { workspaceId, ...properties }, required: ['workspaceId', ...required], run }
}

const tools: Record<McpTool, ToolDefinition> = {
  workspaces_list: { title: 'List workspaces', description: 'List the workspaces this member belongs to. Every other tool needs one of these ids.', properties: {}, required: [], run: (db, p) => listMcpWorkspaces(db, p) },
  projects_list: inWorkspace('List projects', {}, [], 'List the projects of a workspace.', (db, p, a) => listMcpProjects(db, p, a.workspaceId)),
  tasks_list_assigned: inWorkspace('List my tasks', {}, [], 'List published tasks in the workspace assigned to this member.', (db, p, a) => listMcpAssignedTasks(db, p, a.workspaceId)),
  tasks_get_assigned: inWorkspace('Read my task', { taskId: text }, ['taskId'], 'Read a task assigned to this member.', (db, p, a) => getMcpAssignedTask(db, p, a.workspaceId, a.taskId)),
  tasks_update_assigned_status: inWorkspace('Move my task', { taskId: text, status: { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'] } }, ['taskId', 'status'], 'Change the status of a task assigned to this member.', (db, p, a) => changeMcpAssignedTaskStatus(db, p, a.workspaceId, a.taskId, a.status)),
  tasks_comment_assigned: inWorkspace('Comment on my task', { taskId: text, body: commentBody, parentId, clientRequestId }, ['taskId', 'body'], 'Comment on a published task assigned to this member, or answer a comment on it.', (db, p, a) => commentMcpAssignedTask(db, p, a.workspaceId, a.taskId, { body: a.body, parentId: a.parentId })),
  stories_list_participating: inWorkspace('List my stories', {}, [], 'List published stories where this member is a participant.', (db, p, a) => listMcpParticipatingStories(db, p, a.workspaceId)),
  stories_read_participating: inWorkspace('Read my story', { storyId: text }, ['storyId'], 'Read a published story where this member is a participant.', (db, p, a) => readMcpParticipatingStory(db, p, a.workspaceId, a.storyId)),
  stories_comment_participating: inWorkspace('Comment on my story', { storyId: text, body: commentBody, parentId, clientRequestId }, ['storyId', 'body'], 'Comment on a published story where this member is a participant, or answer a comment on it.', (db, p, a) => commentMcpParticipatingStory(db, p, a.workspaceId, a.storyId, { body: a.body, parentId: a.parentId })),
  project_items_list: inWorkspace('List epics and stories', {}, [], 'List the epics and stories of the workspace, read-only. Drafts are included only for the PM and the tech lead.', (db, p, a) => listMcpProjectItems(db, p, a.workspaceId)),
  project_tasks_list: inWorkspace('List all tasks', {}, [], 'List the tasks of every member in the workspace, read-only. Use tasks_list_assigned for your own work.', (db, p, a) => listMcpProjectTasks(db, p, a.workspaceId)),
  documents_list: inWorkspace('List documents', {}, [], 'List the BRDs and PRDs this key may read: all of them for the PM and the tech lead, approved ones for backend.', (db, p, a) => listMcpDocuments(db, p, a.workspaceId)),
  documents_read: inWorkspace('Read a document', { documentId: text }, ['documentId'], 'Read a BRD or PRD this key may read, with its version history.', (db, p, a) => readMcpReadableDocument(db, p, a.workspaceId, a.documentId)),
  planning_list: inWorkspace('Planning overview', {}, [], 'List planning documents, epics, stories and draft tasks of the workspace.', (db, p, a) => listMcpPlanning(db, p, a.workspaceId)),
  planning_read_document: inWorkspace('Read a planning document', { documentId: text }, ['documentId'], 'Read a BRD or PRD and its version history.', (db, p, a) => readMcpDocument(db, p, a.workspaceId, a.documentId)),
  planning_upload_brd: inWorkspace(
    'Upload a BRD',
    { title: text, content: { type: 'string', description: 'The full BRD text, exactly as the person gave it. Markdown or plain text.' }, fileName: { type: 'string', description: 'Original file name, ending in .md or .txt.' }, clientRequestId },
    ['title', 'content'],
    'Upload a BRD that the person gave you, unchanged, following step 1 of planning_guide. It waits as a draft until the owner, a PM, or a tech lead confirms it in the web app. Never write a BRD yourself.',
    (db, p, a) => uploadMcpBrd(db, p, a.workspaceId, { title: a.title, content: a.content, fileName: a.fileName }),
  ),
  planning_draft_prd: inWorkspace('Draft a PRD', { title: text, content: text, sourceDocumentId: text, clientRequestId }, ['title', 'content', 'sourceDocumentId'], 'Save a PRD draft linked to a confirmed BRD. Review and approval happen in the web app.', (db, p, a) => draftMcpPrd(db, p, a.workspaceId, { title: a.title, content: a.content, sourceDocumentId: a.sourceDocumentId })),
  planning_draft_item: inWorkspace(
    'Draft an epic or story',
    { kind: { type: 'string', enum: ['epic', 'story'] }, parentId: text, title: text, description: { type: 'string', description: 'For an epic, the labelled lines of step 3 of planning_guide: Tujuan, Mencakup, Di luar cakupan, Ukuran sukses, Kriteria selesai, Risiko & dependensi.' }, acceptanceCriteria: text, sourceDocumentId: text, sourceSection: text, participantIds: { type: 'array', items: text }, clientRequestId },
    ['kind', 'title', 'sourceDocumentId', 'sourceSection'],
    'Create a draft epic or story from an approved PRD, following step 3 or 4 of planning_guide. sourceSection is a line copied exactly from the PRD. A story needs parentId of an epic and acceptanceCriteria.',
    (db, p, a) => draftMcpItem(db, p, a.workspaceId, { kind: a.kind, parentId: a.parentId, title: a.title, description: a.description, acceptanceCriteria: a.acceptanceCriteria, sourceDocumentId: a.sourceDocumentId, sourceSection: a.sourceSection, participantIds: a.participantIds }),
  ),
  planning_draft_task: inWorkspace(
    'Draft a task',
    { storyId: text, title: text, description: text, role: { type: 'string', enum: ['ui_ux', 'backend', 'frontend', 'mobile', 'qa'] }, assigneeId: text, priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }, clientRequestId },
    ['storyId', 'title', 'role'],
    'Create a task draft inside a story, following step 5 of planning_guide: the UI/UX task first, one task per role. It stays off the task board until its epic is published.',
    (db, p, a) => draftMcpTask(db, p, a.workspaceId, { storyId: a.storyId, title: a.title, description: a.description, role: a.role, assigneeId: a.assigneeId, priority: a.priority }),
  ),
  planning_guide: {
    title: 'Read the playbook',
    description: "Read the playbook for this key's role. Required before any write tool: they refuse until the current guide was read in the last 12 hours.",
    properties: {},
    required: [],
    run: (db, p) => readMcpGuide(db, p),
  },
  story_write_details: inWorkspace(
    'Write story details',
    {
      storyId: text,
      userStory: { type: 'object', properties: { role: text, action: text, benefit: text }, required: ['role', 'action', 'benefit'] },
      flow: { type: 'string', description: 'Main flow as numbered steps and failure flows as a list, in markdown.' },
      definitionOfDone: {
        type: 'array',
        items: { type: 'object', properties: { text, role: { type: 'string', enum: ['ui_ux', 'backend', 'frontend', 'mobile', 'qa'] } }, required: ['text', 'role'] },
      },
    },
    ['storyId', 'userStory', 'flow', 'definitionOfDone'],
    'Write the user story, flow, and Definition of Done of a story, following step 4 of planning_guide. Replaces the current Definition of Done.',
    (db, p, a) => writeMcpStoryDetails(db, p, a.workspaceId, a.storyId, { userStory: a.userStory, flow: a.flow, definitionOfDone: a.definitionOfDone }),
  ),
  planning_comment: inWorkspace('Comment on planning', { targetKind: { type: 'string', enum: ['document', 'epic', 'story', 'task'] }, targetId: text, body: commentBody, parentId, clientRequestId }, ['targetKind', 'targetId', 'body'], 'Comment on a planning document, epic, story, or task, or answer a comment there.', (db, p, a) => commentMcpPlanning(db, p, a.workspaceId, { targetKind: a.targetKind, targetId: a.targetId, body: a.body, parentId: a.parentId })),
  story_read: inWorkspace('Read a story', { storyId: text }, ['storyId'], 'Read a story with its user story, flow, Definition of Done, designs, API contracts, and test cases.', (db, p, a) => readMcpStory(db, p, a.workspaceId, a.storyId)),
  story_attach_design: inWorkspace(
    'Attach a design',
    { storyId: text, title: text, url: { type: 'string', description: 'An http or https link to the design.' }, note: text, clientRequestId },
    ['storyId', 'title', 'url'],
    'Attach a design link to a story. The owner, a PM, or a tech lead approves it in the web app.',
    (db, p, a) => attachMcpDesign(db, p, a.workspaceId, a.storyId, { title: a.title, url: a.url, note: a.note }),
  ),
  story_link_api_contract: inWorkspace(
    'Link an API contract',
    { storyId: text, requestId: { type: 'string', description: 'Request id from api_requests_search.' }, clientRequestId },
    ['storyId', 'requestId'],
    'Link a request from the workspace API docs to a story as its API contract. Find the request id with api_requests_search.',
    (db, p, a) => linkMcpContract(db, p, a.workspaceId, a.storyId, a.requestId),
  ),
  story_write_test_case: inWorkspace(
    'Write a test case',
    { storyId: text, title: text, precondition: text, steps: { type: 'array', items: text }, expected: { type: 'array', items: text }, clientRequestId },
    ['storyId', 'title', 'steps', 'expected'],
    'Add a test case to a story. The text is what QA hands to Playwright.',
    (db, p, a) => writeMcpTestCase(db, p, a.workspaceId, a.storyId, { title: a.title, precondition: a.precondition, steps: a.steps, expected: a.expected }),
  ),
  tasks_list_ready: inWorkspace('List tasks I can start', {}, [], 'List tasks assigned to this member that can start now: not done, not waiting for a design approval, and with every dependency done.', (db, p, a) => listMcpReadyTasks(db, p, a.workspaceId)),
  subtasks_list: inWorkspace('List sub-tasks', { taskId: text }, ['taskId'], 'List the sub-tasks of a task assigned to this member.', (db, p, a) => listMcpSubtasks(db, p, a.workspaceId, a.taskId)),
  subtask_add: inWorkspace('Add a sub-task', { taskId: text, title: text, clientRequestId }, ['taskId', 'title'], 'Add a sub-task to a task assigned to this member.', (db, p, a) => addMcpSubtask(db, p, a.workspaceId, a.taskId, a.title)),
  subtask_set_done: inWorkspace('Check off a sub-task', { taskId: text, subtaskId: text, done: { type: 'boolean' } }, ['taskId', 'subtaskId', 'done'], 'Mark a sub-task of a task assigned to this member as done or not done.', (db, p, a) => setMcpSubtaskDone(db, p, a.workspaceId, a.taskId, a.subtaskId, a.done)),
  api_requests_search: inWorkspace(
    'Search API requests',
    { query: { type: 'string', description: 'Text found in the request name, url, or folder. Leave out to list the first 50.' }, method: { type: 'string', description: 'Only requests of this HTTP method, for example GET or POST.' } },
    [],
    'Search the requests of the workspace API docs. Returns the id, name, method, url, path, and folder of each match, up to 50. Use the id with story_link_api_contract.',
    (db, p, a) => searchMcpApiRequests(db, p, a.workspaceId, { query: a.query, method: a.method }),
  ),
  notifications_list: {
    title: 'List my notifications',
    description: 'List this member’s notifications from every workspace, newest first: mentions, replies, comments on assigned tasks, assignments, and design approvals. Each has a link to the page in the web app.',
    properties: { unreadOnly: { type: 'boolean', description: 'Only notifications not read yet.' }, limit: { type: 'integer', minimum: 1, maximum: 50 } },
    required: [],
    run: (db, p, a) => listMcpNotifications(db, p, { unreadOnly: a.unreadOnly, limit: a.limit }),
  },
  team_members_list: inWorkspace('List the team', {}, [], 'List every member of the workspace: id, the handle to write as @handle in a comment, email, workspace role, and project roles.', (db, p, a) => listMcpTeamMembers(db, p, a.workspaceId)),
  discussion_read: inWorkspace(
    'Read a discussion',
    { targetKind: { type: 'string', enum: ['document', 'epic', 'story', 'task'] }, targetId: text },
    ['targetKind', 'targetId'],
    'Read the comments on a document, epic, story, or task you may read, as threads with their replies. Use a comment id as parentId to answer it.',
    (db, p, a) => readMcpDiscussion(db, p, a.workspaceId, { targetKind: a.targetKind, targetId: a.targetId }),
  ),
  notifications_mark_read: {
    title: 'Mark notifications read',
    description: 'Mark notifications as read, by id or all at once, after you handled them.',
    properties: { ids: { type: 'array', items: text, maxItems: 50 }, all: { type: 'boolean' } },
    required: [],
    run: (db, p, a) => markMcpNotificationsRead(db, p, { ids: a.ids, all: a.all }),
  },
}

function annotationsFor(name: McpTool) {
  if (isReadTool(name)) return { readOnlyHint: true, openWorldHint: false }
  return { readOnlyHint: false, destructiveHint: DESTRUCTIVE.has(name), idempotentHint: IDEMPOTENT.has(name), openWorldHint: false }
}

function rpcResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

function errorResponse(id: RpcRequest['id'], code: number, message: string, { status = 200, data, headers }: { status?: number; data?: unknown; headers?: Record<string, string> } = {}): Response {
  return rpcResponse({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } }, status, headers)
}

// The text block keeps the plain JSON for older clients. structuredContent must be an object, so a list is wrapped.
function textResult(value: unknown, isError = false) {
  const content = [{ type: 'text', text: JSON.stringify(value) }]
  if (isError) return { content, isError }
  return { content, structuredContent: isRecord(value) ? value : Array.isArray(value) ? { items: value } : { value }, isError }
}

function toolList(principal: McpPrincipal) {
  return listedTools(principal.tools)
    .filter((name) => name in tools)
    .map((name) => ({
      name,
      title: tools[name].title,
      description: tools[name].description,
      inputSchema: { type: 'object', properties: tools[name].properties, required: tools[name].required, additionalProperties: false },
      annotations: annotationsFor(name),
    }))
}

function negotiatedVersion(params: unknown): string {
  const requested = isRecord(params) ? params.protocolVersion : undefined
  return typeof requested === 'string' && SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0]
}

async function authenticate(ctx: AppContext, request: Request, id: RpcRequest['id']): Promise<McpPrincipal | Response> {
  try {
    return await authenticateMcpKey(ctx.db, bearerToken(request))
  } catch (error) {
    if (!(error instanceof AppError)) throw error
    return errorResponse(id, RPC.unauthorized, error.message, { status: error.status, data: { code: error.code }, headers: { 'WWW-Authenticate': 'Bearer realm="api-documentation", error="invalid_token"' } })
  }
}

export async function handleMcpRequest(ctx: AppContext, request: Request, method: string): Promise<Response> {
  if (method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(null, RPC.parse, 'Invalid JSON.')
  }
  if (!isRecord(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string') return errorResponse(null, RPC.invalidRequest, 'Invalid request.')
  const rpc = body as RpcRequest
  const id = rpc.id ?? null
  const version = request.headers.get('MCP-Protocol-Version')
  if (version && !SUPPORTED_VERSIONS.includes(version)) return errorResponse(id, RPC.invalidRequest, `Unsupported protocol version ${version}.`, { status: 400, data: { supported: SUPPORTED_VERSIONS } })

  const principal = await authenticate(ctx, request, id)
  if (principal instanceof Response) return principal
  if (!ctx.limiter.hit(`mcp:${principal.keyId}`, MCP_CALLS_PER_MINUTE, 60_000)) {
    const limited = new AppError('MCP_RATE_LIMITED')
    return errorResponse(id, RPC.rateLimited, limited.message, { status: limited.status, data: { code: limited.code }, headers: { 'Retry-After': '60' } })
  }
  // A notification has no id and never gets an answer.
  if (!('id' in body)) return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  const params = isRecord(rpc.params) ? rpc.params : {}

  switch (rpc.method) {
    case 'ping':
      return rpcResponse({ jsonrpc: '2.0', id, result: {} })
    case 'initialize':
      return rpcResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: negotiatedVersion(rpc.params),
          capabilities: { tools: { listChanged: false }, prompts: { listChanged: false }, resources: { listChanged: false, subscribe: false } },
          serverInfo: { name: 'api-documentation-cloud', title: 'API Documentation cloud', version: '1.1.0' },
          instructions: serverInstructions(principal.roles),
        },
      })
    case 'prompts/list':
      return rpcResponse({ jsonrpc: '2.0', id, result: { prompts: promptsFor(principal.roles).map(({ text: _text, ...prompt }) => prompt) } })
    case 'prompts/get':
      return getPrompt(principal, id, params)
    case 'resources/list':
      return rpcResponse({ jsonrpc: '2.0', id, result: { resources: await listMcpDocumentResources(ctx.db, principal) } })
    case 'resources/templates/list':
      return rpcResponse({ jsonrpc: '2.0', id, result: { resourceTemplates: [{ uriTemplate: DOCUMENT_URI_TEMPLATE, name: 'Planning document', title: 'Planning document', description: 'A BRD or PRD of a workspace, as markdown.', mimeType: 'text/markdown' }] } })
    case 'resources/read':
      return readResource(ctx, principal, id, params)
    case 'tools/list':
      return rpcResponse({ jsonrpc: '2.0', id, result: { tools: toolList(principal) } })
    case 'tools/call':
      return callTool(ctx, principal, id, params)
    default:
      return errorResponse(id, RPC.methodNotFound, 'Method not found.')
  }
}

function getPrompt(principal: McpPrincipal, id: RpcRequest['id'], params: Args): Response {
  const prompt = promptsFor(principal.roles).find((item) => item.name === params.name)
  if (!prompt) return errorResponse(id, RPC.invalidParams, 'Prompt not found.')
  const values = isRecord(params.arguments) ? Object.fromEntries(Object.entries(params.arguments).map(([key, value]) => [key, String(value)])) : {}
  if (prompt.arguments.some((argument) => argument.required && !values[argument.name])) return errorResponse(id, RPC.invalidParams, 'Prompt arguments are missing.')
  return rpcResponse({ jsonrpc: '2.0', id, result: { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: prompt.text(values) } }] } })
}

async function readResource(ctx: AppContext, principal: McpPrincipal, id: RpcRequest['id'], params: Args): Promise<Response> {
  try {
    return rpcResponse({ jsonrpc: '2.0', id, result: { contents: await readMcpDocumentResource(ctx.db, principal, params.uri) } })
  } catch (error) {
    if (!(error instanceof AppError)) throw error
    return errorResponse(id, RPC.resourceNotFound, 'Resource not found.', { data: { uri: params.uri, code: error.code } })
  }
}

async function callTool(ctx: AppContext, principal: McpPrincipal, id: RpcRequest['id'], params: Args): Promise<Response> {
  const name = params.name
  if (typeof name !== 'string' || !(name in tools)) return errorResponse(id, RPC.invalidParams, 'Tool name or arguments are invalid.')
  const tool = name as McpTool
  const args = isRecord(params.arguments) ? params.arguments : {}
  const ok = (value: unknown) => rpcResponse({ jsonrpc: '2.0', id, result: textResult(value) })
  const refused = (value: unknown) => rpcResponse({ jsonrpc: '2.0', id, result: textResult(value, true) })
  const write = MCP_WRITES[tool]
  // The playbook is the agent's mandatory context. A refused write carries it, and reading it here counts.
  if (write && principal.tools.includes(tool) && !guideIsFresh(principal)) {
    const error = new AppError('MCP_GUIDE_REQUIRED')
    return refused({ code: error.code, error: error.message, guide: await readMcpGuide(ctx.db, principal) })
  }
  const replayId = REPLAYABLE.has(tool) && typeof args.clientRequestId === 'string' && args.clientRequestId.length > 0 && args.clientRequestId.length <= 100 ? args.clientRequestId : null
  try {
    if (replayId && !(await reserveMcpReplay(ctx.db, principal.keyId, tool, replayId))) {
      const stored = await findMcpReplay(ctx.db, principal.keyId, tool, replayId)
      if (!stored) throw new AppError('MCP_REQUEST_IN_PROGRESS')
      return ok(stored.result)
    }
    const result = await runTool(ctx, principal, tool, args, replayId)
    if (write && typeof args.workspaceId === 'string')
      broadcastPlanningChange(ctx, args.workspaceId, write.scope, principal.userId, await planningAudience(ctx.db, args.workspaceId, write.target(args)))
    return ok(result)
  } catch (error) {
    if (error instanceof AppError) return refused({ code: error.code, error: error.message })
    throw error
  }
}

async function runTool(ctx: AppContext, principal: McpPrincipal, tool: McpTool, args: Args, replayId: string | null): Promise<unknown> {
  try {
    const result = await tools[tool].run(ctx.db, principal, args)
    if (replayId) await saveMcpReplay(ctx.db, principal.keyId, tool, replayId, result)
    return result
  } catch (error) {
    if (replayId) await releaseMcpReplay(ctx.db, principal.keyId, tool, replayId)
    throw error
  }
}
