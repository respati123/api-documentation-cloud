-- An agent that retries a write after a timeout sends the same clientRequestId. The first result is kept for a day
-- and returned again, so the retry does not create a second draft. A row without a result is still running.
CREATE TABLE IF NOT EXISTS mcp_request_replays (
  key_id TEXT NOT NULL REFERENCES mcp_keys(id) ON DELETE CASCADE,
  tool TEXT NOT NULL,
  client_request_id TEXT NOT NULL,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key_id, tool, client_request_id)
);
CREATE INDEX IF NOT EXISTS mcp_request_replays_created_idx ON mcp_request_replays(created_at);
