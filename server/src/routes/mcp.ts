import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { isRecord } from '@/lib/validation'
import { isReadTool, type McpPrincipal, type McpTool } from '@/models/mcp'
import { findMcpReplay, releaseMcpReplay, reserveMcpReplay, saveMcpReplay } from '@/repositories/mcp-replays.repository'
import { bearerToken } from '@/services/auth'
import { findAppLink, type AppName } from '@/repositories/app-links.repository'
import { appRolesOf } from '@/services/app-access'
import { appActorOf, APPS } from '@/services/app-integrations'
import { broadcastPlanningChange, type PlanningScope } from '@/services/events'
import { type AudienceTarget, commentTarget, planningAudience } from '@/services/planning-audience'
import { addMcpChecklistItem, listMcpIssues, commentMcpIssue, draftMcpIssue, getMcpActiveSprint, guideIsFresh, listMcpBacklog, readMcpGuide, readMcpIssue, setMcpChecklistItemDone, updateMcpSubtaskStatus, writeMcpStoryDetails } from '@/services/mcp-access'
import { promptsFor, serverInstructions } from '@/services/mcp-guides'
import {
  addMcpCriterion,
  addMcpSubtask,
  draftMcpEpicDocument,
  draftMcpTicket,
  listMcpCriteria,
  mapMcpCriterion,
  readMcpEpicDocuments,
  readMcpReadiness,
  readMcpTicket,
  reviseMcpEpicDocument,
  strikeMcpCriterion,
  updateMcpCriterion,
  updateMcpTicket,
  writeMcpCriterionTestCase,
} from '@/services/mcp-standard'
import { attachMcpDesign, linkMcpContract, linkMcpDataModel, requireAppWorkspace, readMcpStory, writeMcpTestCase } from '@/services/mcp-access'
import { authenticateMcpKey, commentMcpPlanning, draftMcpItem, draftMcpPrd, draftMcpTask, listMcpPlanning, listMcpWorkspaces, uploadMcpBrd } from '@/services/mcp-access'
import { listMcpDocuments, readMcpReadableDocument } from '@/services/mcp-access'
import { DOCUMENT_URI_TEMPLATE, listMcpDocumentResources, listMcpTeamMembers, readMcpDiscussion, listMcpNotifications, markMcpNotificationsRead, readMcpDocumentResource, searchMcpApiRequests } from '@/services/mcp-access'

export const MCP_CALLS_PER_MINUTE = 240
// Newest first. initialize answers with the client's version when it is here, and with the first one otherwise.
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26']

const RPC = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, unauthorized: -32001, resourceNotFound: -32002, rateLimited: -32003 }

// Tools that change project data: which part of the project open pages should reload, and who may read the change.
const MCP_WRITES: Partial<Record<McpTool, { scope: PlanningScope; target: (args: Args) => AudienceTarget }>> = {
  planning_upload_brd: { scope: 'documents', target: () => ({ kind: 'managers' }) },
  planning_draft_prd: { scope: 'documents', target: () => ({ kind: 'managers' }) },
  planning_draft_item: { scope: 'items', target: () => ({ kind: 'managers' }) },
  planning_draft_task: { scope: 'items', target: () => ({ kind: 'managers' }) },
  planning_comment: { scope: 'comments', target: (a) => commentTarget(String(a.targetKind), String(a.targetId)) },
  story_attach_design: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  story_link_api_contract: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  story_link_data_model: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  story_write_test_case: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  story_write_details: { scope: 'items', target: (a) => ({ kind: 'item', id: String(a.storyId) }) },
  issue_draft: { scope: 'items', target: () => ({ kind: 'managers' }) },
  issue_comment: { scope: 'comments', target: (a) => ({ kind: 'item', id: String(a.issueId) }) },
  subtask_update_status: { scope: 'items', target: () => ({ kind: 'everyone' }) },
  checklist_set_done: { scope: 'items', target: () => ({ kind: 'everyone' }) },
  checklist_add: { scope: 'items', target: () => ({ kind: 'everyone' }) },
  epic_document_draft: { scope: 'documents', target: () => ({ kind: 'managers' }) },
  epic_document_revise: { scope: 'documents', target: () => ({ kind: 'managers' }) },
  acceptance_criterion_add: { scope: 'items', target: () => ({ kind: 'managers' }) },
  acceptance_criterion_update: { scope: 'items', target: () => ({ kind: 'managers' }) },
  acceptance_criterion_strike: { scope: 'items', target: () => ({ kind: 'managers' }) },
  acceptance_criterion_map: { scope: 'items', target: () => ({ kind: 'managers' }) },
  criterion_test_case_write: { scope: 'items', target: () => ({ kind: 'managers' }) },
  ticket_draft: { scope: 'items', target: () => ({ kind: 'managers' }) },
  ticket_update: { scope: 'items', target: () => ({ kind: 'managers' }) },
  subtask_add: { scope: 'items', target: () => ({ kind: 'everyone' }) },
}

// Writes that add something. A retry with the same clientRequestId returns the first result instead of adding twice.
const REPLAYABLE = new Set<McpTool>([
  'planning_upload_brd',
  'planning_draft_prd',
  'planning_draft_item',
  'planning_draft_task',
  'planning_comment',
  'story_attach_design',
  'story_link_api_contract',
  'story_link_data_model',
  'story_write_test_case',
  'issue_draft',
  'issue_comment',
  'checklist_add',
  'epic_document_draft',
  'acceptance_criterion_add',
  'criterion_test_case_write',
  'ticket_draft',
  'subtask_add',
])
// story_write_details replaces the Definition of Done. Setting a status or a done flag twice changes nothing more.
const DESTRUCTIVE = new Set<McpTool>(['story_write_details'])
const IDEMPOTENT = new Set<McpTool>(['subtask_update_status', 'checklist_set_done', 'story_write_details', 'notifications_mark_read', 'acceptance_criterion_update', 'acceptance_criterion_map', 'ticket_update'])

type RpcRequest = { id?: string | number | null; method?: string; params?: unknown }
type Args = Record<string, unknown>
type ToolDefinition = { title: string; description: string; properties: Record<string, unknown>; required: string[]; run: (db: SQL, principal: McpPrincipal, args: Args, ctx: AppContext) => Promise<unknown> }

const text = { type: 'string' }
const workspaceId = { type: 'string', description: 'Workspace id from workspaces_list.' }
const commentBody = { type: 'string', description: 'The comment. Write @handle to mention a member; find handles with team_members_list.' }
const parentId = { type: 'string', description: 'Id of the comment you answer, from discussion_read. Leave out to start a new thread.' }
const clientRequestId = { type: 'string', maxLength: 100, description: 'Optional id you choose for this write. Send the same id when you retry after a timeout, and the first result comes back instead of a second copy.' }

const ticketProperties = {
  role: { type: 'string', enum: ['backend', 'frontend', 'mobile', 'qa', 'ui_ux'], description: 'The role of the ticket. It gives the ticket its code, such as AUTH-001-BE-2.' },
  repo: text,
  goal: text,
  scope: text,
  designNotes: { type: 'string', description: 'The decisions this ticket implements: endpoints, fields, states, rules, error codes. Never just "see design".' },
  codeFollow: { type: 'string', description: 'An existing path to copy the pattern from.' },
  codeTouch: { type: 'string', description: 'The paths or modules expected to change.' },
  ticketAcs: { type: 'array', items: { type: 'object', properties: { given: text, when: text, then: { type: 'array', items: text } }, required: ['given', 'when', 'then'] }, description: 'The parent criteria restated as technical checks.' },
  requiredTests: { type: 'array', items: { type: 'object', properties: { case: text, unhappy: { type: 'boolean' } }, required: ['case', 'unhappy'] }, description: 'Concrete cases, at least one unhappy path.' },
  outOfScope: { type: 'string', description: 'Work in other tickets, with their codes.' },
  skills: { type: 'array', items: text, description: 'Engineering skills, such as api-endpoint, db-migration, ui-component, mobile-screen.' },
  size: { type: 'string', enum: ['S', 'M', 'L'], description: 'S up to a day, M two to three days. L means split it.' },
  usesApi: { type: 'boolean', description: 'False when the ticket neither builds nor calls an API, so it does not wait for the contract.' },
  openQuestions: { type: 'string', description: 'A question that blocks the ticket. Leave empty when none.' },
  acNumbers: { type: 'array', items: { type: 'integer', minimum: 1 }, description: 'The acceptance criteria of the epic this ticket delivers.' },
  dependsOn: { type: 'array', items: text, description: 'Ticket codes, keys or ids of the work that must finish first. Replaces the current list.' },
}

function inWorkspace(title: string, properties: Record<string, unknown>, required: string[], description: string, run: ToolDefinition['run']): ToolDefinition {
  return { title, description, properties: { workspaceId, ...properties }, required: ['workspaceId', ...required], run }
}

const tools: Record<McpTool, ToolDefinition> = {
  backlog_list: inWorkspace('Read the backlog', { limit: { type: 'integer', minimum: 1, maximum: 100 }, cursor: { type: 'string', description: 'The nextCursor of the previous answer, to read the next page of loose items.' } }, [], 'Read the backlog of the project: the planned and active sprints with their items, then the items that belong to no sprint, in rank order. Drafts are shown only to the PM and the tech lead.', (db, p, a) => listMcpBacklog(db, p, a.workspaceId, { limit: a.limit, cursor: a.cursor })),
  sprint_get_active: inWorkspace('Read the active sprint', {}, [], 'Read the sprint that is running now, with its goal, dates, and items. The sprint is null when none is running.', (db, p, a) => getMcpActiveSprint(db, p, a.workspaceId)),
  issue_read: inWorkspace('Read an issue', { issueId: { type: 'string', description: 'The id of the issue, or its key such as PARI-12.' } }, ['issueId'], 'Read one epic, story, task, bug, or sub-task with its checklist and links.', (db, p, a) => readMcpIssue(db, p, a.workspaceId, a.issueId)),
  issues_list: inWorkspace(
    'List issues',
    {
      type: { type: 'string', enum: ['epic', 'story', 'task', 'bug', 'subtask'] },
      involvement: { type: 'string', enum: ['assigned', 'participating'], description: 'assigned keeps what is assigned to you. participating keeps the stories you take part in.' },
      parentId: { type: 'string', description: 'The id of an epic, for its items, or of a story, task, or bug, for its sub-tasks.' },
      ready: { type: 'boolean', description: 'True lists the work assigned to you that can start: not done, and every blocker done. Work that waits for the design approval of its story is listed with locked true.' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
      cursor: { type: 'string', description: 'The nextCursor of the previous answer, to read the next page.' },
    },
    [],
    'List the issues of the project in the order of their numbers, a page at a time. Drafts show to the PM and the tech lead only. Read one issue with issue_read.',
    (db, p, a) => listMcpIssues(db, p, a.workspaceId, a),
  ),
  issue_draft: inWorkspace(
    'Draft an issue',
    {
      type: { type: 'string', enum: ['epic', 'story', 'task', 'bug', 'subtask'] },
      title: text,
      description: text,
      acceptanceCriteria: text,
      parentId: { type: 'string', description: 'An epic for a story, task, or bug. A story, task, or bug for a sub-task, which is required there.' },
      points: { type: 'integer', enum: [1, 2, 3, 5, 8, 13] },
      priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
      role: { type: 'string', enum: ['ui_ux', 'backend', 'frontend', 'mobile', 'qa'], description: 'The role of a sub-task. Required for a sub-task.' },
      assigneeId: text,
      featurePrefix: { type: 'string', description: 'For an epic: the product area of its feature code, 2 to 8 capital letters such as AUTH. Leave out to use the project key.' },
      clientRequestId,
    },
    ['type', 'title'],
    'Draft an epic, story, task, bug, or sub-task. A draft waits for the PM or the tech lead to publish it. The PM and the tech lead draft epics, stories, and tasks, and any member drafts a bug. A sub-task is drafted by the tech lead, or by a member whose role matches it. Follow planning_guide for what a good story holds.',
    (db, p, a) => draftMcpIssue(db, p, a.workspaceId, a),
  ),
  issue_comment: inWorkspace('Comment on an issue', { issueId: text, body: commentBody, parentId, clientRequestId }, ['issueId', 'body'], 'Comment on an issue you may read, or answer a comment on it. Write @handle to mention a member.', (db, p, a) => commentMcpIssue(db, p, a.workspaceId, a.issueId, { body: a.body, parentId: a.parentId })),
  subtask_update_status: inWorkspace('Move my sub-task', { subtaskId: text, status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'] } }, ['subtaskId', 'status'], 'Change the status of a sub-task assigned to this member. The first sub-task to start moves its Ready story to In Progress.', (db, p, a) => updateMcpSubtaskStatus(db, p, a.workspaceId, a.subtaskId, a.status)),
  checklist_set_done: inWorkspace('Tick a checklist line', { issueId: text, itemId: text, done: { type: 'boolean' } }, ['issueId', 'itemId', 'done'], 'Tick or untick one line of the checklist of an issue assigned to this member.', (db, p, a) => setMcpChecklistItemDone(db, p, a.workspaceId, a.issueId, a.itemId, a.done)),
  checklist_add: inWorkspace('Add a checklist line', { issueId: text, title: text, clientRequestId }, ['issueId', 'title'], 'Add one line to the checklist of an issue assigned to this member. Read the checklist with issue_read, and tick a line with checklist_set_done.', (db, p, a) => addMcpChecklistItem(db, p, a.workspaceId, a.issueId, a.title)),
  workspaces_list: { title: 'List workspaces', description: 'List the workspaces this member belongs to. Every other tool needs one of these ids.', properties: {}, required: [], run: (db, p) => listMcpWorkspaces(db, p) },
  documents_list: inWorkspace('List documents', {}, [], 'List the BRDs and PRDs this key may read: all of them for the PM and the tech lead, approved ones for backend.', (db, p, a) => listMcpDocuments(db, p, a.workspaceId)),
  documents_read: inWorkspace('Read a document', { documentId: text }, ['documentId'], 'Read a BRD or PRD this key may read, with its version history.', (db, p, a) => readMcpReadableDocument(db, p, a.workspaceId, a.documentId)),
  planning_list: inWorkspace('Planning overview', {}, [], 'List planning documents, epics, stories and draft tasks of the workspace.', (db, p, a) => listMcpPlanning(db, p, a.workspaceId)),
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
  story_link_data_model: inWorkspace(
    'Link a data model table',
    {
      storyId: text,
      projectId: { type: 'string', description: 'DBDesign project id. It must be linked to the workspace; find it with dbdesign_projects_list.' },
      tableId: { type: 'string', description: 'Table id from dbdesign_project_get.' },
      clientRequestId,
    },
    ['storyId', 'projectId', 'tableId'],
    'Add a table from a DBDesign project linked to the workspace to the story data model, next to its API contracts.',
    (db, p, a, ctx) => linkMcpDataModel(db, ctx.apps, p, a.workspaceId, a.storyId, { projectId: a.projectId, tableId: a.tableId }),
  ),
  story_write_test_case: inWorkspace(
    'Write a test case',
    { storyId: text, title: text, precondition: text, steps: { type: 'array', items: text }, expected: { type: 'array', items: text }, clientRequestId },
    ['storyId', 'title', 'steps', 'expected'],
    'Add a test case to a story. The text is what QA hands to Playwright.',
    (db, p, a) => writeMcpTestCase(db, p, a.workspaceId, a.storyId, { title: a.title, precondition: a.precondition, steps: a.steps, expected: a.expected }),
  ),
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
  epic_documents_read: inWorkspace('Read the documents of an epic', { epicId: { type: 'string', description: 'The epic id, key such as PARI-3, or feature code such as AUTH-001.' } }, ['epicId'], 'Read the spec, design and contract of an epic, with their status, version, sections and staleness, and for each kind what it still waits for (blocked). Members see approved documents; the PM and tech lead see drafts too.', (db, p, a) => readMcpEpicDocuments(db, p, a.workspaceId, a.epicId)),
  epic_document_draft: inWorkspace(
    'Draft a spec, design or contract',
    {
      epicId: text,
      kind: { type: 'string', enum: ['spec', 'design', 'contract'] },
      title: text,
      sections: { type: 'object', additionalProperties: { type: 'string' }, description: 'Every section of the kind, as named in planning_guide. Write "None" for a section with nothing in it.' },
      clientRequestId,
    },
    ['epicId', 'kind', 'sections'],
    'Draft the spec (PM) or the design or contract (tech lead) of an epic, following planning_guide. A design waits for an approved spec, a contract for an approved design. Missing sections are named in EPIC_DOCUMENT_INCOMPLETE. A person approves it in the web app.',
    (db, p, a) => draftMcpEpicDocument(db, p, a.workspaceId, a),
  ),
  epic_document_revise: inWorkspace(
    'Revise a spec, design or contract',
    { epicId: text, documentId: text, expectedVersion: { type: 'integer', minimum: 1, description: 'The version you read. A newer one is a conflict: read again.' }, title: text, sections: { type: 'object', additionalProperties: { type: 'string' } } },
    ['epicId', 'documentId', 'expectedVersion', 'sections'],
    'Save a new version of an epic document with all its sections. It goes back to draft and needs approval again. A design revised after a new spec is approved catches up with it.',
    (db, p, a) => reviseMcpEpicDocument(db, p, a.workspaceId, a),
  ),
  acceptance_criteria_list: inWorkspace('Read acceptance criteria', { epicId: text }, ['epicId'], 'Read the acceptance criteria of an epic as Given / When / Then, with their number, status, design mapping, coverage, the tickets and test cases that point at each, and the work flagged by struck criteria.', (db, p, a) => listMcpCriteria(db, p, a.workspaceId, a.epicId)),
  acceptance_criterion_add: inWorkspace(
    'Add an acceptance criterion',
    {
      epicId: text,
      flow: { type: 'string', description: 'The flow it belongs to, such as Sign in.' },
      title: text,
      given: { type: 'string', description: 'The starting state, with concrete data.' },
      when: { type: 'string', description: 'The one action.' },
      then: { type: 'array', items: text, minItems: 1, maxItems: 10, description: 'Every observable outcome: exact message text, limits, timings.' },
      clientRequestId,
    },
    ['epicId', 'title', 'given', 'when', 'then'],
    'Add an acceptance criterion to the spec of an epic while the spec is a draft (PM). The server gives it the next number, never reused.',
    (db, p, a) => addMcpCriterion(db, p, a.workspaceId, a),
  ),
  acceptance_criterion_update: inWorkspace(
    'Edit an acceptance criterion',
    { epicId: text, number: { type: 'integer', minimum: 1 }, flow: text, title: text, given: text, when: text, then: { type: 'array', items: text } },
    ['epicId', 'number', 'title', 'given', 'when', 'then'],
    'Replace the text of an active acceptance criterion while the spec is a draft (PM).',
    (db, p, a) => updateMcpCriterion(db, p, a.workspaceId, a),
  ),
  acceptance_criterion_strike: inWorkspace(
    'Strike an acceptance criterion',
    { epicId: text, number: { type: 'integer', minimum: 1 }, reason: { type: 'string', description: 'Why, and where the work went, such as Moved to AUTH-004.' } },
    ['epicId', 'number', 'reason'],
    'Strike an acceptance criterion instead of deleting it, while the spec is a draft (PM). Its number stays taken, and the tickets and test cases that point at it are flagged.',
    (db, p, a) => strikeMcpCriterion(db, p, a.workspaceId, a),
  ),
  acceptance_criterion_map: inWorkspace(
    'Map a criterion to the design',
    {
      epicId: text,
      number: { type: 'integer', minimum: 1 },
      entries: {
        type: 'array',
        items: { type: 'object', properties: { repo: { type: 'string', enum: ['backend', 'web', 'mobile', 'qa', 'ui_ux'] }, component: text, testLevel: { type: 'string', enum: ['unit', 'integration', 'e2e', 'manual'] } }, required: ['repo', 'component', 'testLevel'] },
      },
    },
    ['epicId', 'number', 'entries'],
    'Say where the design satisfies an acceptance criterion: repo, component and test level, while the design is a draft (tech lead). Replaces the current mapping.',
    (db, p, a) => mapMcpCriterion(db, p, a.workspaceId, a),
  ),
  criterion_test_case_write: inWorkspace(
    'Write a test case for a criterion',
    { epicId: text, number: { type: 'integer', minimum: 1 }, title: text, precondition: text, steps: { type: 'array', items: text }, expected: { type: 'array', items: text }, clientRequestId },
    ['epicId', 'number', 'title', 'steps', 'expected'],
    'Add a test case that checks one active acceptance criterion of an epic (QA, PM or tech lead).',
    (db, p, a) => writeMcpCriterionTestCase(db, p, a.workspaceId, a),
  ),
  ticket_read: inWorkspace('Read a ticket', { ticketId: { type: 'string', description: 'The ticket code such as AUTH-001-BE-2, the key, or the id.' } }, ['ticketId'], 'Read a ticket with everything needed to start: its fields, readiness, the acceptance criteria it delivers, its sub-tasks, and the contract of its epic.', (db, p, a) => readMcpTicket(db, p, a.workspaceId, a.ticketId)),
  ticket_readiness: inWorkspace('Check a ticket against the Definition of Ready', { ticketId: text }, ['ticketId'], 'Check a ticket against the nine items of the Definition of Ready. Returns ready, and each failing item with its rule and reason.', (db, p, a) => readMcpReadiness(db, p, a.workspaceId, a.ticketId)),
  ticket_draft: inWorkspace(
    'Draft a ticket',
    { epicId: text, title: text, priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] }, assigneeId: text, ...ticketProperties, clientRequestId },
    ['epicId', 'title', 'role'],
    'Draft one ticket under an epic (tech lead), following the ticket rules of planning_guide: the task, its ticket fields, the acceptance criteria it delivers, and what it depends on. The answer carries the ticket code and its readiness. A person publishes it.',
    (db, p, a) => draftMcpTicket(db, p, a.workspaceId, a),
  ),
  ticket_update: inWorkspace(
    'Update a ticket',
    { ticketId: text, ...ticketProperties },
    ['ticketId'],
    'Update the fields, criteria or dependencies of a ticket (tech lead). Fields left out keep their value. The answer carries its readiness.',
    (db, p, a) => updateMcpTicket(db, p, a.workspaceId, a),
  ),
  subtask_add: inWorkspace('Add a sub-task to a ticket', { ticketId: text, title: text, description: text, clientRequestId }, ['ticketId', 'title'], 'Add a step to a ticket you work on. It is assigned to you and shows right away. Move it with subtask_update_status. Sub-tasks never change the ticket scope.', (db, p, a) => addMcpSubtask(db, p, a.workspaceId, a)),
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
  return principal.tools
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
      return rpcResponse({ jsonrpc: '2.0', id, result: { tools: [...toolList(principal), ...(await appToolList(ctx, principal))] } })
    case 'tools/call':
      if (typeof params.name === 'string' && appOfTool(params.name)) return callAppTool(ctx, principal, id, params)
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
    // The details name what to fix: missing sections, the approval a step waits for, failing readiness items.
    if (error instanceof AppError) return refused({ code: error.code, error: error.message, ...(error.details === undefined ? {} : { details: error.details }) })
    throw error
  }
}

async function runTool(ctx: AppContext, principal: McpPrincipal, tool: McpTool, args: Args, replayId: string | null): Promise<unknown> {
  try {
    const result = await tools[tool].run(ctx.db, principal, args, ctx)
    if (replayId) await saveMcpReplay(ctx.db, principal.keyId, tool, replayId, result)
    return result
  } catch (error) {
    if (replayId) await releaseMcpReplay(ctx.db, principal.keyId, tool, replayId)
    throw error
  }
}

// DBDesign and Stitchkit tools, offered through this endpoint so an agent keeps one portal key. Each call is sent to the
// app with a 60-second service token for the member, so the app applies the member's own access there too.
// Stitchkit tool names get a stitchkit_ prefix. DBDesign tools already start with dbdesign_.
const APP_PREFIX: Record<AppName, string> = { dbdesign: '', stitchkit: 'stitchkit_' }
const APP_LABEL: Record<AppName, string> = { dbdesign: 'DBDesign', stitchkit: 'Stitchkit' }
// Projects are created, removed, and shared in the app itself, then linked to the workspace by its owner.
const BLOCKED_APP_TOOLS = new Set([
  'dbdesign_project_create',
  'dbdesign_project_trash',
  'dbdesign_project_restore',
  'dbdesign_projects_trash',
  'dbdesign_project_invite',
  'stitchkit_create_project',
])
const APP_TOOLS_TTL_MS = 5 * 60_000
type AppTool = { name: string; title?: string; description?: string; inputSchema?: { properties?: Record<string, unknown>; required?: string[] }; annotations?: Record<string, unknown> }
const appToolCache = new Map<AppName, { at: number; tools: AppTool[] }>()

function appOfTool(name: string): AppName | null {
  if (name.startsWith('dbdesign_')) return 'dbdesign'
  if (name.startsWith('stitchkit_')) return 'stitchkit'
  return null
}

// Only a good answer is cached. A failed answer is never stored, so the next list asks the app again.
async function appToolsOf(ctx: AppContext, app: AppName, principal: McpPrincipal): Promise<AppTool[]> {
  const cached = appToolCache.get(app)
  if (cached && Date.now() - cached.at < APP_TOOLS_TTL_MS) return cached.tools
  const answer = await ctx.apps.mcp(app, await appActorOf(ctx.db, principal.userId), 'tools/list', {})
  const listed = (answer.result as { tools?: unknown } | undefined)?.tools
  if (answer.error || !Array.isArray(listed)) throw new AppError('APP_UNAVAILABLE')
  const tools = listed as AppTool[]
  appToolCache.set(app, { at: Date.now(), tools })
  return tools
}

// Tests start from an empty cache, so one test's app answers do not leak into another.
export function resetAppToolCacheForTests(): void {
  appToolCache.clear()
}

async function appToolList(ctx: AppContext, principal: McpPrincipal) {
  const listed = []
  const access = await appRolesOf(ctx.db, principal.userId)
  for (const app of APPS) {
    if (!ctx.apps.enabled(app) || access[app] === 'none') continue
    let tools: AppTool[]
    try {
      tools = await appToolsOf(ctx, app, principal)
    } catch (error) {
      // An app that is down leaves the portal tools working. Its tools come back on the next list.
      if (!(error instanceof AppError)) throw error
      ctx.logger.warn('mcp.app_tools_unavailable', { app, code: error.code })
      continue
    }
    for (const tool of tools) {
      const name = `${APP_PREFIX[app]}${tool.name}`
      if (BLOCKED_APP_TOOLS.has(name)) continue
      // Changes are listed only to the members the app gives edit rights (Stitchkit: UI/UX).
      if (!tool.annotations?.readOnlyHint && access[app] !== 'editor') continue
      listed.push({
        name,
        title: `${APP_LABEL[app]}: ${tool.title ?? tool.name}`,
        description: `${tool.description ?? ''} Needs workspaceId, and a project linked to that workspace under Design.`.trim(),
        inputSchema: {
          type: 'object',
          properties: { workspaceId, ...(tool.inputSchema?.properties ?? {}) },
          required: ['workspaceId', ...(tool.inputSchema?.required ?? []).filter((field) => field !== 'workspaceId')],
        },
        annotations: { ...(tool.annotations ?? {}), openWorldHint: true },
      })
    }
  }
  return listed
}

async function callAppTool(ctx: AppContext, principal: McpPrincipal, id: RpcRequest['id'], params: Args): Promise<Response> {
  const name = String(params.name)
  const app = appOfTool(name) as AppName
  const args = isRecord(params.arguments) ? { ...params.arguments } : {}
  const refused = (value: unknown) => rpcResponse({ jsonrpc: '2.0', id, result: textResult(value, true) })
  try {
    if (!ctx.apps.enabled(app)) throw new AppError('APP_NOT_CONFIGURED')
    if (BLOCKED_APP_TOOLS.has(name)) throw new AppError('MCP_PERMISSION_DENIED')
    const tools = await appToolsOf(ctx, app, principal)
    const readOnly = tools.find((tool) => `${APP_PREFIX[app]}${tool.name}` === name)?.annotations?.readOnlyHint === true
    const workspaceId = await requireAppWorkspace(ctx.db, principal, app, args.workspaceId, !readOnly)
    // A tool that names a project may only touch a project linked to this workspace.
    if (typeof args.projectId === 'string' && !(await findAppLink(ctx.db, workspaceId, app, args.projectId))) throw new AppError('APP_PROJECT_NOT_LINKED')
    delete args.workspaceId
    const answer = await ctx.apps.mcp(app, await appActorOf(ctx.db, principal.userId), 'tools/call', { name: name.slice(APP_PREFIX[app].length), arguments: args })
    if (answer.error) return refused({ code: 'APP_TOOL_FAILED', error: answer.error.message })
    return rpcResponse({ jsonrpc: '2.0', id, result: answer.result })
  } catch (error) {
    if (error instanceof AppError) return refused({ code: error.code, error: error.message })
    throw error
  }
}
