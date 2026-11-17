import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { draftBacklogFromPrd, markSourceReviewed } from '@/services/issue-import'
import { getIssue, listIssuePage } from '@/services/issues'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld } from '@/testing/issue-world'

const PRD = ['# Checkout PRD', '', '## Payment', 'Pay by card or wallet.', '', '### Pay with a card', 'The buyer enters a card.', '', '**Acceptance criteria**', '- the card is charged once', '', '### Pay with a wallet', '', '## Delivery', 'Ship it.'].join('\n')

describe.skipIf(!databaseEnabled)('draft backlog from a PRD', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  async function freshProject() {
    const id = randomUUID()
    const key = `IM${randomUUID().replace(/[^a-f]/g, '').toUpperCase().slice(0, 6).padEnd(4, 'Z')}`
    await world.db`INSERT INTO projects (id, workspace_id, name, created_by, key) VALUES (${id}, ${world.workspaceId}, ${key}, ${world.ownerId}, ${key})`
    await world.db`INSERT INTO project_members (project_id, user_id, discipline) VALUES (${id}, ${world.people.pm}, 'pm'), (${id}, ${world.people.lead}, 'tech_lead')`
    return { workspaceId: world.workspaceId, projectId: id }
  }

  async function document(options: { kind?: string; status?: string; content?: string; version?: number; sourceId?: string; sourceVersion?: number } = {}) {
    const id = randomUUID()
    const version = options.version ?? 1
    await world.db`INSERT INTO planning_documents (id, workspace_id, kind, title, status, current_version, source_document_id, created_by)
      VALUES (${id}, ${world.workspaceId}, ${options.kind ?? 'prd'}, 'Checkout PRD', ${options.status ?? 'approved'}, ${version}, ${options.sourceId ?? null}, ${world.ownerId})`
    for (let number = 1; number <= version; number += 1) {
      await world.db`INSERT INTO planning_document_versions (document_id, version, content, source_version, created_by) VALUES (${id}, ${number}, ${options.content ?? PRD}, ${options.sourceVersion ?? null}, ${world.ownerId})`
    }
    return id
  }
  const count = async (projectId: string) => Number((await world.db`SELECT count(*)::int AS n FROM issues WHERE project_id = ${projectId}`)[0].n)

  test('the PM turns the headings of an approved PRD into draft epics and stories linked to it', async () => {
    const scope = await freshProject()
    const doc = await document({ version: 3 })
    const created = await draftBacklogFromPrd(world.db, scope, world.as('pm'), doc)
    expect(created.map((issue) => [issue.type, issue.title])).toEqual([
      ['epic', 'Payment'],
      ['story', 'Pay with a card'],
      ['story', 'Pay with a wallet'],
      ['epic', 'Delivery'],
    ])
    const [payment, card, wallet] = created
    expect(card).toMatchObject({ parentId: payment.id, description: 'The buyer enters a card.', acceptanceCriteria: '- the card is charged once', status: 'draft', publishedAt: null })
    expect(wallet.parentId).toBe(payment.id)
    for (const issue of created) expect(issue).toMatchObject({ sourceDocumentId: doc, sourceVersion: 3, publishedAt: null })
    expect(card.sourceSection).toBe('Pay with a card')
    expect(created.map((issue) => issue.number)).toEqual([1, 2, 3, 4])
    expect(payment.description).toBe('Pay by card or wallet.')
  })

  test('an agent key can hand in an outline of its own, and still only drafts', async () => {
    const scope = await freshProject()
    const doc = await document()
    const created = await draftBacklogFromPrd(world.db, scope, world.agent('pm'), doc, {
      epics: [{ title: 'Pay', sourceSection: 'Payment', stories: [{ title: 'Pay once', points: 3, acceptanceCriteria: 'Charged once' }] }],
    })
    expect(created.map((issue) => [issue.type, issue.title, issue.points])).toEqual([
      ['epic', 'Pay', null],
      ['story', 'Pay once', 3],
    ])
    expect(created.every((issue) => issue.publishedAt === null)).toBe(true)
  })

  test('an outline that cites a section the PRD does not have creates nothing', async () => {
    const scope = await freshProject()
    const doc = await document()
    await world.rejectsWith(
      () => draftBacklogFromPrd(world.db, scope, world.as('pm'), doc, { epics: [{ title: 'A' }, { title: 'B', sourceSection: 'Not in the PRD' }] }),
      'ISSUE_INPUT_INVALID',
    )
    expect(await count(scope.projectId)).toBe(0)
  })

  test('only an approved PRD that is up to date can be used', async () => {
    const scope = await freshProject()
    const brd = await document({ kind: 'brd', version: 2 })
    const outdated = await document({ sourceId: brd, sourceVersion: 1 })
    for (const doc of [await document({ status: 'draft' }), await document({ kind: 'brd' }), outdated]) {
      await world.rejectsWith(() => draftBacklogFromPrd(world.db, scope, world.as('pm'), doc), 'PLANNING_CONFLICT')
    }
    await world.rejectsWith(() => draftBacklogFromPrd(world.db, scope, world.as('pm'), randomUUID()), 'PLANNING_NOT_FOUND')
  })

  test('only the PM does it', async () => {
    const scope = await freshProject()
    const doc = await document()
    for (const who of ['lead', 'dev', 'plain', 'viewer'] as const) {
      await world.rejectsWith(() => draftBacklogFromPrd(world.db, scope, world.as(who), doc), 'ROLE_NOT_ALLOWED')
    }
    expect(await count(scope.projectId)).toBe(0)
  })

  test('a PRD without epics or stories, and an outline that is too big, are refused', async () => {
    const scope = await freshProject()
    const plainDoc = await document({ content: '# Only a title\n\nText.' })
    await world.rejectsWith(() => draftBacklogFromPrd(world.db, scope, world.as('pm'), plainDoc), 'ISSUE_INPUT_INVALID')
    const doc = await document()
    const stories = Array.from({ length: 201 }, (_, index) => ({ title: `Story ${index}` }))
    await world.rejectsWith(() => draftBacklogFromPrd(world.db, scope, world.as('pm'), doc, { epics: [{ title: 'Big', stories }] }), 'ISSUE_INPUT_INVALID')
    expect(await count(scope.projectId)).toBe(0)
  })

  test('doing it twice adds nothing, and a new story lands under the epic that already exists', async () => {
    const scope = await freshProject()
    const doc = await document()
    await draftBacklogFromPrd(world.db, scope, world.as('pm'), doc)
    expect(await draftBacklogFromPrd(world.db, scope, world.as('pm'), doc)).toEqual([])
    expect(await count(scope.projectId)).toBe(4)
    const [added] = await draftBacklogFromPrd(world.db, scope, world.as('pm'), doc, { epics: [{ title: 'Payment', sourceSection: 'Payment', stories: [{ title: 'Pay with a card', sourceSection: 'Pay with a card' }, { title: 'Refund' }] }] })
    expect(added).toMatchObject({ type: 'story', title: 'Refund' })
    const epics = (await listIssuePage(world.db, scope, world.as('pm'), { type: 'epic' }, { limit: 100, cursor: null })).items
    expect(added.parentId).toBe(epics.find((epic) => epic.title === 'Payment')?.id ?? null)
    expect(await count(scope.projectId)).toBe(5)
  })

  describe('source reviewed', () => {
    async function drafted() {
      const scope = await freshProject()
      const doc = await document()
      const [epic] = await draftBacklogFromPrd(world.db, scope, world.as('pm'), doc)
      const revise = async (version: number) => {
        await world.db`UPDATE planning_documents SET current_version = ${version} WHERE id = ${doc}`
        await world.db`INSERT INTO planning_document_versions (document_id, version, content, created_by) VALUES (${doc}, ${version}, ${PRD}, ${world.ownerId})`
      }
      return { scope, epic, revise }
    }

    test('a new PRD version marks the issue as outdated until the PM reviews it', async () => {
      const { scope, epic, revise } = await drafted()
      expect((await getIssue(world.db, scope, world.as('pm'), epic.id)).sourceOutdated).toBe(false)
      await revise(2)
      expect((await getIssue(world.db, scope, world.as('pm'), epic.id)).sourceOutdated).toBe(true)
      const reviewed = await markSourceReviewed(world.db, scope, world.as('pm'), epic.id)
      expect(reviewed).toMatchObject({ sourceOutdated: false, sourceReviewedVersion: 2, sourceVersion: 1 })
      await revise(3)
      expect((await getIssue(world.db, scope, world.as('pm'), epic.id)).sourceOutdated).toBe(true)
    })

    test('an issue with no source is never outdated and cannot be marked', async () => {
      const scope = await freshProject()
      const { createIssue } = await import('@/services/issues')
      const task = await createIssue(world.db, scope, world.as('pm'), { type: 'task', title: 'No source' })
      expect(task.sourceOutdated).toBeNull()
      await world.rejectsWith(() => markSourceReviewed(world.db, scope, world.as('pm'), task.id), 'ISSUE_INPUT_INVALID')
    })

    test('only the PM marks it, and an AI agent key does not', async () => {
      const { scope, epic, revise } = await drafted()
      await revise(2)
      await world.rejectsWith(() => markSourceReviewed(world.db, scope, world.as('lead'), epic.id), 'ROLE_NOT_ALLOWED')
      await world.rejectsWith(() => markSourceReviewed(world.db, scope, world.agent('pm'), epic.id), 'ISSUE_AGENT_FORBIDDEN')
    })
  })
})
