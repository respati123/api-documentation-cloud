import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { EPIC_DOCUMENT_SECTIONS } from '@/models/epic-document'
import { databaseEnabled } from '@/testing/database'
import { type IssueWorld, openIssueWorld, type Person } from '@/testing/issue-world'
import {
  addCriterionTestCase,
  addEpicCriterion,
  listCriteriaOfIssue,
  listEpicCriteria,
  mapEpicCriterion,
  setIssueCriteria,
  strikeEpicCriterion,
  updateEpicCriterion,
} from '@/services/acceptance-criteria'
import { approveEpicDocument, createEpicDocument, reviseEpicDocument } from '@/services/epic-documents'
import { publishIssue } from '@/services/issue-backlog'
import { createIssue } from '@/services/issues'

const sections = (kind: 'spec' | 'design') => Object.fromEntries(EPIC_DOCUMENT_SECTIONS[kind].map((name) => [name, `${name} text`]))
const criterion = (title: string) => ({
  flow: 'Sign in',
  title,
  given: 'rina@contoh.id has failed 9 times in the last 15 minutes',
  when: 'the user enters a wrong password for the 10th time',
  then: ['"Too many attempts. Try again at 14.35" is shown', 'the correct password is refused for 5 minutes'],
})

// CLOUD-001 AC8, AC9, AC10 and AC23: acceptance criteria as records of an epic.
describe.skipIf(!databaseEnabled)('acceptance criteria', () => {
  let world: IssueWorld

  beforeAll(async () => {
    world = await openIssueWorld()
  })

  afterAll(async () => {
    await world.close()
  })

  // An epic with a draft spec, published so every member can open it.
  const epicWithSpec = async (prefix: string) => {
    const epic = await createIssue(world.db, world.scope, world.as('pm'), { type: 'epic', title: `Epic ${prefix}`, featurePrefix: prefix })
    await publishIssue(world.db, world.scope, world.as('pm'), epic.id)
    const spec = await createEpicDocument(world.db, world.scope, world.as('pm'), epic.id, { kind: 'spec', sections: sections('spec') })
    return { epicId: epic.id, specId: spec.id, code: epic.featureCode as string }
  }
  const add = (who: Person, epic: string, title = 'Locked after failures') => addEpicCriterion(world.db, world.scope, world.as(who), epic, criterion(title))
  const task = async (epicId: string, title: string) => {
    const made = await createIssue(world.db, world.scope, world.as('lead'), { type: 'task', title, parentId: epicId })
    return made.id
  }

  test('the PM adds a criterion as Given / When / Then and it is numbered AC1 with a reference outside the epic', async () => {
    const { epicId, code } = await epicWithSpec('ADD')
    const added = await add('pm', epicId)
    expect(added).toMatchObject({ number: 1, code: 'AC1', ref: `${code}/AC1`, status: 'active', flow: 'Sign in' })
    expect(added.then).toHaveLength(2)
    expect(added.coverage).toEqual({ inDesign: false, inTask: false, hasTestCase: false })
  })

  test('AC23: a criterion without Given, When or Then is refused, naming the missing parts', async () => {
    const { epicId } = await epicWithSpec('MISS')
    await expect(addEpicCriterion(world.db, world.scope, world.as('pm'), epicId, { title: 'Half', given: 'x' })).rejects.toMatchObject({ code: 'AC_INCOMPLETE', details: { missing: ['when', 'then'] } })
    await expect(addEpicCriterion(world.db, world.scope, world.as('pm'), epicId, { ...criterion('Blank then'), then: [' '] })).rejects.toMatchObject({ code: 'AC_INCOMPLETE', details: { missing: ['then'] } })
  })

  test('AC8: numbers are never reused, so after striking AC3 the next criterion is AC4', async () => {
    const { epicId } = await epicWithSpec('NUM')
    await add('pm', epicId, 'one')
    await add('pm', epicId, 'two')
    await add('pm', epicId, 'three')
    const struck = await strikeEpicCriterion(world.db, world.scope, world.as('pm'), epicId, 3, 'Moved to AUTH-004')
    expect(struck).toMatchObject({ status: 'struck', struckReason: 'Moved to AUTH-004' })
    expect((await add('pm', epicId, 'four')).number).toBe(4)
    await world.rejectsWith(() => updateEpicCriterion(world.db, world.scope, world.as('pm'), epicId, 3, criterion('edit struck')), 'PLANNING_CONFLICT')
  })

  test('AC9: striking a criterion flags the tasks and test cases that point at it', async () => {
    const { epicId } = await epicWithSpec('FLAG')
    await add('pm', epicId, 'kept')
    await add('pm', epicId, 'dropped')
    const taskId = await task(epicId, 'Endpoint')
    await setIssueCriteria(world.db, world.scope, world.as('lead'), taskId, [1, 2])
    await addCriterionTestCase(world.db, world.scope, world.as('qa'), epicId, 2, { title: 'Dropped check', steps: ['do it'], expected: ['it works'] })

    await strikeEpicCriterion(world.db, world.scope, world.as('pm'), epicId, 2, 'Out of this release')
    const all = await listEpicCriteria(world.db, world.scope, world.as('lead'), epicId)
    expect(all.flagged.issues).toHaveLength(1)
    expect(all.flagged.testCases).toHaveLength(1)
    const dropped = all.criteria.find((item) => item.number === 2)
    expect(dropped?.issues[0].flagged).toBe(true)
    expect(dropped?.testCases[0].flagged).toBe(true)
    expect(all.criteria.find((item) => item.number === 1)?.issues[0].flagged).toBe(false)
    // The task itself shows the struck criterion it still points at.
    expect((await listCriteriaOfIssue(world.db, world.scope, world.as('dev'), taskId)).map((item) => item.status)).toEqual(['active', 'struck'])
  })

  test('AC10: coverage says, per criterion, whether the design, a task and a test case reach it', async () => {
    const { epicId, specId } = await epicWithSpec('COV')
    await add('pm', epicId, 'covered')
    await add('pm', epicId, 'bare')
    await approveEpicDocument(world.db, world.scope, world.as('pm'), epicId, specId)
    await createEpicDocument(world.db, world.scope, world.as('lead'), epicId, { kind: 'design', sections: sections('design') })
    await mapEpicCriterion(world.db, world.scope, world.as('lead'), epicId, 1, [{ repo: 'backend', component: '423 ACCOUNT_LOCKED', testLevel: 'integration' }])
    await setIssueCriteria(world.db, world.scope, world.as('lead'), await task(epicId, 'Endpoint'), [1])
    await addCriterionTestCase(world.db, world.scope, world.as('qa'), epicId, 1, { title: 'Locked', steps: ['fail 10 times'], expected: ['423'] })

    const { criteria } = await listEpicCriteria(world.db, world.scope, world.as('dev'), epicId)
    expect(criteria.map((item) => item.coverage)).toEqual([
      { inDesign: true, inTask: true, hasTestCase: true },
      { inDesign: false, inTask: false, hasTestCase: false },
    ])
    expect(criteria[0].designMapping).toEqual([{ repo: 'backend', component: '423 ACCOUNT_LOCKED', testLevel: 'integration' }])
  })

  test('criteria change only while the spec is a draft, and a revised spec opens them again', async () => {
    const { epicId, specId } = await epicWithSpec('LOCK')
    await add('pm', epicId)
    await approveEpicDocument(world.db, world.scope, world.as('pm'), epicId, specId)
    await expect(add('pm', epicId, 'late')).rejects.toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED', details: { needs: 'spec_draft' } })
    await world.rejectsWith(() => strikeEpicCriterion(world.db, world.scope, world.as('pm'), epicId, 1, 'x'), 'EPIC_DOCUMENT_BLOCKED')
    await reviseEpicDocument(world.db, world.scope, world.as('pm'), epicId, specId, { expectedVersion: 1, sections: sections('spec') })
    expect((await add('pm', epicId, 'after revision')).number).toBe(2)
  })

  test('an epic without a spec takes no criteria, and the design mapping waits for a draft design', async () => {
    const epic = await createIssue(world.db, world.scope, world.as('pm'), { type: 'epic', title: 'No spec', featurePrefix: 'NOSPEC' })
    await expect(add('pm', epic.id)).rejects.toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED', details: { needs: 'spec_draft' } })
    const { epicId } = await epicWithSpec('NODES')
    await add('pm', epicId)
    await expect(mapEpicCriterion(world.db, world.scope, world.as('lead'), epicId, 1, [])).rejects.toMatchObject({ code: 'EPIC_DOCUMENT_BLOCKED', details: { needs: 'design_draft' } })
  })

  test('who may do what: the PM writes criteria, the tech lead maps them and links tasks, QA writes test cases', async () => {
    const { epicId } = await epicWithSpec('WHO')
    await world.rejectsWith(() => add('lead', epicId), 'ROLE_NOT_ALLOWED')
    await world.rejectsWith(() => add('dev', epicId), 'ROLE_NOT_ALLOWED')
    // An agent key drafts criteria for its PM owner.
    expect((await addEpicCriterion(world.db, world.scope, world.agent('pm'), epicId, criterion('by agent'))).number).toBe(1)
    const taskId = await task(epicId, 'Screen')
    await world.rejectsWith(() => setIssueCriteria(world.db, world.scope, world.as('pm'), taskId, [1]), 'ROLE_NOT_ALLOWED')
    await world.rejectsWith(() => addCriterionTestCase(world.db, world.scope, world.as('dev'), epicId, 1, { title: 'x', steps: ['a'], expected: ['b'] }), 'ROLE_NOT_ALLOWED')
  })

  test('a task links only active criteria of its own epic', async () => {
    const { epicId } = await epicWithSpec('LINK')
    await add('pm', epicId, 'one')
    await add('pm', epicId, 'two')
    await strikeEpicCriterion(world.db, world.scope, world.as('pm'), epicId, 2, 'gone')
    const taskId = await task(epicId, 'Endpoint')
    await world.rejectsWith(() => setIssueCriteria(world.db, world.scope, world.as('lead'), taskId, [2]), 'ISSUE_INPUT_INVALID')
    await world.rejectsWith(() => setIssueCriteria(world.db, world.scope, world.as('lead'), taskId, [9]), 'ISSUE_INPUT_INVALID')
    const loose = await createIssue(world.db, world.scope, world.as('lead'), { type: 'task', title: 'No epic' })
    await world.rejectsWith(() => setIssueCriteria(world.db, world.scope, world.as('lead'), loose.id, [1]), 'ISSUE_INPUT_INVALID')
    expect((await setIssueCriteria(world.db, world.scope, world.as('lead'), taskId, [1, 1])).map((item) => item.code)).toEqual(['AC1'])
  })

  test('members read the criteria once the spec is approved, the PM and tech lead read the draft', async () => {
    const { epicId, specId } = await epicWithSpec('SEE')
    await add('pm', epicId)
    expect((await listEpicCriteria(world.db, world.scope, world.as('dev'), epicId)).criteria).toHaveLength(0)
    expect((await listEpicCriteria(world.db, world.scope, world.as('lead'), epicId)).criteria).toHaveLength(1)
    await approveEpicDocument(world.db, world.scope, world.as('pm'), epicId, specId)
    expect((await listEpicCriteria(world.db, world.scope, world.as('dev'), epicId)).criteria).toHaveLength(1)
  })
})
