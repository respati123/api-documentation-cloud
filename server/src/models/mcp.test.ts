import { describe, expect, test } from 'bun:test'
import { defaultToolsFor, MCP_KEY_ROLES, MCP_TOOLS, type McpTool, PLANNING_TOOLS, toolsForRoles } from '@/models/mcp'

const memberTools: McpTool[] = ['workspaces_list', 'tasks_list_assigned', 'tasks_get_assigned', 'tasks_update_assigned_status', 'tasks_comment_assigned', 'stories_list_participating', 'stories_comment_participating', 'story_read', 'tasks_list_ready', 'subtasks_list', 'subtask_add', 'subtask_set_done', 'planning_guide', 'project_items_list', 'project_tasks_list', 'api_requests_search', 'notifications_list', 'notifications_mark_read', 'team_members_list', 'discussion_read', 'backlog_list', 'sprint_get_active', 'issue_read', 'issue_comment', 'subtask_update_status', 'checklist_set_done', 'issue_draft']

describe('default MCP tools per key role', () => {
  test('pm gets every tool', () => {
    expect(defaultToolsFor('pm').sort()).toEqual([...MCP_TOOLS].sort())
  })

  test('tech_lead reads planning and drafts tasks, but does not draft a PRD or an epic', () => {
    const tools = defaultToolsFor('tech_lead')
    expect(tools).toEqual(expect.arrayContaining([...memberTools, 'issue_draft', 'planning_list', 'documents_read', 'planning_draft_task', 'planning_comment', 'story_attach_design']))
    expect(tools).not.toContain('planning_draft_prd')
    expect(tools).not.toContain('planning_draft_item')
  })

  test.each([
    ['ui_ux', ['story_attach_design']],
    ['backend', ['story_link_api_contract', 'story_link_data_model', 'documents_list', 'documents_read']],
    ['qa', ['story_write_test_case']],
  ] as const)('%s gets the member tools, its own tools, and no planning tool', (role, own) => {
    const tools = defaultToolsFor(role)
    expect(tools.sort()).toEqual([...memberTools, ...own].sort())
    expect(tools.some((tool) => PLANNING_TOOLS.includes(tool))).toBe(false)
  })

  test.each(['frontend', 'mobile'] as const)('%s gets the member tools only', (role) => {
    expect(defaultToolsFor(role).sort()).toEqual([...memberTools].sort())
  })

  test('only backend, the tech lead, and the PM read documents through the document tools', () => {
    for (const role of MCP_KEY_ROLES) expect(defaultToolsFor(role).includes('documents_read')).toBe(['backend', 'tech_lead', 'pm'].includes(role))
  })

  test('every role can list its workspaces', () => {
    for (const role of MCP_KEY_ROLES) expect(defaultToolsFor(role)).toContain('workspaces_list')
  })

  test('the list returned is a copy', () => {
    defaultToolsFor('qa').push('planning_draft_prd')
    expect(defaultToolsFor('qa')).not.toContain('planning_draft_prd')
  })
})

describe('tools from workspace roles', () => {
  test('a member without a role gets the member tools only', () => {
    expect(toolsForRoles([]).sort()).toEqual([...memberTools].sort())
  })

  test('two roles give the tools of both', () => {
    const tools = toolsForRoles(['backend', 'qa'])
    expect(tools).toEqual(expect.arrayContaining(['story_link_api_contract', 'documents_read', 'story_write_test_case']))
    expect(tools).not.toContain('story_attach_design')
    expect(tools.some((tool) => PLANNING_TOOLS.includes(tool))).toBe(false)
  })

  test('a role without MCP tools of its own adds nothing', () => {
    expect(toolsForRoles(['devops', 'other']).sort()).toEqual([...memberTools].sort())
  })

  test('no tool is listed twice', () => {
    const tools = toolsForRoles(['pm', 'tech_lead', 'backend'])
    expect(new Set(tools).size).toBe(tools.length)
  })
})

describe('tools that were removed', () => {
  test('projects_list, stories_read_participating, and planning_read_document are in no list and no role', () => {
    const gone = ['projects_list', 'stories_read_participating', 'planning_read_document']
    for (const tool of gone) expect(MCP_TOOLS as readonly string[]).not.toContain(tool)
    for (const role of MCP_KEY_ROLES) for (const tool of gone) expect(defaultToolsFor(role) as readonly string[]).not.toContain(tool)
  })
})
