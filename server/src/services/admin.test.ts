import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { findUserByEmail, insertUser } from '@/repositories/users.repository'
import { requireAdmin, seedAdmin } from '@/services/admin'
import { databaseEnabled, openTestDatabase } from '@/testing/database'

describe.skipIf(!databaseEnabled)('admin account', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('seedAdmin stores the email in lowercase and a password hash that verifies', async () => {
    const email = `Seed-${randomUUID()}@Test.dev`

    await seedAdmin(db, { email: `  ${email}  `, password: 'admin-password-1' })

    const stored = await findUserByEmail(db, email.toLowerCase())
    expect(stored).toBeDefined()
    expect(await Bun.password.verify('admin-password-1', stored?.passwordHash ?? '')).toBe(true)
  })

  test('seedAdmin can run again with a new password and keeps one account', async () => {
    const email = `again-${randomUUID()}@test.dev`
    const first = await seedAdmin(db, { email, password: 'admin-password-1' })

    const second = await seedAdmin(db, { email, password: 'admin-password-2' })

    expect(second).toBe(first)
    expect(await Bun.password.verify('admin-password-2', (await findUserByEmail(db, email))?.passwordHash ?? '')).toBe(true)
  })

  test('seedAdmin refuses a password shorter than 10 characters', async () => {
    const attempt = seedAdmin(db, { email: `short-${randomUUID()}@test.dev`, password: 'short' })

    await expect(attempt).rejects.toMatchObject({ code: 'PASSWORD_LENGTH_INVALID' })
  })

  test('seedAdmin refuses an email without an at sign', async () => {
    const attempt = seedAdmin(db, { email: 'not-an-email', password: 'admin-password-1' })

    await expect(attempt).rejects.toMatchObject({ code: 'ADMIN_SEED_INVALID' })
  })

  test('requireAdmin lets an admin through and refuses an ordinary account', async () => {
    const adminId = await seedAdmin(db, { email: `gate-${randomUUID()}@test.dev`, password: 'admin-password-1' })
    const memberId = randomUUID()
    await insertUser(db, { id: memberId, email: `gate-member-${randomUUID()}@test.dev`, passwordHash: 'hash' })

    await expect(requireAdmin(db, adminId)).resolves.toBeUndefined()
    const refused = requireAdmin(db, memberId)
    await expect(refused).rejects.toBeInstanceOf(AppError)
    await expect(refused).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' })
  })
})
