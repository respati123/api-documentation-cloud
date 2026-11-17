import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'

describe.skipIf(!databaseEnabled)('OIDC tables', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  async function columnsOf(table: string): Promise<string[]> {
    const rows = await db`SELECT column_name FROM information_schema.columns WHERE table_name = ${table} ORDER BY column_name`
    return rows.map((row: { column_name: string }) => row.column_name)
  }

  test('oidc_clients stores the hashed secret and the registered URIs', async () => {
    const columns = await columnsOf('oidc_clients')
    expect(columns).toEqual(
      ['client_id', 'created_at', 'disabled_at', 'name', 'post_logout_redirect_uris', 'redirect_uris', 'secret_hash'].sort(),
    )
  })

  test('oidc_authorization_codes stores only the code hash and the PKCE challenge', async () => {
    const columns = await columnsOf('oidc_authorization_codes')
    expect(columns).toEqual(
      ['client_id', 'code_challenge', 'code_hash', 'created_at', 'expires_at', 'nonce', 'redirect_uri', 'scope', 'used_at', 'user_id'].sort(),
    )
  })
})
