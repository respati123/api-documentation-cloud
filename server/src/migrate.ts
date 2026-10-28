import { readdir, readFile } from 'node:fs/promises'
import type { SQL } from 'bun'
import { MigrationError, parseMigration, type MigrationFile, planMigrations, sortMigrations, splitStatements } from './lib/migrations'

interface MigrationLog {
  info: (msg: string, fields?: Record<string, unknown>) => void
}

const LOCK_KEY = 'schema_migrations'

// Applies the pending migrations in version order. Each one runs in its own transaction.
// The advisory lock stops two instances from applying the same migration at once.
export async function runMigrations(db: SQL, directory: URL, log: MigrationLog): Promise<number> {
  const files = await loadMigrationFiles(directory)
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  })

  const applied = await db`SELECT version, checksum FROM schema_migrations ORDER BY version`
  const pending = planMigrations(
    files,
    applied.map((row: { version: number; checksum: string }) => ({ version: Number(row.version), checksum: row.checksum })),
  )

  for (const file of pending) {
    await applyOne(db, file)
    log.info('migration applied', { version: file.version, name: file.name })
  }
  return pending.length
}

async function loadMigrationFiles(directory: URL): Promise<MigrationFile[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql'))
  const files = await Promise.all(
    names.map(async (name) => parseMigration(name, await readFile(new URL(name, directory), 'utf8'))),
  )
  return sortMigrations(files)
}

async function applyOne(db: SQL, file: MigrationFile): Promise<void> {
  await db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`
    // Another instance may have applied this migration while this one waited for the lock.
    const [existing] = await tx`SELECT checksum FROM schema_migrations WHERE version = ${file.version}`
    if (existing) {
      if (existing.checksum !== file.checksum) throw new MigrationError(`Migration ${file.version} changed after it was applied`)
      return
    }
    for (const statement of splitStatements(file.sql)) await tx.unsafe(statement)
    await tx`INSERT INTO schema_migrations (version, name, checksum) VALUES (${file.version}, ${file.name}, ${file.checksum})`
  })
}
