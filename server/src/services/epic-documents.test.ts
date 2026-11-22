import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { EPIC_DOCUMENT_SECTIONS } from '@/models/epic-document'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld, type Person } from '@/testing/issue-world'
import { approveEpicDocument, createEpicDocument, discardEpicDocument, getEpicDocument, listEpicDocuments, reviseEpicDocument } from '@/services/epic-documents'
import { addEpicCriterion } from '@/services/acceptance-criteria'
import { publishIssue } from '@/services/issue-backlog'
import { createIssue as createAnyIssue } from '@/services/issues'

const createIssue = (world: IssueWorld, featurePrefix: string) => createAnyIssue(world.db, world.scope, world.as('pm'), { type: 'epic', title: `Epic ${featurePrefix}`, featurePrefix })
const publishIssueForTest = (world: IssueWorld, id: string) => publishIssue(world.db, world.scope, world.as('pm'), id)

const sections = (kind: 'spec' | 'design' | 'contract', marker = 'v1') => Object.fromEntries(EPIC_DOCUMENT_SECTIONS[kind].map((name) => [name, `${name} ${marker}`]))

// CLOUD-001 AC3, AC4 and AC5: the spec, design and contract of an epic, their order, who approves them, and staleness.
describe.skipIf(!databaseEnabled)('epic documents', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  const newEpic = async (prefix: string) => (await createIssue(world, prefix)).id
  // A spec is approved only with an acceptance criterion, so every spec made here gets one.
  const create = async (who: Person, epic: string, kind: 'spec' | 'design' | 'contract', body = sections(kind)) => {
    const document = await createEpicDocument(world.db, world.scope, world.as(who), epic, { kind, sections: body })
    if (kind === 'spec') await addEpicCriterion(world.db, world.scope, world.as(who), epic, { title: 'Signs in', given: 'an account', when: 'the user signs in', then: ['the home page opens'] })
    return document
  }
  const approve = (who: Person, epic: string, id: string) => approveEpicDocument(world.db, world.scope, world.as(who), epic, id)

  test('the PM drafts the spec with every section, and the sections come back in order', async () => {
    const epic = await newEpic('SPEC')
    const spec = await create('pm', epic, 'spec')
    expect(spec).toMatchObject({ kind: 'spec', status: 'draft', version: 1, stale: false, sourceDocumentId: null })
    expect(Object.keys(spec.sections)).toEqual([...EPIC_DOCUMENT_SECTIONS.spec])
    expect(spec.title).toBe('SPEC-001 spec')
  })

  test('a document with a missing section is refused, naming the sections', async () => {
    const epic = await newEpic('MISS')
    const body = { ...sections('spec'), goals: '  ', users: undefined as unknown as string }
    await expect(create('pm', epic, 'spec', body)).rejects.toMatchObject({ code: 'EPIC_DOCUMENT_INCOMPLETE', details: { missing: ['goals', 'users'] } })
  })

  test('AC3: a design waits for an approved spec, and a contract for an approved design', async () => {
    const epic = await newEpic('GATE')
    await expect(create('lead', epic, 'design')).rejects.toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED', details: { needs: 'spec_approved' } })
    const spec = await create('pm', epic, 'spec')
    await expect(create('lead', epic, 'design')).rejects.toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED', details: { needs: 'spec_approved' } })
    await approve('pm', epic, spec.id)
    const design = await create('lead', epic, 'design')
    expect(design.sourceDocumentId).toBe(spec.id)
    expect(design.sourceVersion).toBe(1)
    await expect(create('lead', epic, 'contract')).rejects.toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED', details: { needs: 'design_approved' } })
    await approve('lead', epic, design.id)
    expect((await create('lead', epic, 'contract')).sourceDocumentId).toBe(design.id)
  })

  test('AC4: the PM writes and approves the spec, the tech lead the design and contract, and an agent key approves nothing', async () => {
    const epic = await newEpic('ROLE')
    // Published, so a developer sees the epic and the refusal is about the role, not about a hidden draft.
    await publishIssueForTest(world, epic)
    await world.rejectsWith(() => create('lead', epic, 'spec'), 'ROLE_NOT_ALLOWED')
    await world.rejectsWith(() => create('dev', epic, 'spec'), 'ROLE_NOT_ALLOWED')
    const spec = await create('pm', epic, 'spec')
    await world.rejectsWith(() => approve('lead', epic, spec.id), 'ROLE_NOT_ALLOWED')
    await world.rejectsWith(() => approveEpicDocument(world.db, world.scope, world.agent('pm'), epic, spec.id), 'ISSUE_AGENT_FORBIDDEN')
    await approve('pm', epic, spec.id)
    await world.rejectsWith(() => create('pm', epic, 'design'), 'ROLE_NOT_ALLOWED')
    // An agent key drafts for its owner, the tech lead approves.
    const design = await createEpicDocument(world.db, world.scope, world.agent('lead'), epic, { kind: 'design', sections: sections('design') })
    await world.rejectsWith(() => approve('pm', epic, design.id), 'ROLE_NOT_ALLOWED')
    expect((await approve('lead', epic, design.id)).approvedBy).toBe(world.people.lead)
  })

  test('AC5: a new spec version makes the design stale, blocks the contract, and a revised design catches up', async () => {
    const epic = await newEpic('STALE')
    const spec = await create('pm', epic, 'spec')
    await approve('pm', epic, spec.id)
    const design = await create('lead', epic, 'design')
    await approve('lead', epic, design.id)

    const revised = await reviseEpicDocument(world.db, world.scope, world.as('pm'), epic, spec.id, { expectedVersion: 1, sections: sections('spec', 'v2') })
    expect(revised).toMatchObject({ version: 2, status: 'draft', approvedBy: null })
    expect((await getEpicDocument(world.db, world.scope, world.as('lead'), epic, design.id)).stale).toBe(true)
    expect((await listEpicDocuments(world.db, world.scope, world.as('lead'), epic)).blocked).toEqual({ spec: null, design: 'spec_approved', contract: 'design_current' })

    // The design cannot catch up until the new spec is approved.
    await world.rejectsWith(() => reviseEpicDocument(world.db, world.scope, world.as('lead'), epic, design.id, { expectedVersion: 1, sections: sections('design', 'v2') }), 'EPIC_DOCUMENT_BLOCKED')
    await approve('pm', epic, spec.id)
    const caughtUp = await reviseEpicDocument(world.db, world.scope, world.as('lead'), epic, design.id, { expectedVersion: 1, sections: sections('design', 'v2') })
    expect(caughtUp).toMatchObject({ version: 2, sourceVersion: 2, stale: false, status: 'draft' })
  })

  test('a revision with an old version number is a conflict', async () => {
    const epic = await newEpic('RACE')
    const spec = await create('pm', epic, 'spec')
    await reviseEpicDocument(world.db, world.scope, world.as('pm'), epic, spec.id, { expectedVersion: 1, sections: sections('spec', 'v2') })
    await world.rejectsWith(() => reviseEpicDocument(world.db, world.scope, world.as('pm'), epic, spec.id, { expectedVersion: 1, sections: sections('spec', 'v3') }), 'PLANNING_CONFLICT')
  })

  test('an epic holds one live spec, and discarding the draft makes room for a new one', async () => {
    const epic = await newEpic('ONE')
    const spec = await create('pm', epic, 'spec')
    await world.rejectsWith(() => create('pm', epic, 'spec'), 'PLANNING_CONFLICT')
    await discardEpicDocument(world.db, world.scope, world.as('pm'), epic, spec.id)
    expect((await create('pm', epic, 'spec')).id).not.toBe(spec.id)
  })

  test('members read approved documents only, the PM and tech lead read drafts too', async () => {
    const epic = await newEpic('READ')
    await publishIssueForTest(world, epic)
    const spec = await create('pm', epic, 'spec')
    expect((await listEpicDocuments(world.db, world.scope, world.as('dev'), epic)).documents).toHaveLength(0)
    expect((await listEpicDocuments(world.db, world.scope, world.as('lead'), epic)).documents).toHaveLength(1)
    await world.rejectsWith(() => getEpicDocument(world.db, world.scope, world.as('dev'), epic, spec.id), 'PLANNING_NOT_FOUND')
    await approve('pm', epic, spec.id)
    expect((await listEpicDocuments(world.db, world.scope, world.as('dev'), epic)).documents).toHaveLength(1)
  })

  test('a spec without an active acceptance criterion cannot be approved', async () => {
    const epic = await newEpic('NOAC')
    const spec = await createEpicDocument(world.db, world.scope, world.as('pm'), epic, { kind: 'spec', sections: sections('spec') })
    await expect(approve('pm', epic, spec.id)).rejects.toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED', details: { needs: 'acceptance_criteria' } })
  })

  test('documents hang on epics only, and the epic opens by its feature code', async () => {
    const epic = await createIssue(world, 'CODE')
    expect((await create('pm', 'CODE-001', 'spec')).epicId).toBe(epic.id)
    const task = await createAnyIssue(world.db, world.scope, world.as('pm'), { type: 'task', title: 'Not an epic' })
    await world.rejectsWith(() => create('pm', task.id, 'spec'), 'ISSUE_NOT_FOUND')
  })
})
