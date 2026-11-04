import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { deleteSession, deleteSessionById, deleteSessionsForUser, findSession, insertSession, listLiveSessions } from '@/repositories/sessions.repository'
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

  test('findSession returns the user for a live session', async () => {
    const user = await seedUser(db)
    const tokenHash = randomUUID()
    await insertSession(db, { id: randomUUID(), tokenHash, userId: user.id, expiresAt: new Date(Date.now() + hour), client: 'web', device: '' })

    expect(await (await findSession(db, tokenHash))?.user).toEqual(user)
  })

  test('findSession returns undefined for an expired session', async () => {
    const user = await seedUser(db)
    const tokenHash = randomUUID()
    await insertSession(db, { id: randomUUID(), tokenHash, userId: user.id, expiresAt: new Date(Date.now() - hour), client: 'web', device: '' })

    expect(await (await findSession(db, tokenHash))?.user).toBeUndefined()
  })

  test('deleteSession removes only the given session', async () => {
    const user = await seedUser(db)
    const kept = randomUUID()
    const removed = randomUUID()
    await insertSession(db, { id: randomUUID(), tokenHash: kept, userId: user.id, expiresAt: new Date(Date.now() + hour), client: 'web', device: '' })
    await insertSession(db, { id: randomUUID(), tokenHash: removed, userId: user.id, expiresAt: new Date(Date.now() + hour), client: 'web', device: '' })

    await deleteSession(db, removed)

    expect(await (await findSession(db, removed))?.user).toBeUndefined()
    expect(await (await findSession(db, kept))?.user).toEqual(user)
  })

  test('deleteSessionsForUser removes every session of that user', async () => {
    const user = await seedUser(db)
    const other = await seedUser(db)
    const first = randomUUID()
    const second = randomUUID()
    const otherToken = randomUUID()
    await insertSession(db, { id: randomUUID(), tokenHash: first, userId: user.id, expiresAt: new Date(Date.now() + hour), client: 'web', device: '' })
    await insertSession(db, { id: randomUUID(), tokenHash: second, userId: user.id, expiresAt: new Date(Date.now() + hour), client: 'web', device: '' })
    await insertSession(db, { id: randomUUID(), tokenHash: otherToken, userId: other.id, expiresAt: new Date(Date.now() + hour), client: 'web', device: '' })

    await deleteSessionsForUser(db, user.id)

    expect(await (await findSession(db, first))?.user).toBeUndefined()
    expect(await (await findSession(db, second))?.user).toBeUndefined()
    expect(await (await findSession(db, otherToken))?.user).toEqual(other)
  })

  test('listLiveSessions shows each session with its client and device, and deleteSessionById removes only one of the user’s own', async () => {
    const user = await seedUser(db)
    const other = await seedUser(db)
    const desktopId = randomUUID()
    const webId = randomUUID()
    await insertSession(db, { id: desktopId, tokenHash: randomUUID(), userId: user.id, expiresAt: new Date(Date.now() + hour), client: 'desktop', device: 'Desktop app' })
    await insertSession(db, { id: webId, tokenHash: randomUUID(), userId: user.id, expiresAt: new Date(Date.now() + hour), client: 'web', device: 'Chrome' })
    const otherId = randomUUID()
    await insertSession(db, { id: otherId, tokenHash: randomUUID(), userId: other.id, expiresAt: new Date(Date.now() + hour), client: 'web', device: '' })

    const listed = await listLiveSessions(db, user.id)
    expect(listed.map((item) => item.client).sort()).toEqual(['desktop', 'web'])
    expect(listed.find((item) => item.id === desktopId)?.device).toBe('Desktop app')

    expect(await deleteSessionById(db, user.id, otherId)).toBe(false)
    expect(await deleteSessionById(db, user.id, webId)).toBe(true)
    expect((await listLiveSessions(db, user.id)).map((item) => item.id)).toEqual([desktopId])
  })
})
