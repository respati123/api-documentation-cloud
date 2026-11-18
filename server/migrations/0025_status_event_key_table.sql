-- issue_status_events pointed at mcp_api_keys, the table of the first key design. The keys in use live in mcp_keys.
-- A row whose key is not in mcp_keys keeps the event and loses the key.
UPDATE issue_status_events SET api_key_id = NULL WHERE api_key_id IS NOT NULL AND api_key_id NOT IN (SELECT id FROM mcp_keys);
ALTER TABLE issue_status_events DROP CONSTRAINT issue_status_events_api_key_id_fkey;
ALTER TABLE issue_status_events ADD CONSTRAINT issue_status_events_api_key_id_fkey FOREIGN KEY (api_key_id) REFERENCES mcp_keys(id) ON DELETE SET NULL;
