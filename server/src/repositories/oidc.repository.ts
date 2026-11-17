import type { SQL } from 'bun'

// SQL only. The business rules (checks, hashing, expiry rules) live in services/oidc.ts.

export interface OidcClientRow {
  clientId: string
  name: string
  secretHash: string
  redirectUris: string[]
  postLogoutRedirectUris: string[]
  disabled: boolean
}

export interface OidcClientSummary {
  clientId: string
  name: string
  redirectUris: string[]
  postLogoutRedirectUris: string[]
  disabled: boolean
  createdAt: Date
}

export interface AuthorizationCodeRow {
  clientId: string
  userId: string
  redirectUri: string
  scope: string
  nonce: string
  codeChallenge: string
}

export async function insertClient(
  db: SQL,
  client: { clientId: string; name: string; secretHash: string; redirectUris: string[]; postLogoutRedirectUris: string[] },
): Promise<void> {
  await db`INSERT INTO oidc_clients (client_id, name, secret_hash, redirect_uris, post_logout_redirect_uris)
    VALUES (${client.clientId}, ${client.name}, ${client.secretHash}, ${db.array(client.redirectUris, 'TEXT')}, ${db.array(client.postLogoutRedirectUris, 'TEXT')})`
}

export async function findClient(db: SQL, clientId: string): Promise<OidcClientRow | null> {
  const [row] = await db`SELECT client_id AS "clientId", name, secret_hash AS "secretHash", redirect_uris AS "redirectUris",
    post_logout_redirect_uris AS "postLogoutRedirectUris", disabled_at IS NOT NULL AS disabled
    FROM oidc_clients WHERE client_id = ${clientId}`
  return row ? (row as OidcClientRow) : null
}

// Never returns the secret hash.
export async function listClients(db: SQL): Promise<OidcClientSummary[]> {
  const rows = await db`SELECT client_id AS "clientId", name, redirect_uris AS "redirectUris",
    post_logout_redirect_uris AS "postLogoutRedirectUris", disabled_at IS NOT NULL AS disabled, created_at AS "createdAt"
    FROM oidc_clients ORDER BY created_at DESC`
  return rows as OidcClientSummary[]
}

export async function updateClientSecret(db: SQL, clientId: string, secretHash: string): Promise<boolean> {
  const rows = await db`UPDATE oidc_clients SET secret_hash = ${secretHash} WHERE client_id = ${clientId} RETURNING client_id`
  return rows.length > 0
}

export async function setClientDisabled(db: SQL, clientId: string, disabled: boolean): Promise<void> {
  await db`UPDATE oidc_clients SET disabled_at = ${disabled ? new Date() : null} WHERE client_id = ${clientId}`
}

export async function insertAuthorizationCode(
  db: SQL,
  code: AuthorizationCodeRow & { codeHash: string; expiresAt: Date },
): Promise<void> {
  await db`INSERT INTO oidc_authorization_codes (code_hash, client_id, user_id, redirect_uri, scope, nonce, code_challenge, expires_at)
    VALUES (${code.codeHash}, ${code.clientId}, ${code.userId}, ${code.redirectUri}, ${code.scope}, ${code.nonce}, ${code.codeChallenge}, ${code.expiresAt})`
}

// One statement marks the code as used and reads it, so two requests cannot both get it.
export async function consumeAuthorizationCode(db: SQL, codeHash: string): Promise<AuthorizationCodeRow | null> {
  const [row] = await db`UPDATE oidc_authorization_codes SET used_at = now()
    WHERE code_hash = ${codeHash} AND used_at IS NULL AND expires_at > now()
    RETURNING client_id AS "clientId", user_id AS "userId", redirect_uri AS "redirectUri", scope, nonce, code_challenge AS "codeChallenge"`
  return row ? (row as AuthorizationCodeRow) : null
}

export async function deleteExpiredCodes(db: SQL, expiredBefore: Date): Promise<void> {
  await db`DELETE FROM oidc_authorization_codes WHERE expires_at < ${expiredBefore}`
}
