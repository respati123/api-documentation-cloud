// The documents an epic holds, in the order the team standard makes them: the PM's spec, then the tech lead's design,
// then the tech lead's contract. Each one waits for the one before it to be approved.
export const EPIC_DOCUMENT_KINDS = ['spec', 'design', 'contract'] as const
export type EpicDocumentKind = (typeof EPIC_DOCUMENT_KINDS)[number]

export function isEpicDocumentKind(value: unknown): value is EpicDocumentKind {
  return (EPIC_DOCUMENT_KINDS as readonly unknown[]).includes(value)
}

// The sections of each document, from the team artifact standard. Every one must be filled in, "None" included.
// Acceptance criteria are records of their own, so the spec has no section for them.
export const EPIC_DOCUMENT_SECTIONS: Record<EpicDocumentKind, readonly string[]> = {
  spec: ['problem', 'goals', 'users', 'decisions', 'businessRules', 'flows', 'nonFunctional', 'impact', 'dependencies', 'outOfScope', 'openQuestions'],
  design: ['summary', 'currentState', 'architecture', 'options', 'dataModel', 'apiSurface', 'perRepo', 'security', 'rollout', 'observability', 'risks', 'openQuestions'],
  contract: ['summary', 'endpoints', 'errors', 'breakingChanges'],
}

// The document a kind is built from. The spec stands first.
export const EPIC_DOCUMENT_SOURCE: Record<EpicDocumentKind, EpicDocumentKind | null> = { spec: null, design: 'spec', contract: 'design' }

// The PM approves the spec. The tech lead approves the design and the contract.
export const EPIC_DOCUMENT_OWNER: Record<EpicDocumentKind, 'pm' | 'tech_lead'> = { spec: 'pm', design: 'tech_lead', contract: 'tech_lead' }

export const SECTION_MAX_LENGTH = 20_000

export type EpicDocumentSections = Record<string, string>

// The sections that are missing or blank, in the order of the standard. Unknown names are reported apart.
export function checkSections(kind: EpicDocumentKind, sections: Record<string, unknown>): { missing: string[]; unknown: string[] } {
  const expected = EPIC_DOCUMENT_SECTIONS[kind]
  const missing = expected.filter((name) => {
    const value = sections[name]
    return typeof value !== 'string' || value.trim() === ''
  })
  const unknown = Object.keys(sections).filter((name) => !expected.includes(name))
  return { missing, unknown }
}

// The sections as stored: trimmed, in the order of the standard.
export function normalizeSections(kind: EpicDocumentKind, sections: Record<string, unknown>): EpicDocumentSections {
  return Object.fromEntries(EPIC_DOCUMENT_SECTIONS[kind].map((name) => [name, String(sections[name]).trim()]))
}

export function parseSections(content: string): EpicDocumentSections {
  try {
    const parsed = JSON.parse(content) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as EpicDocumentSections) : {}
  } catch {
    return {}
  }
}

export interface DocumentState {
  status: string
  // True when the document it was built from has a newer version than the one it was built on.
  stale: boolean
}

// Why a kind cannot be drafted or approved yet, or null when it can. A design needs an approved spec that has not moved
// on since, and a contract needs the same of the design.
export function blockedBy(kind: EpicDocumentKind, live: Partial<Record<EpicDocumentKind, DocumentState>>): string | null {
  const sourceKind = EPIC_DOCUMENT_SOURCE[kind]
  if (sourceKind === null) return null
  const source = live[sourceKind]
  if (!source || source.status !== 'approved') return `${sourceKind}_approved`
  if (source.stale) return `${sourceKind}_current`
  return null
}
