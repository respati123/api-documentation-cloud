import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { findUserByEmail, findUserById, insertUser, setPasswordHash } from '@/repositories/users.repository'
import { databaseEnabled, openTestDatabase } from '@/testing/database'

describe.skipIf(!databaseEnabled)('users repository', () => {
  let db: SQL

  beforeAll(async () => {
    db = await openTestDatabase()
  })

  afterAll(async () => {
    await db.close()
  })

  test('insertUser reports true for a new email and false when the email is taken', async () => {
    const email = `users-${randomUUID()}@test.dev`

    expect(await insertUser(db, { id: randomUUID(), email, passwordHash: 'first' })).toBe(true)
    expect(await insertUser(db, { id: randomUUID(), email, passwordHash: 'second' })).toBe(false)
  })

  test('findUserByEmail returns the id and stored hash for a known email', async () => {
    const id = randomUUID()
    const email = `users-${randomUUID()}@test.dev`
    await insertUser(db, { id, email, passwordHash: 'stored-hash' })

    expect(await findUserByEmail(db, email)).toEqual({ id, email, passwordHash: 'stored-hash' })
  })

  test('findUserByEmail returns undefined for an unknown email', async () => {
    expect(await findUserByEmail(db, `missing-${randomUUID()}@test.dev`)).toBeUndefined()
  })

  test('findUserById returns only the id and email', async () => {
    const id = randomUUID()
    const email = `users-${randomUUID()}@test.dev`
    await insertUser(db, { id, email, passwordHash: 'stored-hash' })

    expect(await findUserById(db, id)).toEqual({ id, email })
    expect(await findUserById(db, randomUUID())).toBeUndefined()
  })

  test('setPasswordHash replaces the stored hash', async () => {
    const id = randomUUID()
    const email = `users-${randomUUID()}@test.dev`
    await insertUser(db, { id, email, passwordHash: 'old-hash' })

    await setPasswordHash(db, id, 'new-hash')

    expect((await findUserByEmail(db, email))?.passwordHash).toBe('new-hash')
  })
})
