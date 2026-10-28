import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { deleteSession, deleteSessionsForUser, findSessionUser, insertSession } from '@/repositories/sessions.repository'
import { databaseEnabled, openTestDatabase, seedUser } from '@/testing/database'

const hour = 60 * 60 * 1000

describe.skipIf(!databaseEnabled)('sessions repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('findSessionUser returns the user for a live session', async () => {
    const user = await seedUser(db)
    const tokenHash = randomUUID()
    await insertSession(db, { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + hour) })

    expect(await findSessionUser(db, tokenHash)).toEqual(user)
  })

  test('findSessionUser returns undefined for an expired session', async () => {
    const user = await seedUser(db)
    const tokenHash = randomUUID()
    await insertSession(db, { tokenHash, userId: user.id, expiresAt: new Date(Date.now() - hour) })

    expect(await findSessionUser(db, tokenHash)).toBeUndefined()
  })

  test('deleteSession removes only the given session', async () => {
    const user = await seedUser(db)
    const kept = randomUUID()
    const removed = randomUUID()
    await insertSession(db, { tokenHash: kept, userId: user.id, expiresAt: new Date(Date.now() + hour) })
    await insertSession(db, { tokenHash: removed, userId: user.id, expiresAt: new Date(Date.now() + hour) })

    await deleteSession(db, removed)

    expect(await findSessionUser(db, removed)).toBeUndefined()
    expect(await findSessionUser(db, kept)).toEqual(user)
  })

  test('deleteSessionsForUser removes every session of that user', async () => {
    const user = await seedUser(db)
    const other = await seedUser(db)
    const first = randomUUID()
    const second = randomUUID()
    const otherToken = randomUUID()
    await insertSession(db, { tokenHash: first, userId: user.id, expiresAt: new Date(Date.now() + hour) })
    await insertSession(db, { tokenHash: second, userId: user.id, expiresAt: new Date(Date.now() + hour) })
    await insertSession(db, { tokenHash: otherToken, userId: other.id, expiresAt: new Date(Date.now() + hour) })

    await deleteSessionsForUser(db, user.id)

    expect(await findSessionUser(db, first)).toBeUndefined()
    expect(await findSessionUser(db, second)).toBeUndefined()
    expect(await findSessionUser(db, otherToken)).toEqual(other)
  })
})
