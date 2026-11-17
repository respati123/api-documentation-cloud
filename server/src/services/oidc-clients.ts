import { randomBytes } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { findClient, insertClient, listClients, setClientDisabled, updateClientSecret, type OidcClientSummary } from '@/repositories/oidc.repository'
import { tokenHash } from '@/services/auth'

const CLIENT_ID = /^[a-z0-9-]{3,40}$/

// https everywhere, and http only for a local address on this machine (for development).
export function isAllowedRedirectUri(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol === 'https:') return true
  return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
}

function requireAllowedUris(uris: string[]): void {
  if (uris.some((uri) => !isAllowedRedirectUri(uri))) throw new AppError('OIDC_REDIRECT_URI_INVALID')
}

// Creates a client. The secret is returned once. Only its hash is stored.
export async function createOidcClient(
  db: SQL,
  input: { clientId: string; name: string; redirectUris: string[]; postLogoutRedirectUris: string[] },
): Promise<{ clientId: string; secret: string }> {
  if (!CLIENT_ID.test(input.clientId) || !input.name.trim() || input.redirectUris.length === 0) throw new AppError('OIDC_REQUEST_INVALID')
  requireAllowedUris([...input.redirectUris, ...input.postLogoutRedirectUris])
  const secret = randomBytes(32).toString('base64url')
  await insertClient(db, {
    clientId: input.clientId,
    name: input.name.trim(),
    secretHash: tokenHash(secret),
    redirectUris: input.redirectUris,
    postLogoutRedirectUris: input.postLogoutRedirectUris,
  })
  return { clientId: input.clientId, secret }
}

export async function rotateOidcClientSecret(db: SQL, clientId: string): Promise<string> {
  const secret = randomBytes(32).toString('base64url')
  if (!(await updateClientSecret(db, clientId, tokenHash(secret)))) throw new AppError('OIDC_CLIENT_UNKNOWN')
  return secret
}

export async function setOidcClientDisabled(db: SQL, clientId: string, disabled: boolean): Promise<void> {
  if (!(await findClient(db, clientId))) throw new AppError('OIDC_CLIENT_UNKNOWN')
  await setClientDisabled(db, clientId, disabled)
}

export function listOidcClients(db: SQL): Promise<OidcClientSummary[]> {
  return listClients(db)
}
