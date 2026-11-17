export const MCP_SERVER_NAME = 'api-documentation-cloud'
export const MCP_KEY_ENV = 'API_DOCS_MCP_KEY'

// Commands the member pastes into a terminal. The key stays in an environment variable, never in the command itself.
export function setupSnippets(mcpUrl: string) {
  return {
    env: `export ${MCP_KEY_ENV}="apm_..."`,
    claude: `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${mcpUrl} --header "Authorization: Bearer $${MCP_KEY_ENV}"`,
    codex: `codex mcp add ${MCP_SERVER_NAME} --url ${mcpUrl} --bearer-token-env-var ${MCP_KEY_ENV}`,
  }
}
