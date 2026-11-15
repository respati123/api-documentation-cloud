-- Claiming a key needs the one-time token from the email link, kept here as a hash.
ALTER TABLE mcp_keys ADD COLUMN claim_token_hash TEXT;
