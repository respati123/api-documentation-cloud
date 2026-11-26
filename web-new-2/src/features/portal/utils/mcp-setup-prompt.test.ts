import { describe, expect, it } from 'vitest'
import { mcpSetupPrompt } from './mcp-setup-prompt'

const endpoint = 'https://docs.example.test/api/mcp'
const secret = 'apm_TESTKEY0000000000000000'

describe('mcpSetupPrompt', () => {
  const prompt = mcpSetupPrompt(endpoint, secret)

  it('names the server and endpoint, with the bearer header', () => {
    expect(prompt).toContain('Server name: api-documentation-cloud')
    expect(prompt).toContain(`Endpoint: ${endpoint}`)
    expect(prompt).toContain(`Header: Authorization: Bearer ${secret}`)
  })

  it('replaces an existing entry with the same name instead of keeping it', () => {
    expect(prompt).toContain('claude mcp remove api-documentation-cloud --scope user')
    expect(prompt).toContain('codex mcp remove api-documentation-cloud')
    expect(prompt).not.toMatch(/keep it\./)
  })

  it('verifies in a fresh session by calling workspaces_list', () => {
    expect(prompt).toContain('claude -p "Call the workspaces_list tool')
    expect(prompt).toContain('codex exec "Call the workspaces_list tool')
  })

  it('tells the agent not to repeat the secret', () => {
    expect(prompt).toContain('Never repeat the secret value')
  })
})
