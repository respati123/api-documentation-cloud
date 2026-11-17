import { SQL } from 'bun'
import { randomUUID } from 'node:crypto'
import { copyFile, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { splitStatements } from '@/lib/migrations'
import { runMigrations } from '@/migrate'
import { insertCommit } from '@/repositories/commits.repository'
import { insertMembership } from '@/repositories/memberships.repository'
import { insertUser } from '@/repositories/users.repository'
import { insertWorkspace } from '@/repositories/workspaces.repository'

const testUrl = process.env.TEST_DATABASE_URL

// Repository tests use a real database. They are skipped unless TEST_DATABASE_URL is set and it is not the app database.
export const databaseEnabled = Boolean(testUrl) && testUrl !== process.env.DATABASE_URL

export async function openTestDatabase(): Promise<SQL> {
  if (!testUrl) throw new Error('TEST_DATABASE_URL is not set.')
  const db = new SQL(testUrl)
  await runMigrations(db, new URL('../../migrations/', import.meta.url), { info: () => undefined })
  return db
}

export interface ScratchDatabase {
  db: SQL
  // Applies the migrations up to a version (all of them when omitted). Safe to call again with a higher version.
  migrate: (upTo?: number) => Promise<void>
  // Runs the statements of one SQL file in a single transaction, the way the migration runner does.
  applySql: (file: URL) => Promise<void>
  drop: () => Promise<void>
}

// A throwaway database on the test server. A test can build the schema up to one version, seed old rows,
// run the next migration, and check what it did. The name is made from a UUID, so it is safe in SQL.
export async function openScratchDatabase(): Promise<ScratchDatabase> {
  if (!testUrl) throw new Error('TEST_DATABASE_URL is not set.')
  const name = `scratch_${randomUUID().replaceAll('-', '')}`
  const admin = new SQL(testUrl)
  await admin.unsafe(`CREATE DATABASE ${name}`)
  const url = new URL(testUrl)
  url.pathname = `/${name}`
  const db = new SQL(url.toString())
  const source = new URL('../../migrations/', import.meta.url)

  const migrate = async (upTo = Number.POSITIVE_INFINITY) => {
    const folder = await mkdtemp(join(tmpdir(), 'migrations-'))
    try {
      for (const file of await readdir(source)) {
        if (file.endsWith('.sql') && Number(file.slice(0, 4)) <= upTo) await copyFile(new URL(file, source), join(folder, file))
      }
      await runMigrations(db, pathToFileURL(`${folder}/`), { info: () => undefined })
    } finally {
      await rm(folder, { recursive: true, force: true })
    }
  }
  const applySql = async (file: URL) => {
    const statements = splitStatements(await readFile(file, 'utf8'))
    await db.begin(async (tx) => {
      for (const statement of statements) await tx.unsafe(statement)
    })
  }
  const drop = async () => {
    await db.close()
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`)
    await admin.close()
  }
  return { db, migrate, applySql, drop }
}

export async function seedUser(db: SQL): Promise<{ id: string; email: string }> {
  const id = randomUUID()
  const email = `repo-${id}@test.dev`
  await insertUser(db, { id, email, passwordHash: 'not-a-real-hash' })
  return { id, email }
}

export async function seedWorkspace(db: SQL, ownerId: string): Promise<{ workspaceId: string; commitId: string }> {
  const workspaceId = randomUUID()
  const commitId = randomUUID()
  await insertWorkspace(db, { id: workspaceId, name: `Repo ${workspaceId.slice(0, 8)}`, ownerId, headCommitId: commitId })
  await insertMembership(db, { workspaceId, userId: ownerId, role: 'owner' })
  await insertCommit(db, {
    id: commitId,
    workspaceId,
    authorId: ownerId,
    parentIds: [],
    message: 'Workspace created',
    snapshot: { tree: [], variables: { globals: [], environments: [] } },
  })
  return { workspaceId, commitId }
}
