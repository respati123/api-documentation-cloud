import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { EPIC_DOCUMENT_SECTIONS } from '@/models/epic-document'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

type Body = Record<string, any>

const sections = (kind: 'spec' | 'design' | 'contract') => Object.fromEntries(EPIC_DOCUMENT_SECTIONS[kind].map((name) => [name, `${name} text`]))

// The HTTP side of the epic documents. The rules themselves are covered in services/epic-documents.test.ts.
describe.skipIf(!databaseEnabled)('epic document routes', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>
  let owner: TestAccount
  let base: string

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
    owner = await http.signUp('ed-owner')
    const workspaceId = await http.createWorkspace(owner, 'Epic documents')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    base = `/api/workspaces/${workspaceId}/projects/${projectId}`
  })

  afterAll(async () => {
    await db.close()
  })

  const call = (method: string, path: string, body?: unknown) => http.call(method, `${base}${path}`, { token: owner.token, body })
  const data = (response: { json: Record<string, unknown> }) => response.json.data as Body

  test('the owner creates an epic with a feature code, drafts and approves the spec, then drafts the design', async () => {
    const epic = data(await call('POST', '/issues', { type: 'epic', title: 'Sign in', featurePrefix: 'AUTH' })).issue as Body
    expect(epic.featureCode).toBe('AUTH-001')

    const spec = await call('POST', '/issues/AUTH-001/documents', { kind: 'spec', sections: sections('spec') })
    expect(spec.status).toBe(201)
    const specId = (data(spec).document as Body).id
    const criterion = await call('POST', '/issues/AUTH-001/acceptance-criteria', { flow: 'Sign in', title: 'Signs in', given: 'an account', when: 'the user signs in', then: ['the home page opens'] })
    expect(criterion.status).toBe(201)
    expect((await call('POST', `/issues/AUTH-001/documents/${specId}/approve`)).status).toBe(200)

    const design = await call('POST', `/issues/${epic.id}/documents`, { kind: 'design', sections: sections('design') })
    expect(design.status).toBe(201)

    const list = data(await call('GET', '/issues/AUTH-001/documents'))
    expect((list.documents as Body[]).map((document) => document.kind)).toEqual(['spec', 'design'])
    expect(list.blocked).toEqual({ spec: null, design: null, contract: 'design_approved' })
  })

  test('errors keep the shared shape: missing sections, a blocked step, and an unknown section', async () => {
    data(await call('POST', '/issues', { type: 'epic', title: 'Budgets', featurePrefix: 'BUDG' }))
    const missing = await call('POST', '/issues/BUDG-001/documents', { kind: 'spec', sections: { problem: 'x' } })
    expect(missing.status).toBe(400)
    expect(missing.json).toMatchObject({ code: 'EPIC_DOCUMENT_INCOMPLETE' })

    const blocked = await call('POST', '/issues/BUDG-001/documents', { kind: 'contract', sections: sections('contract') })
    expect(blocked.status).toBe(409)
    expect(blocked.json).toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED' })

    const unknown = await call('POST', '/issues/BUDG-001/documents', { kind: 'spec', sections: { ...sections('spec'), extra: 'x' } })
    expect(unknown.status).toBe(400)
  })
})
