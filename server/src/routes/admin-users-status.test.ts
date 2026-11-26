import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

describe.skipIf(!databaseEnabled)('app admin status', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let admin: TestAccount

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    admin = await http.signInAdmin()
  })

  afterAll(async () => {
    await db.close()
  })

  function patch(token: string, userId: string, body: Record<string, unknown>) {
    return http.call('PATCH', `/api/admin/users/${userId}`, { token, body })
  }

  test('an ordinary account cannot change app admin status', async () => {
    const member = await http.signUp('status-not-admin')
    const other = await http.signUp('status-target-a')

    const response = await patch(member.token, other.user.id, { isAdmin: true })

    expect(response.status).toBe(403)
    expect(response.json.code).toBe('ADMIN_REQUIRED')
  })

  test('an admin cannot change their own app admin status', async () => {
    const response = await patch(admin.token, admin.user.id, { isAdmin: false })

    expect(response.status).toBe(403)
    expect(response.json.code).toBe('APP_ADMIN_SELF_CHANGE_FORBIDDEN')
  })

  test('an admin can make another account an app admin and take it back', async () => {
    const account = await http.signUp('status-target-b')

    const promoted = await patch(admin.token, account.user.id, { isAdmin: true })
    expect(promoted.status).toBe(200)
    expect((promoted.json.data as { user: unknown }).user).toEqual({ id: account.user.id, isAdmin: true })

    const demoted = await patch(admin.token, account.user.id, { isAdmin: false })
    expect(demoted.status).toBe(200)
    expect((demoted.json.data as { user: unknown }).user).toEqual({ id: account.user.id, isAdmin: false })
  })

  test('a non-boolean value is refused', async () => {
    const account = await http.signUp('status-target-c')

    const response = await patch(admin.token, account.user.id, { isAdmin: 'yes' })

    expect(response.status).toBe(400)
    expect(response.json.code).toBe('APP_ADMIN_INPUT_INVALID')
  })

  test('a body with only roles still changes roles and leaves the admin flag alone', async () => {
    const account = await http.signUp('status-target-d')

    const response = await patch(admin.token, account.user.id, { roles: [] })

    expect(response.status).toBe(200)
    expect((response.json.data as { user: unknown }).user).toEqual({ id: account.user.id, roles: [] })
  })

  test('an unknown account is reported as not found', async () => {
    const response = await patch(admin.token, crypto.randomUUID(), { isAdmin: true })

    expect(response.status).toBe(404)
    expect(response.json.code).toBe('ACCOUNT_NOT_FOUND')
  })
})
