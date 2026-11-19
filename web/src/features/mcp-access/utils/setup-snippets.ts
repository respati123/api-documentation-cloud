export const MCP_SERVER_NAME = 'api-documentation-cloud'

export function setupSnippets(mcpUrl: string, secret: string) {
  const codexConfig = [
    '',
    '',
    `[mcp_servers.${MCP_SERVER_NAME}]`,
    `url = ${JSON.stringify(mcpUrl)}`,
    '',
    `[mcp_servers.${MCP_SERVER_NAME}.http_headers]`,
    `Authorization = ${JSON.stringify(`Bearer ${secret}`)}`,
    '',
  ].join('\n')
  const codexScript = [
    'from pathlib import Path; import re;',
    'path = Path.home() / ".codex/config.toml";',
    'content = path.read_text() if path.exists() else "";',
    `content = re.sub(r"(?ms)^\\[mcp_servers\\.${MCP_SERVER_NAME}(?:\\.[^\\]]+)?\\]\\n.*?(?=^\\[|\\Z)", "", content).rstrip();`,
    'path.parent.mkdir(parents=True, exist_ok=True);',
    `path.write_text(content + ${JSON.stringify(codexConfig)});`,
  ].join(' ')

  return {
    claude: `claude mcp add --transport http --scope user ${MCP_SERVER_NAME} ${mcpUrl} --header "Authorization: Bearer ${secret}"`,
    codex: `python3 -c '${codexScript}'`,
  }
}
