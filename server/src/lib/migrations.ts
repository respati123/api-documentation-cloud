import { createHash } from 'node:crypto'

// Startup failures, not HTTP errors. The server refuses to start when these are thrown.
export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}

export interface MigrationFile {
  version: number
  name: string
  sql: string
  checksum: string
}

export interface AppliedMigration {
  version: number
  checksum: string
}

const FILE_NAME = /^(\d{4})_([a-z0-9_]+)\.sql$/

export function checksumOf(sql: string): string {
  return createHash('sha256').update(sql).digest('hex')
}

export function parseMigration(fileName: string, sql: string): MigrationFile {
  const match = FILE_NAME.exec(fileName)
  if (!match) throw new MigrationError(`Migration file name is invalid: ${fileName}`)
  return { version: Number(match[1]), name: match[2], sql, checksum: checksumOf(sql) }
}

export function sortMigrations(files: MigrationFile[]): MigrationFile[] {
  const sorted = [...files].sort((a, b) => a.version - b.version)
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].version === sorted[index - 1].version) {
      throw new MigrationError(`Two migrations use version ${sorted[index].version}`)
    }
  }
  return sorted
}

// Returns the files that still need to run. Stops the server when the history does not match the files.
export function planMigrations(files: MigrationFile[], applied: AppliedMigration[]): MigrationFile[] {
  const byVersion = new Map(files.map((file) => [file.version, file]))
  for (const row of applied) {
    const file = byVersion.get(row.version)
    if (!file) throw new MigrationError(`Applied migration ${row.version} has no file`)
    if (file.checksum !== row.checksum) throw new MigrationError(`Migration ${file.version} changed after it was applied`)
  }

  const appliedVersions = new Set(applied.map((row) => row.version))
  const pending = files.filter((file) => !appliedVersions.has(file.version))
  const newestApplied = applied.reduce((latest, row) => Math.max(latest, row.version), 0)
  const outOfOrder = pending.find((file) => file.version < newestApplied)
  if (outOfOrder) throw new MigrationError(`Migration ${outOfOrder.version} is pending but a later one is already applied`)
  return pending
}

// Each migration is sent as separate statements. Keep semicolons out of strings and function bodies.
export function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
}
