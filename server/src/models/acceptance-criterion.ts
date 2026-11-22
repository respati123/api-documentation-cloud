// An acceptance criterion of an epic, written as Given / When / Then with concrete values, so a tester can run it
// without asking. Its number is never reused: a removed criterion is struck and a new one takes the next number.
export const AC_LIMITS = { title: 180, flow: 80, given: 2000, when: 2000, thenItem: 1000, thenCount: 10, reason: 500 } as const

export const DESIGN_REPOS = ['backend', 'web', 'mobile', 'qa', 'ui_ux'] as const
export const TEST_LEVELS = ['unit', 'integration', 'e2e', 'manual'] as const
export type DesignRepo = (typeof DESIGN_REPOS)[number]
export type TestLevel = (typeof TEST_LEVELS)[number]

export interface DesignMappingEntry {
  repo: DesignRepo
  component: string
  testLevel: TestLevel
}

export interface AcceptanceCriterionInput {
  flow?: unknown
  title?: unknown
  given?: unknown
  when?: unknown
  then?: unknown
}

export interface AcceptanceCriterionFields {
  flow: string
  title: string
  given: string
  when: string
  then: string[]
}

const blank = (value: unknown) => typeof value !== 'string' || value.trim() === ''

// The parts that are missing or blank, so the error can name them. Then needs at least one outcome.
export function missingParts(input: AcceptanceCriterionInput): Array<'title' | 'given' | 'when' | 'then'> {
  const missing: Array<'title' | 'given' | 'when' | 'then'> = []
  if (blank(input.title)) missing.push('title')
  if (blank(input.given)) missing.push('given')
  if (blank(input.when)) missing.push('when')
  if (!Array.isArray(input.then) || input.then.length === 0 || input.then.some(blank)) missing.push('then')
  return missing
}

// The fields trimmed and within their limits, or null when a part is too long or of the wrong type.
export function acceptanceFields(input: AcceptanceCriterionInput): AcceptanceCriterionFields | null {
  if (missingParts(input).length > 0) return null
  if (input.flow !== undefined && typeof input.flow !== 'string') return null
  const fields = {
    flow: typeof input.flow === 'string' ? input.flow.trim() : '',
    title: String(input.title).trim(),
    given: String(input.given).trim(),
    when: String(input.when).trim(),
    then: (input.then as string[]).map((item) => item.trim()),
  }
  const tooLong =
    fields.flow.length > AC_LIMITS.flow ||
    fields.title.length > AC_LIMITS.title ||
    fields.given.length > AC_LIMITS.given ||
    fields.when.length > AC_LIMITS.when ||
    fields.then.length > AC_LIMITS.thenCount ||
    fields.then.some((item) => item.length > AC_LIMITS.thenItem)
  return tooLong ? null : fields
}

// Where the design satisfies a criterion. Each entry names a repo, the component there, and the level it is tested at.
export function designMappingOf(value: unknown): DesignMappingEntry[] | null {
  if (!Array.isArray(value) || value.length > 10) return null
  const entries: DesignMappingEntry[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const { repo, component, testLevel } = item as Record<string, unknown>
    if (!(DESIGN_REPOS as readonly unknown[]).includes(repo) || !(TEST_LEVELS as readonly unknown[]).includes(testLevel)) return null
    if (typeof component !== 'string' || component.trim() === '' || component.trim().length > 200) return null
    entries.push({ repo: repo as DesignRepo, component: component.trim(), testLevel: testLevel as TestLevel })
  }
  return entries
}

// The code people read: AC7. Outside its epic, the feature code goes in front: AUTH-001/AC7.
export const acCode = (number: number) => `AC${number}`

export interface Coverage {
  inDesign: boolean
  inTask: boolean
  hasTestCase: boolean
}

export function coverageOf(mapping: readonly unknown[], taskCount: number, testCaseCount: number): Coverage {
  return { inDesign: mapping.length > 0, inTask: taskCount > 0, hasTestCase: testCaseCount > 0 }
}
