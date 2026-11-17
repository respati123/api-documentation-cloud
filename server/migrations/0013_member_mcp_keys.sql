-- One MCP key per member, valid in every workspace the member belongs to. The admin creates it, the member claims it.
CREATE TABLE IF NOT EXISTS mcp_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  role TEXT NOT NULL CHECK (role IN ('pm', 'tech_lead', 'ui_ux', 'backend', 'frontend', 'mobile', 'qa')),
  tools TEXT[] NOT NULL DEFAULT '{}',
  valid_days INTEGER NOT NULL CHECK (valid_days BETWEEN 1 AND 365),
  claim_expires_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ,
  key_hash TEXT UNIQUE,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS mcp_keys_one_open_per_user ON mcp_keys(user_id) WHERE revoked_at IS NULL;

-- Planning events now point at the new keys. The old per-workspace table stays in place but is no longer read.
ALTER TABLE planning_events DROP CONSTRAINT IF EXISTS planning_events_api_key_id_fkey;

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 60),
  link TEXT NOT NULL CHECK (char_length(link) BETWEEN 1 AND 500),
  data JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC, id);
