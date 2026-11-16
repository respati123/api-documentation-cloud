import type { SQL } from 'bun'

const KEEP_FOR = '1 day'

// Claims the clientRequestId for this call. False when another call already holds it within the last day.
export async function reserveMcpReplay(db: SQL, keyId: string, tool: string, clientRequestId: string): Promise<boolean> {
  await db`DELETE FROM mcp_request_replays WHERE key_id = ${keyId} AND tool = ${tool} AND client_request_id = ${clientRequestId} AND created_at < now() - ${KEEP_FOR}::interval`
  const rows = await db`INSERT INTO mcp_request_replays (key_id, tool, client_request_id) VALUES (${keyId}, ${tool}, ${clientRequestId}) ON CONFLICT DO NOTHING RETURNING key_id`
  return rows.length > 0
}

// The stored result, or null while the first call is still running.
export async function findMcpReplay(db: SQL, keyId: string, tool: string, clientRequestId: string): Promise<{ result: unknown } | null> {
  const [row] = await db`SELECT result::text AS result FROM mcp_request_replays WHERE key_id = ${keyId} AND tool = ${tool} AND client_request_id = ${clientRequestId}`
  return row?.result == null ? null : { result: JSON.parse(String(row.result)) }
}

export async function saveMcpReplay(db: SQL, keyId: string, tool: string, clientRequestId: string, result: unknown): Promise<void> {
  await db`UPDATE mcp_request_replays SET result = (${JSON.stringify(result ?? null)}::text)::jsonb WHERE key_id = ${keyId} AND tool = ${tool} AND client_request_id = ${clientRequestId}`
}

// A call that failed releases its id, so the agent can retry it.
export async function releaseMcpReplay(db: SQL, keyId: string, tool: string, clientRequestId: string): Promise<void> {
  await db`DELETE FROM mcp_request_replays WHERE key_id = ${keyId} AND tool = ${tool} AND client_request_id = ${clientRequestId} AND result IS NULL`
}
