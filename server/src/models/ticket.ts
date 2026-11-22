import { formatFeatureCode } from '@/models/feature-code'

// A ticket is a task under an epic, for one role, that one engineer delivers in one pull request.
export const ROLE_CODES = { backend: 'BE', frontend: 'FE', mobile: 'MOB', qa: 'QA', ui_ux: 'UX' } as const
export type TicketRole = keyof typeof ROLE_CODES
export type RoleCode = (typeof ROLE_CODES)[TicketRole]

export function isTicketRole(value: unknown): value is TicketRole {
  return typeof value === 'string' && value in ROLE_CODES
}

// The estimate of the team standard. S is up to a day, M two to three days, and L means the ticket must be split.
// Points are filled from it so burndown and velocity keep working.
export const SIZES = ['S', 'M', 'L'] as const
export type Size = (typeof SIZES)[number]
export const SIZE_POINTS: Record<Size, 1 | 3 | 5> = { S: 1, M: 3, L: 5 }

export function isSize(value: unknown): value is Size {
  return (SIZES as readonly unknown[]).includes(value)
}

// AUTH-001-BE-2: the feature code of the epic, the role code, and the number of the ticket for that role.
export function formatTicketCode(prefix: string, featureNumber: number, roleCode: string, seq: number): string {
  return `${formatFeatureCode(prefix, featureNumber)}-${roleCode}-${seq}`
}

const TICKET_PATTERN = /^([A-Z]{2,8})-(\d{3,})-(BE|FE|MOB|QA|UX)-(\d+)$/

export function parseTicketCode(value: string): { prefix: string; featureNumber: number; roleCode: RoleCode; seq: number } | null {
  const match = TICKET_PATTERN.exec(value.trim().toUpperCase())
  if (!match) return null
  const featureNumber = Number(match[2])
  const seq = Number(match[4])
  if (featureNumber < 1 || seq < 1) return null
  return { prefix: match[1], featureNumber, roleCode: match[3] as RoleCode, seq }
}

export interface TicketCheck {
  given: string
  when: string
  then: string[]
}

export interface RequiredTest {
  case: string
  // True for a failure path: invalid input, no permission, a dependency down, and so on.
  unhappy: boolean
}

export interface TicketDetails {
  repo: string
  goal: string
  scope: string
  designNotes: string
  codeFollow: string
  codeTouch: string
  ticketAcs: TicketCheck[]
  requiredTests: RequiredTest[]
  outOfScope: string
  skills: string[]
  size: Size | null
  usesApi: boolean
  openQuestions: string
}

export const EMPTY_DETAILS: TicketDetails = {
  repo: '',
  goal: '',
  scope: '',
  designNotes: '',
  codeFollow: '',
  codeTouch: '',
  ticketAcs: [],
  requiredTests: [],
  outOfScope: '',
  skills: [],
  size: null,
  usesApi: true,
  openQuestions: '',
}

const LIMITS = { repo: 100, goal: 2000, scope: 4000, designNotes: 8000, codeFollow: 1000, codeTouch: 2000, outOfScope: 2000, openQuestions: 2000 } as const

const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim().length <= max ? value.trim() : null)
const filled = (value: unknown) => typeof value === 'string' && value.trim() !== ''

// Reads the ticket fields a client sent, on top of what is stored. A field left out keeps its value.
// Returns null when a field has the wrong type or is too long. Blank fields are allowed: a draft fills in over time.
export function mergeDetails(current: TicketDetails, input: Record<string, unknown>): TicketDetails | null {
  const next: TicketDetails = { ...current }
  for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
    if (input[key] === undefined) continue
    const value = text(input[key], LIMITS[key])
    if (value === null) return null
    next[key] = value
  }
  if (input.ticketAcs !== undefined) {
    const list = input.ticketAcs
    if (!Array.isArray(list) || list.length > 20) return null
    const checks: TicketCheck[] = []
    for (const item of list) {
      const { given, when, then } = (item ?? {}) as Record<string, unknown>
      if (!filled(given) || !filled(when) || !Array.isArray(then) || then.length === 0 || then.length > 10 || !then.every(filled)) return null
      if (String(given).length > 2000 || String(when).length > 2000 || then.some((line) => String(line).length > 1000)) return null
      checks.push({ given: String(given).trim(), when: String(when).trim(), then: then.map((line) => String(line).trim()) })
    }
    next.ticketAcs = checks
  }
  if (input.requiredTests !== undefined) {
    const list = input.requiredTests
    if (!Array.isArray(list) || list.length > 50) return null
    const tests: RequiredTest[] = []
    for (const item of list) {
      const { case: name, unhappy } = (item ?? {}) as Record<string, unknown>
      if (!filled(name) || String(name).length > 500 || typeof unhappy !== 'boolean') return null
      tests.push({ case: String(name).trim(), unhappy })
    }
    next.requiredTests = tests
  }
  if (input.skills !== undefined) {
    const list = input.skills
    if (!Array.isArray(list) || list.length > 20 || !list.every((skill) => filled(skill) && String(skill).length <= 60)) return null
    next.skills = [...new Set(list.map((skill) => String(skill).trim()))]
  }
  if (input.size !== undefined) {
    if (input.size !== null && !isSize(input.size)) return null
    next.size = input.size as Size | null
  }
  if (input.usesApi !== undefined) {
    if (typeof input.usesApi !== 'boolean') return null
    next.usesApi = input.usesApi
  }
  return next
}

// The Definition of Ready of the team standard, item by item.
export const READINESS_ITEMS = {
  1: 'Goal, scope, out of scope, role and repo are filled in',
  2: 'Parent acceptance criteria are linked and active, and restated as ticket checks',
  3: 'Spec approved by the PM, design approved by the tech lead, contract approved when the ticket uses an API',
  4: 'Dependencies point to existing tickets without a cycle',
  5: 'The design section holds the decisions this ticket needs',
  6: 'Code areas name an example to follow and the expected areas, and the engineering skills are listed',
  7: 'Required tests are listed, with at least one unhappy path',
  8: 'The estimate is S or M',
  9: 'No open question blocks the ticket',
} as const
export type ReadinessItem = keyof typeof READINESS_ITEMS

export interface ReadinessFacts {
  role: string | null
  details: TicketDetails
  linkedCriteria: number
  struckCriteria: number
  specApproved: boolean
  designApproved: boolean
  designStale: boolean
  contractApproved: boolean
  hasDependencyCycle: boolean
}

// The items that do not hold, with the reason for each. An empty list means the ticket is Ready.
export function readinessMisses(facts: ReadinessFacts): Array<{ item: ReadinessItem; reason: string }> {
  const { details: d } = facts
  const misses: Array<{ item: ReadinessItem; reason: string }> = []
  const miss = (item: ReadinessItem, reason: string) => misses.push({ item, reason })

  const blank = [
    ['goal', d.goal],
    ['scope', d.scope],
    ['outOfScope', d.outOfScope],
    ['repo', d.repo],
  ].filter(([, value]) => value === '')
  if (blank.length > 0 || facts.role === null) miss(1, [facts.role === null ? 'role' : null, ...blank.map(([name]) => name)].filter(Boolean).join(', ') + ' missing')
  if (facts.linkedCriteria === 0) miss(2, 'no parent acceptance criterion linked')
  else if (facts.struckCriteria > 0) miss(2, `${facts.struckCriteria} linked criterion struck`)
  else if (d.ticketAcs.length === 0) miss(2, 'no ticket checks')
  if (!facts.specApproved) miss(3, 'spec not approved')
  else if (!facts.designApproved || facts.designStale) miss(3, facts.designStale ? 'design built on an old spec' : 'design not approved')
  else if (d.usesApi && !facts.contractApproved) miss(3, 'contract not approved')
  if (facts.hasDependencyCycle) miss(4, 'dependency cycle')
  if (d.designNotes === '') miss(5, 'design notes missing')
  if (d.codeFollow === '' || d.codeTouch === '' || d.skills.length === 0) miss(6, [d.codeFollow === '' ? 'example to follow' : null, d.codeTouch === '' ? 'expected areas' : null, d.skills.length === 0 ? 'skills' : null].filter(Boolean).join(', ') + ' missing')
  if (d.requiredTests.length === 0) miss(7, 'no required tests')
  else if (!d.requiredTests.some((test) => test.unhappy)) miss(7, 'no unhappy path')
  if (d.size !== 'S' && d.size !== 'M') miss(8, d.size === 'L' ? 'size L, split the ticket' : 'no estimate')
  if (d.openQuestions !== '') miss(9, 'open question blocks the ticket')
  return misses
}
