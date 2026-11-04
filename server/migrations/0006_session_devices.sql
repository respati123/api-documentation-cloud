-- Each session is listed by its own id, and records which client it belongs to (the web portal or the desktop app) and a device name.
-- The id is not the token hash, so listing sessions never reveals a token. Existing sessions count as web sessions.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client TEXT NOT NULL DEFAULT 'web';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_client_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_client_check CHECK (client IN ('web', 'desktop'));
CREATE UNIQUE INDEX IF NOT EXISTS sessions_id_idx ON sessions (id);
