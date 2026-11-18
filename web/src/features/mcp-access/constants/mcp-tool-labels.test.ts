import { describe, expect, test } from 'vitest'
import { MCP_TOOL_TEXT } from '@/features/mcp-access/constants/mcp-access-text.constants'
import en from '@/shared/i18n/locales/en/mcp.json'
import id from '@/shared/i18n/locales/id/mcp.json'

describe('MCP tool labels', () => {
  test('every tool has a word in English and in Indonesian', () => {
    for (const [tool, key] of Object.entries(MCP_TOOL_TEXT)) {
      const name = key.replace('mcp:tool.', '')
      expect(name, tool).toBe(tool)
      expect((en.tool as Record<string, string>)[name], `en ${tool}`).toBeTruthy()
      expect((id.tool as Record<string, string>)[name], `id ${tool}`).toBeTruthy()
    }
  })

  test('the issue and sprint tools are listed', () => {
    for (const tool of [
      'backlog_list',
      'sprint_get_active',
      'issue_read',
      'issue_draft',
      'issue_comment',
      'subtask_update_status',
      'checklist_set_done',
    ]) {
      expect(MCP_TOOL_TEXT[tool]).toBe(`mcp:tool.${tool}`)
    }
  })
})
