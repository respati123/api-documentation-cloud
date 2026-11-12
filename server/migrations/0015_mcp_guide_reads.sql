-- Which playbook version a key last read, and when. Write tools refuse until the current version was read recently.
ALTER TABLE mcp_keys ADD COLUMN IF NOT EXISTS guide_version TEXT;
ALTER TABLE mcp_keys ADD COLUMN IF NOT EXISTS guide_read_at TIMESTAMPTZ;
