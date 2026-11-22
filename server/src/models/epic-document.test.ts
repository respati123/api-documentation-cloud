import { describe, expect, test } from 'bun:test'
import { blockedBy, checkSections, EPIC_DOCUMENT_SECTIONS, normalizeSections, parseSections } from '@/models/epic-document'

const full = (kind: 'spec' | 'design' | 'contract') => Object.fromEntries(EPIC_DOCUMENT_SECTIONS[kind].map((name) => [name, `  ${name} text  `]))

describe('checkSections', () => {
  test('a document with every section filled in passes', () => {
    expect(checkSections('spec', full('spec'))).toEqual({ missing: [], unknown: [] })
  })

  test('missing and blank sections are named in the order of the standard', () => {
    const sections = { ...full('design'), options: '   ', summary: undefined }
    expect(checkSections('design', sections).missing).toEqual(['summary', 'options'])
  })

  test('a section the kind does not have is reported apart', () => {
    expect(checkSections('contract', { ...full('contract'), acceptanceCriteria: 'x' }).unknown).toEqual(['acceptanceCriteria'])
  })
})

describe('normalizeSections and parseSections', () => {
  test('sections are trimmed, kept in order, and read back the same', () => {
    const stored = normalizeSections('contract', { breakingChanges: ' None ', errors: 'e', endpoints: 'p', summary: 's' })
    expect(Object.keys(stored)).toEqual(['summary', 'endpoints', 'errors', 'breakingChanges'])
    expect(stored.breakingChanges).toBe('None')
    expect(parseSections(JSON.stringify(stored))).toEqual(stored)
  })

  test('content that is not a JSON object reads as no sections, such as an old Markdown document', () => {
    expect(parseSections('# PRD')).toEqual({})
    expect(parseSections('[1, 2]')).toEqual({})
  })
})

describe('blockedBy', () => {
  test('the spec is never blocked', () => {
    expect(blockedBy('spec', {})).toBeNull()
  })

  test('a design waits for an approved spec that has not moved on', () => {
    expect(blockedBy('design', {})).toBe('spec_approved')
    expect(blockedBy('design', { spec: { status: 'draft', stale: false } })).toBe('spec_approved')
    expect(blockedBy('design', { spec: { status: 'approved', stale: false } })).toBeNull()
  })

  test('a contract waits for an approved design that is still built on the current spec', () => {
    expect(blockedBy('contract', { design: { status: 'draft', stale: false } })).toBe('design_approved')
    expect(blockedBy('contract', { design: { status: 'approved', stale: true } })).toBe('design_current')
    expect(blockedBy('contract', { design: { status: 'approved', stale: false } })).toBeNull()
  })
})
