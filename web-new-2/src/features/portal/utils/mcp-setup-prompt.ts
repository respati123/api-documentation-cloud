export const MCP_SERVER_NAME = 'api-documentation-cloud'

// One prompt for any MCP-capable agent. The agent picks its own command or config format,
// so the same text works for Claude Code, Codex, and other agents.
export function mcpSetupPrompt(endpoint: string, secret: string): string {
  return [
    `Connect this agent to the API Documentation Cloud MCP server, then check that it works. Do not change any other MCP server.`,
    ``,
    `Server name: ${MCP_SERVER_NAME}`,
    `Endpoint: ${endpoint}`,
    `Header: Authorization: Bearer ${secret}`,
    ``,
    `Steps:`,
    `1. Add it as a remote HTTP MCP server, using your own command or config format.`,
    `   - If a server named ${MCP_SERVER_NAME} already exists, remove that entry first. It is the same server, and this key replaces the old one. For Claude Code: claude mcp remove ${MCP_SERVER_NAME} --scope user. For Codex: codex mcp remove ${MCP_SERVER_NAME}. Leave every other server alone.`,
    `   - Claude Code: claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${endpoint} --header "Authorization: Bearer ${secret}"`,
    `   - Codex: in ~/.codex/config.toml add [mcp_servers.${MCP_SERVER_NAME}] with url = "${endpoint}", and [mcp_servers.${MCP_SERVER_NAME}.http_headers] with Authorization = "Bearer ${secret}".`,
    `   - Other agents: use their MCP settings with the same name, endpoint, and header.`,
    `2. Check the connection. Claude Code: claude mcp get ${MCP_SERVER_NAME}. Codex: codex mcp list. It must show as connected. If it does not, fix the endpoint or header and check again.`,
    `3. Test in a fresh session, because the current session cannot load tools from a server it has just added. Claude Code: claude -p "Call the workspaces_list tool from ${MCP_SERVER_NAME} and reply with only the number of workspaces it returned." Codex: codex exec "Call the workspaces_list tool from ${MCP_SERVER_NAME} and reply with only the number of workspaces it returned." If the fresh session returns a number, the server works.`,
    `4. Reply in one line: "Connected: <N> workspaces", using the number from the fresh session. If a step fails, reply "Failed: <step and exact error>". Never repeat the secret value in your reply.`,
  ].join('\n')
}
