export const MCP_KEY_ROLES = ['pm', 'tech_lead', 'ui_ux', 'backend', 'frontend', 'mobile', 'qa'] as const
export type McpKeyRole = (typeof MCP_KEY_ROLES)[number]

export const MCP_TOOLS = [
  'workspaces_list',
  'planning_list',
  'planning_draft_prd',
  'planning_draft_item',
  'planning_draft_task',
  'planning_comment',
  'story_read',
  'story_attach_design',
  'story_link_api_contract',
  'story_link_data_model',
  'story_write_test_case',
  'planning_guide',
  'story_write_details',
  'planning_upload_brd',
  'documents_list',
  'documents_read',
  'api_requests_search',
  'notifications_list',
  'notifications_mark_read',
  'team_members_list',
  'discussion_read',
  'backlog_list',
  'sprint_get_active',
  'issue_read',
  'issues_list',
  'issue_draft',
  'issue_comment',
  'subtask_update_status',
  'checklist_set_done',
  'checklist_add',
  'epic_documents_read',
  'epic_document_draft',
  'epic_document_revise',
  'acceptance_criteria_list',
  'acceptance_criterion_add',
  'acceptance_criterion_update',
  'acceptance_criterion_strike',
  'acceptance_criterion_map',
  'criterion_test_case_write',
  'ticket_read',
  'ticket_readiness',
  'ticket_draft',
  'ticket_update',
  'subtask_add',
] as const
export type McpTool = (typeof MCP_TOOLS)[number]

// Tools that only read. A viewer of a workspace may call these there and nothing else.
export const MCP_READ_TOOLS: readonly McpTool[] = [
  'workspaces_list',
  'planning_list',
  'story_read',
  'planning_guide',
  'documents_list',
  'documents_read',
  'api_requests_search',
  'notifications_list',
  'team_members_list',
  'discussion_read',
  'backlog_list',
  'sprint_get_active',
  'issue_read',
  'issues_list',
  'epic_documents_read',
  'acceptance_criteria_list',
  'ticket_read',
  'ticket_readiness',
]

export function isReadTool(tool: McpTool): boolean {
  return MCP_READ_TOOLS.includes(tool)
}

// Tools that act on planning drafts. A key holding any of them works on planning as a PM would.
export const PLANNING_TOOLS: readonly McpTool[] = ['planning_list', 'planning_draft_prd', 'planning_draft_item', 'planning_draft_task', 'planning_comment']

const memberTools: McpTool[] = [
  'workspaces_list',
  'story_read',
  'planning_guide',
  'api_requests_search',
  'notifications_list',
  'notifications_mark_read',
  'team_members_list',
  'discussion_read',
  'backlog_list',
  'sprint_get_active',
  'issue_read',
  'issues_list',
  'issue_comment',
  'subtask_update_status',
  'checklist_set_done',
  'checklist_add',
  'issue_draft',
  'epic_documents_read',
  'acceptance_criteria_list',
  'ticket_read',
  'ticket_readiness',
  'subtask_add',
]

// Documents the role may read: the PM and tech lead read all of them, backend the BRD and approved PRDs.
const documentTools: McpTool[] = ['documents_list', 'documents_read']

const artifactTools: McpTool[] = ['story_attach_design', 'story_link_api_contract', 'story_link_data_model', 'story_write_test_case']
const storyDetailTools: McpTool[] = ['story_write_details']

// The team standard: the PM writes the spec and its acceptance criteria, the tech lead writes the design and contract
// and splits the epic into tickets, QA writes a test case per criterion. Splitting work into tasks is no longer the PM's.
const pmStandardTools: McpTool[] = ['epic_document_draft', 'epic_document_revise', 'acceptance_criterion_add', 'acceptance_criterion_update', 'acceptance_criterion_strike', 'criterion_test_case_write']
const techLeadStandardTools: McpTool[] = ['epic_document_draft', 'epic_document_revise', 'acceptance_criterion_map', 'criterion_test_case_write', 'ticket_draft', 'ticket_update']

const roleTools: Record<McpKeyRole, McpTool[]> = {
  pm: [...memberTools, ...PLANNING_TOOLS.filter((tool) => tool !== 'planning_draft_task'), 'planning_upload_brd', ...documentTools, ...artifactTools, ...storyDetailTools, ...pmStandardTools],
  tech_lead: [...memberTools, 'planning_list', 'planning_draft_task', 'planning_comment', ...documentTools, ...artifactTools, ...storyDetailTools, ...techLeadStandardTools],
  ui_ux: [...memberTools, 'story_attach_design'],
  backend: [...memberTools, ...documentTools, 'story_link_api_contract', 'story_link_data_model'],
  frontend: memberTools,
  mobile: memberTools,
  qa: [...memberTools, 'story_write_test_case', 'criterion_test_case_write'],
}

export function defaultToolsFor(role: McpKeyRole): McpTool[] {
  return [...roleTools[role]]
}

export function isMcpRole(value: string): value is McpKeyRole {
  return (MCP_KEY_ROLES as readonly string[]).includes(value)
}

// What a member may do through MCP in one workspace: the member tools, plus the tools of each role the owner gave them
// there. A role without its own tools (devops, other) adds nothing, so a member without a role keeps the member tools.
export function toolsForRoles(roles: readonly string[]): McpTool[] {
  const result = new Set<McpTool>(memberTools)
  for (const role of roles) if (isMcpRole(role)) for (const tool of roleTools[role]) result.add(tool)
  return [...result]
}

export const MCP_KEY_LIMIT = 10
export const MCP_KEY_VALID_DAYS = [30, 90, 365] as const

export type McpKeyStatus = 'active' | 'expired' | 'revoked'

export interface McpKeyRow {
  id: string
  userId: string
  name: string
  keySuffix: string | null
  expiresAt: Date | null
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

// roles and tools are the union over every workspace the member belongs to, for tools/list and the playbook.
// Each call is checked again against the roles in the workspace it names.
export interface McpPrincipal {
  keyId: string
  userId: string
  roles: McpKeyRole[]
  tools: McpTool[]
  guideVersion?: string | null
  guideReadAt?: Date | null
}

