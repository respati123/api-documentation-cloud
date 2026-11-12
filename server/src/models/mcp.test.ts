import { describe, expect, test } from 'bun:test'
import { defaultToolsFor, MCP_KEY_ROLES, MCP_TOOLS, type McpTool, PLANNING_TOOLS } from '@/models/mcp'

const memberTools: McpTool[] = ['workspaces_list', 'projects_list', 'tasks_list_assigned', 'tasks_get_assigned', 'tasks_update_assigned_status', 'tasks_comment_assigned', 'stories_list_participating', 'stories_read_participating', 'stories_comment_participating', 'story_read', 'tasks_list_ready', 'subtasks_list', 'subtask_add', 'subtask_set_done', 'planning_guide']

describe('default MCP tools per key role', () => {
  test('pm gets every tool', () => {
    expect(defaultToolsFor('pm').sort()).toEqual([...MCP_TOOLS].sort())
  })

  test('tech_lead reads planning and drafts tasks, but does not draft a PRD or an epic', () => {
    const tools = defaultToolsFor('tech_lead')
    expect(tools).toEqual(expect.arrayContaining([...memberTools, 'planning_list', 'planning_read_document', 'planning_draft_task', 'planning_comment', 'story_attach_design']))
    expect(tools).not.toContain('planning_draft_prd')
    expect(tools).not.toContain('planning_draft_item')
  })

  test.each([
    ['ui_ux', 'story_attach_design'],
    ['backend', 'story_link_api_contract'],
    ['qa', 'story_write_test_case'],
  ] as const)('%s gets the member tools, its own artifact tool, and no planning tool', (role, artifact) => {
    const tools = defaultToolsFor(role)
    expect(tools.sort()).toEqual([...memberTools, artifact].sort())
    expect(tools.some((tool) => PLANNING_TOOLS.includes(tool))).toBe(false)
  })

  test.each(['frontend', 'mobile'] as const)('%s gets the member tools only', (role) => {
    expect(defaultToolsFor(role).sort()).toEqual([...memberTools].sort())
  })

  test('every role can list its workspaces', () => {
    for (const role of MCP_KEY_ROLES) expect(defaultToolsFor(role)).toContain('workspaces_list')
  })

  test('the list returned is a copy', () => {
    defaultToolsFor('qa').push('planning_draft_prd')
    expect(defaultToolsFor('qa')).not.toContain('planning_draft_prd')
  })
})
