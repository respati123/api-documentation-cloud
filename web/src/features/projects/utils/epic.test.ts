import { describe, expect, test } from 'vitest'
import type { Criterion, EpicDocument, EpicTicket } from '@/features/projects/models/epic.model'
import type { Issue } from '@/features/projects/models/issue.model'
import type { ProjectMember } from '@/features/projects/models/project.model'
import {
  coverageSummary,
  criteriaFlows,
  dependencyWaves,
  designMatrix,
  epicStages,
  filterCriteria,
  loadAfter,
  proposeAssignment,
} from '@/features/projects/utils/epic'

const doc = (kind: EpicDocument['kind'], status: string, stale = false) => ({ id: kind, kind, status, stale }) as EpicDocument
const ticket = (
  id: string,
  over: { ready?: boolean; dependsOn?: string[]; role?: string; points?: number; assigneeId?: string | null } = {},
) =>
  ({
    issue: { id, key: id, role: over.role ?? 'backend', points: over.points ?? 3, assigneeId: over.assigneeId ?? null } as Issue,
    readiness: { ready: over.ready ?? true, failing: [] },
    dependsOn: over.dependsOn ?? [],
  }) as unknown as EpicTicket
const criterion = (number: number, over: Partial<Criterion> = {}) =>
  ({
    id: `c${number}`,
    number,
    code: `AC${number}`,
    title: `t${number}`,
    flow: 'Sign in',
    status: 'active',
    designMapping: [],
    coverage: { inDesign: false, inTask: false, hasTestCase: false },
    ...over,
  }) as Criterion
const member = (id: string, disciplines: string[]) =>
  ({ id, email: `${id}@contoh.id`, discipline: disciplines[0] ?? null, disciplines }) as ProjectMember

describe('epic stages', () => {
  test('the current stage is the first one not approved, and a stale design shows as stale', () => {
    const stages = epicStages([doc('spec', 'approved'), doc('design', 'approved', true)], [])
    expect(stages.map((stage) => [stage.id, stage.state, stage.current])).toEqual([
      ['spec', 'approved', false],
      ['design', 'stale', true],
      ['contract', 'missing', false],
      ['tickets', 'missing', false],
    ])
  })

  test('the tickets stage counts Ready tickets and is approved only when all are Ready', () => {
    const docs = [doc('spec', 'approved'), doc('design', 'approved'), doc('contract', 'approved')]
    const some = epicStages(docs, [ticket('a'), ticket('b', { ready: false })])[3]
    expect(some).toMatchObject({ state: 'review', ready: 1, total: 2, current: true })
    expect(epicStages(docs, [ticket('a')])[3]).toMatchObject({ state: 'approved', current: false })
  })
})

describe('acceptance criteria', () => {
  test('flows keep their first order, and the filter keeps one flow', () => {
    const list = [criterion(1, { flow: 'Sign up' }), criterion(2), criterion(3, { flow: 'Sign up' })]
    expect(criteriaFlows(list)).toEqual(['Sign up', 'Sign in'])
    expect(filterCriteria(list, 'Sign up').map((item) => item.number)).toEqual([1, 3])
    expect(filterCriteria(list, null)).toHaveLength(3)
  })

  test('coverage counts only active criteria', () => {
    const list = [
      criterion(1, { coverage: { inDesign: true, inTask: true, hasTestCase: false } }),
      criterion(2, { status: 'struck', coverage: { inDesign: true, inTask: true, hasTestCase: true } }),
    ]
    expect(coverageSummary(list)).toEqual({ active: 1, struck: 1, inDesign: 1, inTask: 1, hasTestCase: 0 })
  })

  test('the design matrix has one column per mapped repo', () => {
    const list = [
      criterion(1, { designMapping: [{ repo: 'backend', component: 'POST /v1/auth/register', testLevel: 'integration' }] }),
      criterion(2, { designMapping: [{ repo: 'web', component: 'SignUpForm', testLevel: 'component' }] }),
      criterion(3, { status: 'struck', designMapping: [{ repo: 'mobile', component: 'x', testLevel: 'unit' }] }),
    ]
    const matrix = designMatrix(list)
    expect(matrix.repos).toEqual(['backend', 'web'])
    expect(matrix.rows.map((row) => row.cells.map((cell) => cell.length))).toEqual([
      [1, 0],
      [0, 1],
    ])
  })
})

describe('dependency waves (CLOUD-001 AC16)', () => {
  test('a ticket waits for its dependencies in the epic, not for work outside it', () => {
    const { waves, looped } = dependencyWaves([
      ticket('c', { dependsOn: ['b'] }),
      ticket('a', { dependsOn: ['outside'] }),
      ticket('b', { dependsOn: ['a'] }),
    ])
    expect(waves.map((wave) => wave.map((item) => item.issue.id))).toEqual([['a'], ['b'], ['c']])
    expect(looped).toEqual([])
  })

  test('tickets in a loop are returned apart', () => {
    const { waves, looped } = dependencyWaves([ticket('a'), ticket('b', { dependsOn: ['c'] }), ticket('c', { dependsOn: ['b'] })])
    expect(waves.map((wave) => wave.map((item) => item.issue.id))).toEqual([['a']])
    expect(looped.map((item) => item.issue.id)).toEqual(['b', 'c'])
  })
})

describe('assignment proposal', () => {
  test('each Ready ticket without an assignee goes to the lightest member of its role', () => {
    const members = [member('sari', ['backend']), member('budi', ['backend']), member('rina', ['frontend'])]
    const waves = [[ticket('a', { points: 3 }), ticket('b', { points: 3 })], [ticket('c', { role: 'frontend', points: 1 })]]
    const { rows, before } = proposeAssignment(waves, members, [{ userId: 'sari', points: 2, count: 1 }])
    expect(rows.map((row) => [row.ticket.issue.id, row.proposedId])).toEqual([
      ['a', 'budi'],
      ['b', 'sari'],
      ['c', 'rina'],
    ])
    const load = loadAfter(
      members,
      before,
      rows.map((row) => ({ ticket: row.ticket, assigneeId: row.proposedId })),
    )
    expect(load.map((row) => [row.member.id, row.before, row.after])).toEqual([
      ['sari', 2, 5],
      ['budi', 0, 3],
      ['rina', 0, 1],
    ])
  })

  test('not-ready and assigned tickets are left out, and a role with no member gets no proposal', () => {
    const waves = [[ticket('a', { ready: false }), ticket('b', { assigneeId: 'x' }), ticket('c', { role: 'mobile' })]]
    const { rows } = proposeAssignment(waves, [member('sari', ['backend'])], [])
    expect(rows.map((row) => [row.ticket.issue.id, row.proposedId, row.candidates.length])).toEqual([['c', null, 0]])
  })
})
