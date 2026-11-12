export const MCP_KEY_ROLES = ['pm', 'tech_lead', 'ui_ux', 'backend', 'frontend', 'mobile', 'qa'] as const
export type McpKeyRole = (typeof MCP_KEY_ROLES)[number]

export const MCP_TOOLS = [
  'workspaces_list',
  'projects_list',
  'tasks_list_assigned',
  'tasks_get_assigned',
  'tasks_update_assigned_status',
  'tasks_comment_assigned',
  'stories_list_participating',
  'stories_read_participating',
  'stories_comment_participating',
  'planning_list',
  'planning_read_document',
  'planning_draft_prd',
  'planning_draft_item',
  'planning_draft_task',
  'planning_comment',
  'story_read',
  'story_attach_design',
  'story_link_api_contract',
  'story_write_test_case',
  'tasks_list_ready',
  'subtasks_list',
  'subtask_add',
  'subtask_set_done',
  'planning_guide',
  'story_write_details',
] as const
export type McpTool = (typeof MCP_TOOLS)[number]

// Tools that act on planning drafts. A key holding any of them works on planning as a PM would.
export const PLANNING_TOOLS: readonly McpTool[] = ['planning_list', 'planning_read_document', 'planning_draft_prd', 'planning_draft_item', 'planning_draft_task', 'planning_comment']

const memberTools: McpTool[] = [
  'workspaces_list',
  'projects_list',
  'tasks_list_assigned',
  'tasks_get_assigned',
  'tasks_update_assigned_status',
  'tasks_comment_assigned',
  'stories_list_participating',
  'stories_read_participating',
  'stories_comment_participating',
  'story_read',
  'tasks_list_ready',
  'subtasks_list',
  'subtask_add',
  'subtask_set_done',
  'planning_guide',
]

const artifactTools: McpTool[] = ['story_attach_design', 'story_link_api_contract', 'story_write_test_case']
const storyDetailTools: McpTool[] = ['story_write_details']

const roleTools: Record<McpKeyRole, McpTool[]> = {
  pm: [...memberTools, ...PLANNING_TOOLS, ...artifactTools, ...storyDetailTools],
  tech_lead: [...memberTools, 'planning_list', 'planning_read_document', 'planning_draft_task', 'planning_comment', ...artifactTools, ...storyDetailTools],
  ui_ux: [...memberTools, 'story_attach_design'],
  backend: [...memberTools, 'story_link_api_contract'],
  frontend: memberTools,
  mobile: memberTools,
  qa: [...memberTools, 'story_write_test_case'],
}

export function defaultToolsFor(role: McpKeyRole): McpTool[] {
  return [...roleTools[role]]
}

export type McpKeyStatus = 'pending' | 'claim_expired' | 'active' | 'expired' | 'revoked'

export interface McpKeyRow {
  id: string
  userId: string
  createdBy: string | null
  name: string
  role: McpKeyRole
  tools: McpTool[]
  validDays: number
  claimExpiresAt: Date
  claimedAt: Date | null
  expiresAt: Date | null
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export interface McpPrincipal {
  keyId: string
  userId: string
  role: McpKeyRole
  tools: McpTool[]
  guideVersion?: string | null
  guideReadAt?: Date | null
}

// Every key may read its playbook, and a key that drafts epics and stories may also write their details,
// so keys issued before these tools existed keep working without a reissue.
export function effectiveTools(tools: McpTool[]): McpTool[] {
  const result = new Set<McpTool>([...tools, 'planning_guide'])
  if (tools.includes('planning_draft_item')) result.add('story_write_details')
  return [...result]
}
