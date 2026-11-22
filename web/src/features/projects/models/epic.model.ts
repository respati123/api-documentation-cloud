import * as z from 'zod/mini'
import { issueSchema, readinessSchema, ticketDetailsSchema } from '@/features/projects/models/issue.model'

// CLOUD-001: what lives inside an epic. The spec, design and contract, the acceptance criteria, and the tickets.
// The sections must match models/epic-document.ts on the server, in the same order.

export const EPIC_DOCUMENT_KINDS = ['spec', 'design', 'contract'] as const
export type EpicDocumentKind = (typeof EPIC_DOCUMENT_KINDS)[number]

export const EPIC_DOCUMENT_SECTIONS: Record<EpicDocumentKind, readonly string[]> = {
  spec: [
    'problem',
    'goals',
    'users',
    'decisions',
    'businessRules',
    'flows',
    'nonFunctional',
    'impact',
    'dependencies',
    'outOfScope',
    'openQuestions',
  ],
  design: [
    'summary',
    'currentState',
    'architecture',
    'options',
    'dataModel',
    'apiSurface',
    'perRepo',
    'security',
    'rollout',
    'observability',
    'risks',
    'openQuestions',
  ],
  contract: ['summary', 'endpoints', 'errors', 'breakingChanges'],
}

// The PM approves the spec, the tech lead the design and the contract.
export const EPIC_DOCUMENT_OWNER: Record<EpicDocumentKind, 'pm' | 'tech_lead'> = { spec: 'pm', design: 'tech_lead', contract: 'tech_lead' }

export const epicDocumentSchema = z.object({
  id: z.string(),
  epicId: z.string(),
  kind: z.enum(EPIC_DOCUMENT_KINDS),
  title: z.string(),
  status: z.string(),
  version: z.number(),
  sections: z.record(z.string(), z.string()),
  stale: z.boolean(),
  approvedAt: z.nullable(z.string()),
  updatedAt: z.string(),
})

export const epicDocumentsSchema = z.object({
  documents: z.array(epicDocumentSchema),
  blocked: z.object({ spec: z.nullable(z.string()), design: z.nullable(z.string()), contract: z.nullable(z.string()) }),
})

const mappingSchema = z.object({ repo: z.string(), component: z.string(), testLevel: z.string() })

// A data object with a "then" key looks like a promise to await, so the list is kept as "outcomes".
export const criterionSchema = z.pipe(
  z.looseObject({
    id: z.string(),
    number: z.number(),
    code: z.string(),
    flow: z.string(),
    title: z.string(),
    given: z.string(),
    when: z.string(),
    status: z.enum(['active', 'struck']),
    struckReason: z.nullable(z.string()),
    designMapping: z.array(mappingSchema),
    coverage: z.object({ inDesign: z.boolean(), inTask: z.boolean(), hasTestCase: z.boolean() }),
    issues: z.array(z.object({ id: z.string(), key: z.string(), type: z.string(), title: z.string(), flagged: z.boolean() })),
    testCases: z.array(z.object({ id: z.string(), code: z.string(), title: z.string(), flagged: z.boolean() })),
  }),
  z.transform((raw) => ({
    id: raw.id,
    number: raw.number,
    code: raw.code,
    flow: raw.flow,
    title: raw.title,
    given: raw.given,
    when: raw.when,
    outcomes: z.parse(z.array(z.string()), raw.then),
    status: raw.status,
    struckReason: raw.struckReason,
    designMapping: raw.designMapping,
    coverage: raw.coverage,
    issues: raw.issues,
    testCases: raw.testCases,
  })),
)

export const epicCriteriaSchema = z.object({
  criteria: z.array(criterionSchema),
  flagged: z.object({ issues: z.array(z.string()), testCases: z.array(z.string()) }),
})

export const epicTicketSchema = z.object({
  issue: issueSchema,
  details: ticketDetailsSchema,
  readiness: readinessSchema,
  dependsOn: z.array(z.string()),
})

export const epicTicketsSchema = z.object({
  tickets: z.array(epicTicketSchema),
  load: z.array(z.object({ userId: z.string(), points: z.number(), count: z.number() })),
})

export type EpicDocument = z.infer<typeof epicDocumentSchema>
export type EpicDocuments = z.infer<typeof epicDocumentsSchema>
export type Criterion = z.output<typeof criterionSchema>
export type EpicTicket = z.output<typeof epicTicketSchema>
export type EpicTickets = z.output<typeof epicTicketsSchema>
export type MemberLoad = EpicTickets['load'][number]
