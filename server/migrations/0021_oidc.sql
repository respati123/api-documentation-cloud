-- OpenID Connect provider: the apps that may sign users in, and the one-time codes they receive.
CREATE TABLE IF NOT EXISTS oidc_clients (
  client_id TEXT PRIMARY KEY CHECK (client_id ~ '^[a-z0-9-]{3,40}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  secret_hash TEXT NOT NULL,
  redirect_uris TEXT[] NOT NULL,
  post_logout_redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oidc_authorization_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES oidc_clients(client_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  scope TEXT NOT NULL,
  nonce TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oidc_authorization_codes_expires_idx ON oidc_authorization_codes (expires_at);
