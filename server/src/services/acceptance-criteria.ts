import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import {
  AC_LIMITS,
  acCode,
  type AcceptanceCriterionInput,
  acceptanceFields,
  type Coverage,
  coverageOf,
  type DesignMappingEntry,
  designMappingOf,
  missingParts,
} from '@/models/acceptance-criterion'
import type { IssueRow } from '@/models/issue'
import {
  type AcceptanceCriterionRow,
  findAcceptanceCriterion,
  insertAcceptanceCriterion,
  listAcceptanceCriteria,
  listIssueCriteria,
  listLinkedIssues,
  listLinkedTestCases,
  lockEpic,
  replaceIssueCriteria,
  setDesignMapping,
  strikeAcceptanceCriterion,
  updateAcceptanceCriterion,
} from '@/repositories/acceptance-criteria.repository'
import { findIssue } from '@/repositories/issues.repository'
import { listEpicDocumentRows } from '@/repositories/planning-documents.repository'
import { insertTestCase } from '@/repositories/stories.repository'
import { type Actor, invalid, type IssueScope, loadVisible, logEvent } from '@/services/issues'
import { type ProjectRoles, resolveProjectRoles } from '@/services/project-roles'

export interface AcceptanceCriterion {
  id: string
  number: number
  // AC7, and AUTH-001/AC7 for use outside the epic.
  code: string
  ref: string
  flow: string
  title: string
  given: string
  when: string
  then: string[]
  status: 'active' | 'struck'
  struckReason: string | null
  struckAt: Date | null
  designMapping: DesignMappingEntry[]
  coverage: Coverage
  // The tasks, bugs and test cases that point at it. When the criterion is struck, every one of them is flagged.
  issues: Array<{ id: string; key: string; type: string; title: string; flagged: boolean }>
  testCases: Array<{ id: string; code: string; title: string; flagged: boolean }>
}

export interface EpicAcceptanceCriteria {
  criteria: AcceptanceCriterion[]
  // Work that points at a struck criterion and needs a look.
  flagged: { issues: string[]; testCases: string[] }
}

async function loadEpic(db: SQL, scope: IssueScope, actor: Actor, ref: string): Promise<{ epic: IssueRow; roles: ProjectRoles }> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const epic = await loadVisible(db, scope, actor, roles, ref)
  if (epic.type !== 'epic') throw new AppError('ISSUE_NOT_FOUND')
  return { epic, roles }
}

async function liveDocument(db: SQL, epicId: string, kind: 'spec' | 'design') {
  return (await listEpicDocumentRows(db, epicId)).find((row) => row.kind === kind)
}

// Criteria are part of the spec, so they change only while the spec is a draft. An approved spec is revised first.
async function requireDraft(db: SQL, epicId: string, kind: 'spec' | 'design'): Promise<void> {
  const document = await liveDocument(db, epicId, kind)
  if (!document || document.status !== 'draft') throw new AppError('EPIC_DOCUMENT_BLOCKED', { details: { needs: `${kind}_draft` } })
}

function fieldsOf(input: AcceptanceCriterionInput) {
  const missing = missingParts(input)
  if (missing.length > 0) throw new AppError('AC_INCOMPLETE', { details: { missing } })
  const fields = acceptanceFields(input)
  if (!fields) throw invalid()
  return fields
}

async function criterionOf(db: SQL, epicId: string, number: unknown): Promise<AcceptanceCriterionRow> {
  if (!Number.isInteger(number) || (number as number) < 1) throw invalid()
  const row = await findAcceptanceCriterion(db, epicId, number as number)
  if (!row) throw new AppError('PLANNING_NOT_FOUND')
  return row
}

async function assemble(db: SQL, epic: IssueRow): Promise<EpicAcceptanceCriteria> {
  const [rows, issues, testCases] = await Promise.all([listAcceptanceCriteria(db, epic.id), listLinkedIssues(db, epic.id), listLinkedTestCases(db, epic.id)])
  const criteria = rows.map((row): AcceptanceCriterion => {
    const struck = row.status === 'struck'
    const linked = issues.filter((issue) => issue.acId === row.id)
    const cases = testCases.filter((testCase) => testCase.acId === row.id)
    return {
      id: row.id,
      number: row.number,
      code: acCode(row.number),
      ref: `${epic.featureCode}/${acCode(row.number)}`,
      flow: row.flow,
      title: row.title,
      given: row.given,
      when: row.when,
      then: row.then,
      status: row.status,
      struckReason: row.struckReason,
      struckAt: row.struckAt,
      designMapping: row.designMapping,
      coverage: coverageOf(row.designMapping, linked.length, cases.length),
      issues: linked.map((issue) => ({ id: issue.issueId, key: issue.key, type: issue.type, title: issue.title, flagged: struck })),
      testCases: cases.map((testCase) => ({ id: testCase.id, code: `TC-${testCase.number}`, title: testCase.title, flagged: struck })),
    }
  })
  const struck = criteria.filter((criterion) => criterion.status === 'struck')
  return {
    criteria,
    flagged: {
      issues: [...new Set(struck.flatMap((criterion) => criterion.issues.map((issue) => issue.key)))],
      testCases: struck.flatMap((criterion) => criterion.testCases.map((testCase) => testCase.id)),
    },
  }
}

// The criteria are read with the spec: by the PM and the tech lead always, by other members once the spec is approved.
export async function listEpicCriteria(db: SQL, scope: IssueScope, actor: Actor, epicRef: string): Promise<EpicAcceptanceCriteria> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  if (!roles.isApprover && (await liveDocument(db, epic.id, 'spec'))?.status !== 'approved') return { criteria: [], flagged: { issues: [], testCases: [] } }
  return assemble(db, epic)
}

// The PM writes the criteria. An agent key drafts them for its owner, and the spec still needs a person to approve it.
export async function addEpicCriterion(db: SQL, scope: IssueScope, actor: Actor, epicRef: string, input: AcceptanceCriterionInput): Promise<AcceptanceCriterion> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  if (!roles.isPm) throw new AppError('ROLE_NOT_ALLOWED')
  const fields = fieldsOf(input)
  await requireDraft(db, epic.id, 'spec')
  const number = await db.begin(async (tx) => {
    await lockEpic(tx, epic.id)
    const added = await insertAcceptanceCriterion(tx, { id: randomUUID(), epicId: epic.id, ...fields, createdBy: actor.userId, apiKeyId: actor.apiKeyId ?? null })
    await logEvent(tx, scope, actor, epic.id, 'acceptance_criterion.added', { number: added })
    return added
  })
  return pick(db, epic, number)
}

export async function updateEpicCriterion(db: SQL, scope: IssueScope, actor: Actor, epicRef: string, number: unknown, input: AcceptanceCriterionInput): Promise<AcceptanceCriterion> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  if (!roles.isPm) throw new AppError('ROLE_NOT_ALLOWED')
  const row = await criterionOf(db, epic.id, number)
  if (row.status === 'struck') throw new AppError('PLANNING_CONFLICT')
  const fields = fieldsOf(input)
  await requireDraft(db, epic.id, 'spec')
  await db.begin(async (tx) => {
    await updateAcceptanceCriterion(tx, row.id, fields)
    await logEvent(tx, scope, actor, epic.id, 'acceptance_criterion.updated', { number: row.number })
  })
  return pick(db, epic, row.number)
}

// A criterion is never deleted or renumbered. Striking it keeps the number and flags the work that points at it.
export async function strikeEpicCriterion(db: SQL, scope: IssueScope, actor: Actor, epicRef: string, number: unknown, reason: unknown): Promise<AcceptanceCriterion> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  if (!roles.isPm) throw new AppError('ROLE_NOT_ALLOWED')
  const row = await criterionOf(db, epic.id, number)
  if (typeof reason !== 'string' || reason.trim() === '' || reason.trim().length > AC_LIMITS.reason) throw invalid()
  await requireDraft(db, epic.id, 'spec')
  await db.begin(async (tx) => {
    if (!(await strikeAcceptanceCriterion(tx, row.id, reason.trim()))) throw new AppError('PLANNING_CONFLICT')
    await logEvent(tx, scope, actor, epic.id, 'acceptance_criterion.struck', { number: row.number, reason: reason.trim() })
  })
  return pick(db, epic, row.number)
}

// The tech lead says where the design satisfies a criterion, while the design is a draft.
export async function mapEpicCriterion(db: SQL, scope: IssueScope, actor: Actor, epicRef: string, number: unknown, entries: unknown): Promise<AcceptanceCriterion> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  if (!roles.isTechLead) throw new AppError('ROLE_NOT_ALLOWED')
  const row = await criterionOf(db, epic.id, number)
  if (row.status === 'struck') throw new AppError('PLANNING_CONFLICT')
  const mapping = designMappingOf(entries)
  if (!mapping) throw invalid()
  await requireDraft(db, epic.id, 'design')
  await db.begin(async (tx) => {
    await setDesignMapping(tx, row.id, mapping)
    await logEvent(tx, scope, actor, epic.id, 'acceptance_criterion.mapped', { number: row.number })
  })
  return pick(db, epic, row.number)
}

// QA, the PM and the tech lead write test cases. Each one checks one active criterion.
export async function addCriterionTestCase(
  db: SQL,
  scope: IssueScope,
  actor: Actor,
  epicRef: string,
  number: unknown,
  input: { title?: unknown; precondition?: unknown; steps?: unknown; expected?: unknown },
): Promise<AcceptanceCriterion> {
  const { epic, roles } = await loadEpic(db, scope, actor, epicRef)
  if (!roles.isApprover && !roles.disciplines.includes('qa')) throw new AppError('ROLE_NOT_ALLOWED')
  const row = await criterionOf(db, epic.id, number)
  if (row.status === 'struck') throw new AppError('PLANNING_CONFLICT')
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const precondition = input.precondition === undefined ? '' : input.precondition
  const lines = (value: unknown) => Array.isArray(value) && value.length > 0 && value.length <= 30 && value.every((line) => typeof line === 'string' && line.trim() !== '' && line.length <= 1000)
  if (title === '' || title.length > 180 || typeof precondition !== 'string' || precondition.length > 2000 || !lines(input.steps) || !lines(input.expected)) throw invalid()
  await db.begin(async (tx) => {
    await insertTestCase(tx, {
      id: randomUUID(),
      storyId: epic.id,
      title,
      precondition: precondition.trim(),
      steps: (input.steps as string[]).map((line) => line.trim()),
      expected: (input.expected as string[]).map((line) => line.trim()),
      createdBy: actor.userId,
      apiKeyId: actor.apiKeyId ?? null,
      acId: row.id,
    })
    await logEvent(tx, scope, actor, epic.id, 'acceptance_criterion.test_case_added', { number: row.number })
  })
  return pick(db, epic, row.number)
}

// The tech lead says which criteria of its epic a task or bug delivers. Only active criteria can be chosen.
export async function setIssueCriteria(db: SQL, scope: IssueScope, actor: Actor, issueRef: string, numbers: unknown): Promise<AcceptanceCriterion[]> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, issueRef)
  if (!roles.isTechLead) throw new AppError('ROLE_NOT_ALLOWED')
  if ((issue.type !== 'task' && issue.type !== 'bug') || !issue.parentId) throw invalid()
  const epic = await findIssue(db, scope.projectId, issue.parentId)
  if (epic?.type !== 'epic') throw invalid()
  if (!Array.isArray(numbers) || numbers.length > 50 || !numbers.every((number) => Number.isInteger(number) && number >= 1)) throw invalid()
  const rows = await listAcceptanceCriteria(db, epic.id)
  const chosen = [...new Set(numbers as number[])].map((number) => rows.find((row) => row.number === number))
  if (chosen.some((row) => !row || row.status !== 'active')) throw invalid()
  await db.begin(async (tx) => {
    await replaceIssueCriteria(tx, issue.id, chosen.map((row) => (row as AcceptanceCriterionRow).id), actor.userId)
    await logEvent(tx, scope, actor, issue.id, 'issue.acceptance_criteria_set', { numbers: chosen.map((row) => (row as AcceptanceCriterionRow).number) })
  })
  return listCriteriaOfIssue(db, scope, actor, issue.id)
}

export async function listCriteriaOfIssue(db: SQL, scope: IssueScope, actor: Actor, issueRef: string): Promise<AcceptanceCriterion[]> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const issue = await loadVisible(db, scope, actor, roles, issueRef)
  if (!issue.parentId) return []
  const epic = await findIssue(db, scope.projectId, issue.parentId)
  if (epic?.type !== 'epic') return []
  const ids = new Set((await listIssueCriteria(db, issue.id)).map((row) => row.id))
  return (await assemble(db, epic)).criteria.filter((criterion) => ids.has(criterion.id))
}

// The number of active criteria. The spec is approved only when it has at least one.
export async function countActiveCriteria(db: SQL, epicId: string): Promise<number> {
  return (await listAcceptanceCriteria(db, epicId)).filter((row) => row.status === 'active').length
}

async function pick(db: SQL, epic: IssueRow, number: number): Promise<AcceptanceCriterion> {
  return (await assemble(db, epic)).criteria.find((criterion) => criterion.number === number) as AcceptanceCriterion
}
