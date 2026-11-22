import { describe, expect, test } from 'bun:test'
import { acceptanceFields, acCode, coverageOf, designMappingOf, missingParts } from '@/models/acceptance-criterion'

const good = {
  flow: ' Sign in ',
  title: 'Account locked after repeated failures',
  given: 'rina@contoh.id has failed 9 times in the last 15 minutes',
  when: 'the user enters a wrong password for the 10th time',
  then: [' "Too many attempts. Try again at 14.35" is shown ', 'the correct password is refused for 5 minutes'],
}

describe('missingParts', () => {
  test('a complete criterion misses nothing', () => {
    expect(missingParts(good)).toEqual([])
  })

  test('blank or absent parts are named, and Then needs at least one non-blank outcome', () => {
    expect(missingParts({ ...good, given: '  ', when: undefined })).toEqual(['given', 'when'])
    expect(missingParts({ ...good, then: [] })).toEqual(['then'])
    expect(missingParts({ ...good, then: ['ok', ' '] })).toEqual(['then'])
    expect(missingParts({})).toEqual(['title', 'given', 'when', 'then'])
  })
})

describe('acceptanceFields', () => {
  test('trims every part', () => {
    expect(acceptanceFields(good)).toEqual({
      flow: 'Sign in',
      title: good.title,
      given: good.given,
      when: good.when,
      then: ['"Too many attempts. Try again at 14.35" is shown', 'the correct password is refused for 5 minutes'],
    })
  })

  test('the flow is optional', () => {
    expect(acceptanceFields({ ...good, flow: undefined })?.flow).toBe('')
  })

  test('a part over its limit, or more than ten outcomes, is refused', () => {
    expect(acceptanceFields({ ...good, title: 'x'.repeat(181) })).toBeNull()
    expect(acceptanceFields({ ...good, then: Array.from({ length: 11 }, () => 'x') })).toBeNull()
    expect(acceptanceFields({ ...good, flow: 7 })).toBeNull()
  })
})

describe('designMappingOf', () => {
  test('reads repo, component and test level', () => {
    expect(designMappingOf([{ repo: 'backend', component: ' 423 ACCOUNT_LOCKED ', testLevel: 'integration' }])).toEqual([
      { repo: 'backend', component: '423 ACCOUNT_LOCKED', testLevel: 'integration' },
    ])
    expect(designMappingOf([])).toEqual([])
  })

  test('refuses an unknown repo or level, a blank component, or anything not a list', () => {
    expect(designMappingOf([{ repo: 'ios', component: 'x', testLevel: 'unit' }])).toBeNull()
    expect(designMappingOf([{ repo: 'web', component: 'x', testLevel: 'smoke' }])).toBeNull()
    expect(designMappingOf([{ repo: 'web', component: ' ', testLevel: 'unit' }])).toBeNull()
    expect(designMappingOf('backend')).toBeNull()
  })
})

describe('acCode and coverageOf', () => {
  test('the code is AC and the number', () => {
    expect(acCode(7)).toBe('AC7')
  })

  test('coverage says whether the design, a task and a test case reach the criterion', () => {
    expect(coverageOf([], 0, 0)).toEqual({ inDesign: false, inTask: false, hasTestCase: false })
    expect(coverageOf([{}], 2, 1)).toEqual({ inDesign: true, inTask: true, hasTestCase: true })
  })
})
