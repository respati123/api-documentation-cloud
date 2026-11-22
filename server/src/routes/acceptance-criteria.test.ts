import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { EPIC_DOCUMENT_SECTIONS } from '@/models/epic-document'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

type Body = Record<string, any>

// The HTTP side of acceptance criteria. The rules are covered in services/acceptance-criteria.test.ts.
describe.skipIf(!databaseEnabled)('acceptance criteria routes', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let owner: TestAccount
  let base: string

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    owner = await http.signUp('ac-owner')
    const workspaceId = await http.createWorkspace(owner, 'Acceptance criteria')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    base = `/api/workspaces/${workspaceId}/projects/${projectId}`
  })

  afterAll(async () => {
    await db.close()
  })

  const call = (method: string, path: string, body?: unknown) => http.call(method, `${base}${path}`, { token: owner.token, body })
  const data = (response: { json: Record<string, unknown> }) => response.json.data as Body
  const spec = Object.fromEntries(EPIC_DOCUMENT_SECTIONS.spec.map((name) => [name, `${name} text`]))
  const criterion = { flow: 'Sign in', title: 'Signs in', given: 'an account rina@contoh.id', when: 'the user signs in', then: ['the home page opens within 2 seconds'] }

  test('add, read, strike, and the task that delivers a criterion', async () => {
    const epic = data(await call('POST', '/issues', { type: 'epic', title: 'Sign in', featurePrefix: 'AUTH' })).issue as Body
    await call('POST', '/issues/AUTH-001/documents', { kind: 'spec', sections: spec })

    const added = await call('POST', '/issues/AUTH-001/acceptance-criteria', criterion)
    expect(added.status).toBe(201)
    expect(data(added).criterion).toMatchObject({ code: 'AC1', ref: 'AUTH-001/AC1' })
    await call('POST', '/issues/AUTH-001/acceptance-criteria', { ...criterion, title: 'Second' })

    const task = data(await call('POST', '/issues', { type: 'task', title: 'Endpoint', parentId: epic.id })).issue as Body
    const delivers = await call('PUT', `/issues/${task.key}/delivers`, { numbers: [1, 2] })
    expect(delivers.status).toBe(200)
    expect((data(delivers).criteria as Body[]).map((item) => item.code)).toEqual(['AC1', 'AC2'])

    const struck = await call('POST', '/issues/AUTH-001/acceptance-criteria/2/strike', { reason: 'Moved to AUTH-004' })
    expect(data(struck).criterion.status).toBe('struck')
    const list = data(await call('GET', '/issues/AUTH-001/acceptance-criteria'))
    expect(list.flagged.issues).toEqual([task.key])
  })

  test('errors keep the shared shape', async () => {
    data(await call('POST', '/issues', { type: 'epic', title: 'Budgets', featurePrefix: 'BUDG' }))
    await call('POST', '/issues/BUDG-001/documents', { kind: 'spec', sections: spec })
    const missing = await call('POST', '/issues/BUDG-001/acceptance-criteria', { title: 'Half' })
    expect(missing.status).toBe(400)
    expect(missing.json).toMatchObject({ code: 'AC_INCOMPLETE', details: { missing: ['given', 'when', 'then'] } })
    expect((await call('PATCH', '/issues/BUDG-001/acceptance-criteria/9', criterion)).json.code).toBe('PLANNING_NOT_FOUND')
    expect((await call('DELETE', '/issues/BUDG-001/acceptance-criteria/1')).json.code).toBe('ROUTE_NOT_FOUND')
  })
})
