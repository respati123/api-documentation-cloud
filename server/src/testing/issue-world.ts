import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { expect } from 'bun:test'
import { insertMembership } from '@/repositories/memberships.repository'
import { openTestDatabase, seedUser, seedWorkspace } from '@/testing/database'

export type Person = 'pm' | 'lead' | 'dev' | 'qa' | 'plain' | 'viewer' | 'outsider'

// A workspace with two projects and one member per role, for the issue service tests.
// The PM, tech lead, backend, and QA members hold their role in the first project only.
export async function openIssueWorld() {
  const db = await openTestDatabase()
  const ownerId = (await seedUser(db)).id
  const workspaceId = (await seedWorkspace(db, ownerId)).workspaceId
  const people = {} as Record<Person, string>

  const addProject = async (key: string) => {
    const id = randomUUID()
    await db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${workspaceId}, ${key}, ${ownerId}, ${key})`
    return id
  }
  const projectId = await addProject('TEST')
  const otherProjectId = await addProject('OTHR')

  const addMember = async (workspaceRole: 'editor' | 'viewer', discipline: string | null) => {
    const user = await seedUser(db)
    await insertMembership(db, { workspaceId, userId: user.id, role: workspaceRole })
    if (discipline) await db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${projectId}, ${user.id}, ${discipline})`
    return user.id
  }
  people.pm = await addMember('editor', 'pm')
  people.lead = await addMember('editor', 'tech_lead')
  people.dev = await addMember('editor', 'backend')
  people.qa = await addMember('editor', 'qa')
  people.plain = await addMember('editor', null)
  people.viewer = await addMember('viewer', 'pm')
  people.outsider = (await seedUser(db)).id

  const keyId = randomUUID()
  await db`INSERT INTO mcp_keys (id, user_id, name, role, valid_days, claim_expires_at, key_hash) VALUES (${keyId}, ${people.pm}, 'test key', 'pm', 30, now() + interval '1 day', ${randomUUID()})`

  return {
    db: db as SQL,
    workspaceId,
    projectId,
    otherProjectId,
    ownerId,
    people,
    scope: { workspaceId, projectId },
    as: (who: Person) => ({ userId: people[who] }),
    agent: (who: Person) => ({ userId: people[who], apiKeyId: keyId }),
    rejectsWith: async (run: () => Promise<unknown>, code: string) => {
      await expect(run()).rejects.toMatchObject({ code })
    },
    close: () => db.close(),
  }
}

export type IssueWorld = Awaited<ReturnType<typeof openIssueWorld>>
