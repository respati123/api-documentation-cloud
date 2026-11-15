import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { isRecord } from '@/lib/validation'
import type { McpPrincipal, McpTool } from '@/models/mcp'
import { bearerToken } from '@/services/auth'
import { broadcastPlanningChange, type PlanningScope } from '@/services/events'
import { type AudienceTarget, commentTarget, planningAudience } from '@/services/planning-audience'
import { guideIsFresh, readMcpGuide, writeMcpStoryDetails } from '@/services/mcp-access'
import { promptsFor, serverInstructions } from '@/services/mcp-guides'
import { addMcpSubtask, attachMcpDesign, linkMcpContract, listMcpReadyTasks, listMcpSubtasks, readMcpStory, setMcpSubtaskDone, writeMcpTestCase } from '@/services/mcp-access'
import { authenticateMcpKey, changeMcpAssignedTaskStatus, commentMcpAssignedTask, commentMcpParticipatingStory, commentMcpPlanning, draftMcpItem, draftMcpPrd, draftMcpTask, getMcpAssignedTask, listMcpAssignedTasks, listMcpParticipatingStories, listMcpPlanning, listMcpProjects, listMcpWorkspaces, readMcpDocument, readMcpParticipatingStory, uploadMcpBrd } from '@/services/mcp-access'
import { listMcpDocuments, listMcpProjectItems, listMcpProjectTasks, readMcpReadableDocument } from '@/services/mcp-access'

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

type RpcRequest = { id?: string | number | null; method?: string; params?: unknown }
type Args = Record<string, unknown>
type ToolDefinition = { description: string; properties: Record<string, unknown>; required: string[]; run: (db: SQL, principal: McpPrincipal, args: Args) => Promise<unknown> }

const text = { type: 'string' }
const workspaceId = { type: 'string', description: 'Workspace id from workspaces_list.' }

function inWorkspace(properties: Record<string, unknown>, required: string[], description: string, run: ToolDefinition['run']): ToolDefinition {
  return { description, properties: { workspaceId, ...properties }, required: ['workspaceId', ...required], run }
}

const tools: Record<McpTool, ToolDefinition> = {
  workspaces_list: { description: 'List the workspaces this member belongs to. Every other tool needs one of these ids.', properties: {}, required: [], run: (db, p) => listMcpWorkspaces(db, p) },
  projects_list: inWorkspace({}, [], 'List the projects of a workspace.', (db, p, a) => listMcpProjects(db, p, a.workspaceId)),
  tasks_list_assigned: inWorkspace({}, [], 'List published tasks in the workspace assigned to this member.', (db, p, a) => listMcpAssignedTasks(db, p, a.workspaceId)),
  tasks_get_assigned: inWorkspace({ taskId: text }, ['taskId'], 'Read a task assigned to this member.', (db, p, a) => getMcpAssignedTask(db, p, a.workspaceId, a.taskId)),
  tasks_update_assigned_status: inWorkspace({ taskId: text, status: { type: 'string', enum: ['backlog', 'todo', 'in_progress', 'in_review', 'done'] } }, ['taskId', 'status'], 'Change the status of a task assigned to this member.', (db, p, a) => changeMcpAssignedTaskStatus(db, p, a.workspaceId, a.taskId, a.status)),
  tasks_comment_assigned: inWorkspace({ taskId: text, body: text }, ['taskId', 'body'], 'Comment on a published task assigned to this member.', (db, p, a) => commentMcpAssignedTask(db, p, a.workspaceId, a.taskId, a.body)),
  stories_list_participating: inWorkspace({}, [], 'List published stories where this member is a participant.', (db, p, a) => listMcpParticipatingStories(db, p, a.workspaceId)),
  stories_read_participating: inWorkspace({ storyId: text }, ['storyId'], 'Read a published story where this member is a participant.', (db, p, a) => readMcpParticipatingStory(db, p, a.workspaceId, a.storyId)),
  stories_comment_participating: inWorkspace({ storyId: text, body: text }, ['storyId', 'body'], 'Comment on a published story where this member is a participant.', (db, p, a) => commentMcpParticipatingStory(db, p, a.workspaceId, a.storyId, a.body)),
  project_items_list: inWorkspace({}, [], 'List the published epics and stories of the workspace, read-only. Drafts are not included.', (db, p, a) => listMcpProjectItems(db, p, a.workspaceId)),
  project_tasks_list: inWorkspace({}, [], 'List the published tasks of every member in the workspace, read-only. Use tasks_list_assigned for your own work.', (db, p, a) => listMcpProjectTasks(db, p, a.workspaceId)),
  documents_list: inWorkspace({}, [], 'List the BRDs and approved PRDs this key may read.', (db, p, a) => listMcpDocuments(db, p, a.workspaceId)),
  documents_read: inWorkspace({ documentId: text }, ['documentId'], 'Read a BRD or an approved PRD and its version history.', (db, p, a) => readMcpReadableDocument(db, p, a.workspaceId, a.documentId)),
  planning_list: inWorkspace({}, [], 'List planning documents, epics, stories and draft tasks of the workspace.', (db, p, a) => listMcpPlanning(db, p, a.workspaceId)),
  planning_read_document: inWorkspace({ documentId: text }, ['documentId'], 'Read a BRD or PRD and its version history.', (db, p, a) => readMcpDocument(db, p, a.workspaceId, a.documentId)),
  planning_upload_brd: inWorkspace(
    { title: text, content: { type: 'string', description: 'The full BRD text, exactly as the person gave it. Markdown or plain text.' }, fileName: { type: 'string', description: 'Original file name, ending in .md or .txt.' } },
    ['title', 'content'],
    'Upload a BRD that the person gave you, unchanged, following step 1 of planning_guide. It is stored as approved, like a BRD uploaded in the web app. Never write a BRD yourself.',
    (db, p, a) => uploadMcpBrd(db, p, a.workspaceId, { title: a.title, content: a.content, fileName: a.fileName }),
  ),
  planning_draft_prd: inWorkspace({ title: text, content: text, sourceDocumentId: text }, ['title', 'content', 'sourceDocumentId'], 'Save a PRD draft linked to a BRD. Review and approval happen in the web app.', (db, p, a) => draftMcpPrd(db, p, a.workspaceId, { title: a.title, content: a.content, sourceDocumentId: a.sourceDocumentId })),
  planning_draft_item: inWorkspace(
    { kind: { type: 'string', enum: ['epic', 'story'] }, parentId: text, title: text, description: { type: 'string', description: 'For an epic, the labelled lines of step 3 of planning_guide: Tujuan, Mencakup, Di luar cakupan, Ukuran sukses, Kriteria selesai, Risiko & dependensi.' }, acceptanceCriteria: text, sourceDocumentId: text, sourceSection: text, participantIds: { type: 'array', items: text } },
    ['kind', 'title', 'sourceDocumentId', 'sourceSection'],
    'Create a draft epic or story from an approved PRD, following step 3 or 4 of planning_guide. sourceSection is a line copied exactly from the PRD. A story needs parentId of an epic and acceptanceCriteria.',
    (db, p, a) => draftMcpItem(db, p, a.workspaceId, { kind: a.kind, parentId: a.parentId, title: a.title, description: a.description, acceptanceCriteria: a.acceptanceCriteria, sourceDocumentId: a.sourceDocumentId, sourceSection: a.sourceSection, participantIds: a.participantIds }),
  ),
  planning_draft_task: inWorkspace(
    { storyId: text, title: text, description: text, role: { type: 'string', enum: ['ui_ux', 'backend', 'frontend', 'mobile', 'qa'] }, assigneeId: text, priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] } },
    ['storyId', 'title', 'role'],
    'Create a task draft inside a story, following step 5 of planning_guide: the UI/UX task first, one task per role. It stays off the task board until its epic is published.',
    (db, p, a) => draftMcpTask(db, p, a.workspaceId, { storyId: a.storyId, title: a.title, description: a.description, role: a.role, assigneeId: a.assigneeId, priority: a.priority }),
  ),
  planning_guide: {
    description: 'Read the playbook for this key\'s role. Required before any write tool: they refuse until the current guide was read in the last 12 hours.',
    properties: {},
    required: [],
    run: (db, p) => readMcpGuide(db, p),
  },
  story_write_details: inWorkspace(
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
  planning_comment: inWorkspace({ targetKind: { type: 'string', enum: ['document', 'epic', 'story', 'task'] }, targetId: text, body: text }, ['targetKind', 'targetId', 'body'], 'Comment on a planning document, epic, story, or task.', (db, p, a) => commentMcpPlanning(db, p, a.workspaceId, { targetKind: a.targetKind, targetId: a.targetId, body: a.body })),
  story_read: inWorkspace({ storyId: text }, ['storyId'], 'Read a story with its user story, flow, Definition of Done, designs, API contracts, and test cases.', (db, p, a) => readMcpStory(db, p, a.workspaceId, a.storyId)),
  story_attach_design: inWorkspace(
    { storyId: text, title: text, url: { type: 'string', description: 'An http or https link to the design.' }, note: text },
    ['storyId', 'title', 'url'],
    'Attach a design link to a story. The owner, a PM, or a tech lead approves it in the web app.',
    (db, p, a) => attachMcpDesign(db, p, a.workspaceId, a.storyId, { title: a.title, url: a.url, note: a.note }),
  ),
  story_link_api_contract: inWorkspace(
    { storyId: text, requestId: { type: 'string', description: 'Request id from the workspace API collection.' } },
    ['storyId', 'requestId'],
    'Link a request from the workspace API docs to a story as its API contract.',
    (db, p, a) => linkMcpContract(db, p, a.workspaceId, a.storyId, a.requestId),
  ),
  story_write_test_case: inWorkspace(
    { storyId: text, title: text, precondition: text, steps: { type: 'array', items: text }, expected: { type: 'array', items: text } },
    ['storyId', 'title', 'steps', 'expected'],
    'Add a test case to a story. The text is what QA hands to Playwright.',
    (db, p, a) => writeMcpTestCase(db, p, a.workspaceId, a.storyId, { title: a.title, precondition: a.precondition, steps: a.steps, expected: a.expected }),
  ),
  tasks_list_ready: inWorkspace({}, [], 'List tasks assigned to this member that can start now: not done, not waiting for a design approval, and with every dependency done.', (db, p, a) => listMcpReadyTasks(db, p, a.workspaceId)),
  subtasks_list: inWorkspace({ taskId: text }, ['taskId'], 'List the sub-tasks of a task assigned to this member.', (db, p, a) => listMcpSubtasks(db, p, a.workspaceId, a.taskId)),
  subtask_add: inWorkspace({ taskId: text, title: text }, ['taskId', 'title'], 'Add a sub-task to a task assigned to this member.', (db, p, a) => addMcpSubtask(db, p, a.workspaceId, a.taskId, a.title)),
  subtask_set_done: inWorkspace({ taskId: text, subtaskId: text, done: { type: 'boolean' } }, ['taskId', 'subtaskId', 'done'], 'Mark a sub-task of a task assigned to this member as done or not done.', (db, p, a) => setMcpSubtaskDone(db, p, a.workspaceId, a.taskId, a.subtaskId, a.done)),
}

function rpcResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
}

function errorResponse(id: RpcRequest['id'], code: number, message: string): Response {
  return rpcResponse({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
}

function textResult(value: unknown, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(value) }], isError }
}

function toolList(principal: McpPrincipal) {
  return principal.tools.filter((name) => name in tools).map((name) => ({ name, description: tools[name].description, inputSchema: { type: 'object', properties: tools[name].properties, required: tools[name].required, additionalProperties: false } }))
}

export async function handleMcpRequest(ctx: AppContext, request: Request, method: string): Promise<Response> {
  if (method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } })
  const principal = await authenticateMcpKey(ctx.db, bearerToken(request))
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(null, -32700, 'Invalid JSON.')
  }
  if (!isRecord(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string') return errorResponse(null, -32600, 'Invalid request.')
  const rpc = body as RpcRequest
  const id = rpc.id ?? null
  if (rpc.method === 'notifications/initialized') return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } })
  if (rpc.method === 'ping') return rpcResponse({ jsonrpc: '2.0', id, result: {} })
  if (rpc.method === 'initialize')
    return rpcResponse({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
        serverInfo: { name: 'api-documentation-cloud', version: '1.0.0' },
        instructions: serverInstructions(principal.roles),
      },
    })
  if (rpc.method === 'prompts/list')
    return rpcResponse({ jsonrpc: '2.0', id, result: { prompts: promptsFor(principal.roles).map(({ text: _text, ...prompt }) => prompt) } })
  if (rpc.method === 'prompts/get') {
    const params = isRecord(rpc.params) ? rpc.params : {}
    const prompt = promptsFor(principal.roles).find((item) => item.name === params.name)
    if (!prompt) return errorResponse(rpc.id, -32602, 'Prompt not found.')
    const values = isRecord(params.arguments) ? Object.fromEntries(Object.entries(params.arguments).map(([key, value]) => [key, String(value)])) : {}
    if (prompt.arguments.some((argument) => argument.required && !values[argument.name])) return errorResponse(rpc.id, -32602, 'Prompt arguments are missing.')
    return rpcResponse({ jsonrpc: '2.0', id, result: { description: prompt.description, messages: [{ role: 'user', content: { type: 'text', text: prompt.text(values) } }] } })
  }
  if (rpc.method === 'tools/list') return rpcResponse({ jsonrpc: '2.0', id, result: { tools: toolList(principal) } })
  if (rpc.method !== 'tools/call' || !isRecord(rpc.params) || typeof rpc.params.name !== 'string') return errorResponse(rpc.id, -32601, 'Method not found.')

  const name = rpc.params.name
  if (!(name in tools)) return errorResponse(rpc.id, -32602, 'Tool name or arguments are invalid.')
  const args = isRecord(rpc.params.arguments) ? rpc.params.arguments : {}
  try {
    const write = MCP_WRITES[name as McpTool]
    // The playbook is the agent's mandatory context: no write happens until the current version was read.
    if (write && principal.tools.includes(name as McpTool) && !guideIsFresh(principal)) throw new AppError('MCP_GUIDE_REQUIRED')
    const result = await tools[name as McpTool].run(ctx.db, principal, args)
    if (write && typeof args.workspaceId === 'string')
      broadcastPlanningChange(ctx, args.workspaceId, write.scope, principal.userId, await planningAudience(ctx.db, args.workspaceId, write.target(args)))
    return rpcResponse({ jsonrpc: '2.0', id, result: textResult(result) })
  } catch (error) {
    if (error instanceof AppError) return rpcResponse({ jsonrpc: '2.0', id, result: textResult({ code: error.code, error: error.message }, true) })
    throw error
  }
}
