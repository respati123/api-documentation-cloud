import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { SQL } from 'bun'
import { databaseEnabled, openTestDatabase } from '@/testing/database'
import { createTestHttp, type TestAccount } from '@/testing/http'

// Getting rid of a BRD or PRD: a draft that should not go on can be discarded and kept for the record,
// and a draft nothing depends on can be deleted by the owner or a PM.
describe.skipIf(!databaseEnabled)('discarding and deleting planning documents', () => {
  let db: SQL
  let http: ReturnType<typeof createTestHttp>

  beforeAll(async () => {
    db = await openTestDatabase()
    http = createTestHttp(db, process.env.TEST_DATABASE_URL ?? '')
  })

  afterAll(async () => {
    await db.close()
  })

  async function member(owner: TestAccount, workspaceId: string, label: string, discipline: string) {
    const account = await http.signUp(label)
    await http.inviteAndAccept(owner, workspaceId, account, 'editor')
    const projects = await http.call('GET', `/api/workspaces/${workspaceId}/projects`, { token: owner.token })
    const projectId = (projects.json.data as { projects: Array<{ id: string }> }).projects[0].id
    await http.call('POST', `/api/workspaces/${workspaceId}/projects/${projectId}/members`, { token: owner.token, body: { userId: account.user.id, discipline } })
    return account
  }

  async function workspace(label: string) {
    const owner = await http.signUp(`${label}-owner`)
    const workspaceId = await http.createWorkspace(owner, label)
    const as = (account: TestAccount) => (method: string, path: string, body?: unknown) =>
      http.call(method, `/api/workspaces/${workspaceId}/planning${path}`, { token: account.token, body })
    const call = as(owner)
    const id = async (response: Promise<{ json: Record<string, unknown> }>, key: 'document' | 'item' = 'document') => ((await response).json.data as Record<string, { id: string }>)[key].id
    const brdId = await id(call('POST', '/documents', { kind: 'brd', title: 'BRD', content: 'Needs' }))
    const prdId = await id(call('POST', '/documents', { kind: 'prd', title: 'PRD', content: 'R1 Owner invites (must)', sourceDocumentId: brdId }))
    return { owner, workspaceId, as, call, id, brdId, prdId }
  }

  describe('discard', () => {
    test('a PRD draft or one in review can be discarded, then it cannot be revised or moved on', async () => {
      const { call, id, brdId, prdId } = await workspace('discard-prd')
      const inReview = await id(call('POST', '/documents', { kind: 'prd', title: 'PRD 2', content: 'Text', sourceDocumentId: brdId }))
      await call('POST', `/documents/${inReview}/status`, { status: 'review_pm' })

      const discarded = await call('POST', `/documents/${prdId}/status`, { status: 'discarded' })
      expect(discarded.status).toBe(200)
      expect((discarded.json.data as { document: { status: string } }).document.status).toBe('discarded')
      expect((await call('POST', `/documents/${inReview}/status`, { status: 'discarded' })).status).toBe(200)

      expect((await call('PATCH', `/documents/${prdId}`, { content: 'New', expectedVersion: 1 })).status).toBe(409)
      expect((await call('POST', `/documents/${prdId}/status`, { status: 'review_pm' })).status).toBe(409)
    })

    test('an approved PRD is superseded, not discarded', async () => {
      const { call, prdId } = await workspace('discard-approved')
      for (const status of ['review_pm', 'review_team', 'approved']) await call('POST', `/documents/${prdId}/status`, { status })

      expect((await call('POST', `/documents/${prdId}/status`, { status: 'discarded' })).status).toBe(409)
    })

    test('a BRD an agent uploaded can be discarded instead of confirmed', async () => {
      const { owner, workspaceId, call } = await workspace('discard-brd')
      const pm = await member(owner, workspaceId, 'discard-brd-pm', 'pm')
      const created = await http.call('POST', '/api/me/mcp-keys', { token: pm.token, body: { name: 'Laptop', validDays: 30 } })
      const secret = (created.json.data as { secret: string }).secret
      await http.mcp(secret, 'tools/call', { name: 'planning_guide', arguments: {} })
      const uploaded = await http.mcp(secret, 'tools/call', { name: 'planning_upload_brd', arguments: { workspaceId, title: 'BRD agent', content: '# BRD', fileName: 'brd.md' } })
      const brdId = JSON.parse((uploaded.json.result as { content: Array<{ text: string }> }).content[0].text).id

      const discarded = await call('POST', `/documents/${brdId}/status`, { status: 'discarded' })
      expect((discarded.json.data as { document: { status: string } }).document.status).toBe('discarded')
    })

    test('the owner, a PM, or a tech lead may discard; other roles may not', async () => {
      const { owner, workspaceId, as, call, id, brdId, prdId } = await workspace('discard-who')
      const techLead = await member(owner, workspaceId, 'discard-who-tl', 'tech_lead')
      const backend = await member(owner, workspaceId, 'discard-who-be', 'backend')
      const other = await id(call('POST', '/documents', { kind: 'prd', title: 'PRD 2', content: 'Text', sourceDocumentId: brdId }))

      expect((await as(backend)('POST', `/documents/${prdId}/status`, { status: 'discarded' })).status).toBe(403)
      expect((await as(techLead)('POST', `/documents/${other}/status`, { status: 'discarded' })).status).toBe(200)
    })

    test('agents no longer see a discarded document', async () => {
      const { owner, workspaceId, call, prdId } = await workspace('discard-mcp')
      const pm = await member(owner, workspaceId, 'discard-mcp-pm', 'pm')
      const created = await http.call('POST', '/api/me/mcp-keys', { token: pm.token, body: { name: 'Laptop', validDays: 30 } })
      const secret = (created.json.data as { secret: string }).secret
      await call('POST', `/documents/${prdId}/status`, { status: 'discarded' })

      const listed = await http.mcp(secret, 'tools/call', { name: 'documents_list', arguments: { workspaceId } })
      const rows = JSON.parse((listed.json.result as { content: Array<{ text: string }> }).content[0].text) as Array<{ id: string }>
      expect(rows.map((row) => row.id)).not.toContain(prdId)
    })
  })

  describe('delete', () => {
    test('the owner deletes a PRD draft, with its versions and discussion', async () => {
      const { call, prdId } = await workspace('delete-prd')
      await call('POST', `/document/${prdId}/comments`, { body: 'Wrong BRD' })

      const deleted = await call('DELETE', `/documents/${prdId}`)

      expect(deleted.status).toBe(204)
      expect((await call('GET', `/documents/${prdId}`)).status).toBe(404)
      const [left] = await db`SELECT count(*)::int AS n FROM planning_comments WHERE target_id = ${prdId}`
      expect(left.n).toBe(0)
    })

    test('a discarded document can be deleted, but one in review or approved cannot', async () => {
      const { call, id, brdId, prdId } = await workspace('delete-status')
      const inReview = await id(call('POST', '/documents', { kind: 'prd', title: 'PRD 2', content: 'Text', sourceDocumentId: brdId }))
      await call('POST', `/documents/${inReview}/status`, { status: 'review_pm' })
      await call('POST', `/documents/${prdId}/status`, { status: 'discarded' })

      expect((await call('DELETE', `/documents/${inReview}`)).status).toBe(409)
      expect((await call('DELETE', `/documents/${brdId}`)).status).toBe(409)
      expect((await call('DELETE', `/documents/${prdId}`)).status).toBe(204)
    })

    test('a document that others depend on cannot be deleted', async () => {
      const { call, id, prdId, workspaceId, owner } = await workspace('delete-depends')
      const draftBrd = await id(call('POST', '/documents', { kind: 'brd', title: 'BRD 2', content: 'Needs' }))
      await db`UPDATE planning_documents SET status = 'draft' WHERE id = ${draftBrd}`
      await db`UPDATE planning_documents SET source_document_id = ${draftBrd} WHERE id = ${prdId}`
      expect((await call('DELETE', `/documents/${draftBrd}`)).status).toBe(409)

      for (const status of ['review_pm', 'review_team', 'approved']) await call('POST', `/documents/${prdId}/status`, { status })
      await call('POST', '/items', { kind: 'epic', title: 'Epic', sourceDocumentId: prdId })
      await db`UPDATE planning_documents SET status = 'draft' WHERE id = ${prdId}`
      const refused = await http.call('DELETE', `/api/workspaces/${workspaceId}/planning/documents/${prdId}`, { token: owner.token })
      expect(refused.status).toBe(409)
    })

    test('only the owner or a PM deletes; a tech lead discards instead', async () => {
      const { owner, workspaceId, as, prdId } = await workspace('delete-who')
      const techLead = await member(owner, workspaceId, 'delete-who-tl', 'tech_lead')
      const pm = await member(owner, workspaceId, 'delete-who-pm', 'pm')

      expect((await as(techLead)('DELETE', `/documents/${prdId}`)).status).toBe(403)
      expect((await as(pm)('DELETE', `/documents/${prdId}`)).status).toBe(204)
    })
  })
})
