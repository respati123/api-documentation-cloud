-- A member can hold several roles in a project, for example backend and QA.
ALTER TABLE project_members DROP CONSTRAINT IF EXISTS project_members_pkey;
ALTER TABLE project_members ADD PRIMARY KEY (project_id, user_id, discipline);

-- Members create their own MCP keys, several each. A key no longer carries a role or a tool list:
-- what it may do is read from the member's roles in each workspace when it is used.
-- Keys waiting for a claim are cancelled, because the claim flow is gone. Claimed keys keep working.
UPDATE mcp_keys SET revoked_at = now() WHERE claimed_at IS NULL AND revoked_at IS NULL;
DROP INDEX IF EXISTS mcp_keys_one_open_per_user;
ALTER TABLE mcp_keys ALTER COLUMN role DROP NOT NULL;
ALTER TABLE mcp_keys ALTER COLUMN valid_days DROP NOT NULL;
ALTER TABLE mcp_keys ALTER COLUMN claim_expires_at DROP NOT NULL;
-- The last four characters of the secret, so a member can tell keys apart without seeing the secret.
ALTER TABLE mcp_keys ADD COLUMN IF NOT EXISTS key_suffix TEXT;
CREATE INDEX IF NOT EXISTS mcp_keys_user_open_idx ON mcp_keys(user_id, created_at DESC) WHERE revoked_at IS NULL;
