import { SQL } from 'bun'
import { randomUUID } from 'node:crypto'
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
