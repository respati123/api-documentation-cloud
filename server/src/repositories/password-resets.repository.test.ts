import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { deleteUnusedResets, insertReset, lockActiveReset, markResetUsed } from '@/repositories/password-resets.repository'
import { databaseEnabled, openTestDatabase, seedUser } from '@/testing/database'

const hour = 60 * 60 * 1000

describe.skipIf(!databaseEnabled)('password resets repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('lockActiveReset returns the user id for an unused, unexpired token', async () => {
    const user = await seedUser(db)
    const tokenHash = randomUUID()
    await insertReset(db, { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + hour) })

    expect(await lockActiveReset(db, tokenHash)).toBe(user.id)
  })

  test('lockActiveReset returns undefined for an expired token', async () => {
    const user = await seedUser(db)
    const tokenHash = randomUUID()
    await insertReset(db, { tokenHash, userId: user.id, expiresAt: new Date(Date.now() - hour) })

    expect(await lockActiveReset(db, tokenHash)).toBeUndefined()
  })

  test('markResetUsed makes the token unusable', async () => {
    const user = await seedUser(db)
    const tokenHash = randomUUID()
    await insertReset(db, { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + hour) })

    await markResetUsed(db, tokenHash)

    expect(await lockActiveReset(db, tokenHash)).toBeUndefined()
  })

  test('deleteUnusedResets drops unused tokens of the user and keeps used ones', async () => {
    const user = await seedUser(db)
    const unused = randomUUID()
    const used = randomUUID()
    await insertReset(db, { tokenHash: unused, userId: user.id, expiresAt: new Date(Date.now() + hour) })
    await insertReset(db, { tokenHash: used, userId: user.id, expiresAt: new Date(Date.now() + hour) })
    await markResetUsed(db, used)

    await deleteUnusedResets(db, user.id)

    expect(await lockActiveReset(db, unused)).toBeUndefined()
    const [kept] = await db`SELECT token_hash FROM password_resets WHERE token_hash = ${used}`
    expect(kept).toBeDefined()
  })
})
