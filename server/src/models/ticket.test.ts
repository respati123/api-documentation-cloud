import { describe, expect, test } from 'bun:test'
import { EMPTY_DETAILS, formatTicketCode, mergeDetails, parseTicketCode, type ReadinessFacts, readinessMisses, type TicketDetails } from '@/models/ticket'

const ready: TicketDetails = {
  repo: 'expenses-backend',
  goal: 'Users sign up and sign in with email.',
  scope: 'Register and login endpoints.',
  designNotes: '409 EMAIL_TAKEN, 423 ACCOUNT_LOCKED with retryAfter.',
  codeFollow: 'src/modules/expenses/',
  codeTouch: 'src/modules/auth/',
  ticketAcs: [{ given: 'a new email', when: 'POST /v1/auth/register', then: ['201 with tokens'] }],
  requiredTests: [
    { case: 'register succeeds', unhappy: false },
    { case: 'duplicate email returns 409', unhappy: true },
  ],
  outOfScope: 'Google sign-in: AUTH-001-BE-3.',
  skills: ['api-endpoint', 'auth-access'],
  size: 'M',
  usesApi: true,
  openQuestions: '',
}

const facts = (over: Partial<ReadinessFacts> = {}, details: Partial<TicketDetails> = {}): ReadinessFacts => ({
  role: 'backend',
  details: { ...ready, ...details },
  linkedCriteria: 2,
  struckCriteria: 0,
  specApproved: true,
  designApproved: true,
  designStale: false,
  contractApproved: true,
  hasDependencyCycle: false,
  ...over,
})

describe('ticket codes', () => {
  test('format and parse AUTH-001-BE-2', () => {
    expect(formatTicketCode('AUTH', 1, 'BE', 2)).toBe('AUTH-001-BE-2')
    expect(parseTicketCode(' auth-001-mob-3 ')).toEqual({ prefix: 'AUTH', featureNumber: 1, roleCode: 'MOB', seq: 3 })
  })

  test('refuses anything else', () => {
    for (const value of ['AUTH-001', 'AUTH-001-XX-1', 'AUTH-1-BE-1', 'AUTH-001-BE-0', 'EXP-12']) expect(parseTicketCode(value)).toBeNull()
  })
})

describe('mergeDetails', () => {
  test('keeps what is left out and trims what is sent', () => {
    const merged = mergeDetails(ready, { goal: '  New goal  ', skills: ['a', 'a', ' b '] })
    expect(merged?.goal).toBe('New goal')
    expect(merged?.scope).toBe(ready.scope)
    expect(merged?.skills).toEqual(['a', 'b'])
  })

  test('a draft may be blank', () => {
    expect(mergeDetails(EMPTY_DETAILS, { goal: '' })).toEqual(EMPTY_DETAILS)
  })

  test('refuses a wrong type, a too long field, an incomplete check or an unknown size', () => {
    expect(mergeDetails(ready, { goal: 7 })).toBeNull()
    expect(mergeDetails(ready, { repo: 'x'.repeat(101) })).toBeNull()
    expect(mergeDetails(ready, { ticketAcs: [{ given: 'x', when: 'y', then: [] }] })).toBeNull()
    expect(mergeDetails(ready, { requiredTests: [{ case: 'x' }] })).toBeNull()
    expect(mergeDetails(ready, { size: 'XL' })).toBeNull()
  })
})

describe('readinessMisses', () => {
  test('a complete ticket is Ready', () => {
    expect(readinessMisses(facts())).toEqual([])
  })

  test('an empty draft fails every item it can, by number', () => {
    const misses = readinessMisses(facts({ role: null, linkedCriteria: 0, specApproved: false }, EMPTY_DETAILS))
    expect(misses.map((miss) => miss.item)).toEqual([1, 2, 3, 5, 6, 7, 8])
    expect(misses[0].reason).toBe('role, goal, scope, outOfScope, repo missing')
  })

  test('item 2: a struck parent criterion, or no ticket checks', () => {
    expect(readinessMisses(facts({ struckCriteria: 1 }))).toEqual([{ item: 2, reason: '1 linked criterion struck' }])
    expect(readinessMisses(facts({}, { ticketAcs: [] }))).toEqual([{ item: 2, reason: 'no ticket checks' }])
  })

  test('item 3: a stale design, and a contract only when the ticket uses an API', () => {
    expect(readinessMisses(facts({ designStale: true }))[0]).toEqual({ item: 3, reason: 'design built on an old spec' })
    expect(readinessMisses(facts({ contractApproved: false }))[0]).toEqual({ item: 3, reason: 'contract not approved' })
    expect(readinessMisses(facts({ contractApproved: false }, { usesApi: false }))).toEqual([])
  })

  test('items 4, 7, 8 and 9', () => {
    expect(readinessMisses(facts({ hasDependencyCycle: true }))[0].item).toBe(4)
    expect(readinessMisses(facts({}, { requiredTests: [{ case: 'happy', unhappy: false }] }))).toEqual([{ item: 7, reason: 'no unhappy path' }])
    expect(readinessMisses(facts({}, { size: 'L' }))).toEqual([{ item: 8, reason: 'size L, split the ticket' }])
    expect(readinessMisses(facts({}, { openQuestions: 'Token or cookie?' }))[0].item).toBe(9)
  })
})
