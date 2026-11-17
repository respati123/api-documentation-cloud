-- The key name is kept on the event, so the log still reads right after the key is renamed or revoked.
ALTER TABLE planning_events ADD COLUMN api_key_name TEXT;

UPDATE planning_events e SET api_key_name = k.name FROM mcp_keys k WHERE k.id = e.api_key_id;
