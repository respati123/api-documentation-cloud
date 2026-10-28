import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SQL } from 'bun'
import { runMigrations } from './migrate'

// Runs against a real PostgreSQL. Skipped unless TEST_DATABASE_URL is set, and refused when it matches DATABASE_URL.
const testUrl = process.env.TEST_DATABASE_URL
const appUrl = process.env.DATABASE_URL
const enabled = Boolean(testUrl) && testUrl !== appUrl
const quietLog = { info: () => undefined }

describe.skipIf(!enabled)('runMigrations against PostgreSQL', () => {
  const db = new SQL(testUrl ?? 'postgres://invalid')
  let directory = ''

  afterAll(async () => {
    await db`DROP TABLE IF EXISTS migration_test_a, migration_test_b`
    await db`DELETE FROM schema_migrations WHERE version IN (9101, 9102)`
    await db.close()
    if (directory) await rm(directory, { recursive: true, force: true })
  })

  async function writeFiles(a: string, b: string) {
    directory = directory || (await mkdtemp(join(tmpdir(), 'migrations-')))
    await writeFile(join(directory, '9101_create_a.sql'), a)
    await writeFile(join(directory, '9102_create_b.sql'), b)
    return pathToFileURL(`${directory}/`)
  }

  test('applies pending migrations once and does nothing on the second run', async () => {
    const url = await writeFiles('CREATE TABLE IF NOT EXISTS migration_test_a (id TEXT);', 'CREATE TABLE IF NOT EXISTS migration_test_b (id TEXT);')

    expect(await runMigrations(db, url, quietLog)).toBe(2)
    expect(await runMigrations(db, url, quietLog)).toBe(0)
  })

  test('refuses to start when an applied migration changed', async () => {
    const url = await writeFiles('CREATE TABLE IF NOT EXISTS migration_test_a (id TEXT, edited TEXT);', 'CREATE TABLE IF NOT EXISTS migration_test_b (id TEXT);')

    await expect(runMigrations(db, url, quietLog)).rejects.toThrow('changed after it was applied')
  })
})
