import {
  type Criterion,
  EPIC_DOCUMENT_KINDS,
  type EpicDocument,
  type EpicDocumentKind,
  type EpicTicket,
  type MemberLoad,
} from '@/features/projects/models/epic.model'
import type { ProjectMember } from '@/features/projects/models/project.model'

// CLOUD-001: the pure parts of the epic screens. The order of the standard is Spec → Design → Contract → Tickets.

export type StageId = EpicDocumentKind | 'tickets'
export type StageState = 'approved' | 'review' | 'stale' | 'missing'
export interface Stage {
  id: StageId
  state: StageState
  current: boolean
  // For the tickets stage: how many are Ready out of all.
  ready?: number
  total?: number
}

export function documentOf(documents: readonly EpicDocument[], kind: EpicDocumentKind): EpicDocument | undefined {
  return documents.find((document) => document.kind === kind)
}

export function documentState(document: EpicDocument | undefined): StageState {
  if (!document) return 'missing'
  if (document.stale) return 'stale'
  return document.status === 'approved' ? 'approved' : 'review'
}

// The stepper of the epic. The current stage is the first one that is not approved.
export function epicStages(documents: readonly EpicDocument[], tickets: readonly EpicTicket[]): Stage[] {
  const ready = tickets.filter((ticket) => ticket.readiness.ready).length
  const ticketState: StageState = tickets.length === 0 ? 'missing' : ready === tickets.length ? 'approved' : 'review'
  const stages: Array<Omit<Stage, 'current'>> = [
    ...EPIC_DOCUMENT_KINDS.map((kind) => ({ id: kind, state: documentState(documentOf(documents, kind)) })),
    { id: 'tickets' as const, state: ticketState, ready, total: tickets.length },
  ]
  const current = stages.findIndex((stage) => stage.state !== 'approved')
  return stages.map((stage, index) => ({ ...stage, current: index === current }))
}

// The flows the criteria belong to, in the order they first appear.
export function criteriaFlows(criteria: readonly Criterion[]): string[] {
  return [...new Set(criteria.map((criterion) => criterion.flow).filter((flow) => flow.trim() !== ''))]
}

export function filterCriteria(criteria: readonly Criterion[], flow: string | null): Criterion[] {
  return flow === null ? [...criteria] : criteria.filter((criterion) => criterion.flow === flow)
}

// How far the active criteria are carried: into the design, into a ticket, into a test case.
export function coverageSummary(criteria: readonly Criterion[]) {
  const active = criteria.filter((criterion) => criterion.status === 'active')
  return {
    active: active.length,
    struck: criteria.length - active.length,
    inDesign: active.filter((criterion) => criterion.coverage.inDesign).length,
    inTask: active.filter((criterion) => criterion.coverage.inTask).length,
    hasTestCase: active.filter((criterion) => criterion.coverage.hasTestCase).length,
  }
}

// The design's AC × repo matrix: one row per active criterion, one column per repo the design maps to.
export function designMatrix(criteria: readonly Criterion[]) {
  const active = criteria.filter((criterion) => criterion.status === 'active')
  const repos = [...new Set(active.flatMap((criterion) => criterion.designMapping.map((entry) => entry.repo)))]
  return {
    repos,
    rows: active.map((criterion) => ({
      id: criterion.id,
      code: criterion.code,
      title: criterion.title,
      cells: repos.map((repo) => criterion.designMapping.filter((entry) => entry.repo === repo)),
    })),
  }
}

// The tickets in waves: a wave holds what can start once the waves before it are done. A dependency on work
// outside the epic does not hold a ticket back here. Tickets caught in a loop are returned apart.
export function dependencyWaves(tickets: readonly EpicTicket[]): { waves: EpicTicket[][]; looped: EpicTicket[] } {
  const ids = new Set(tickets.map((ticket) => ticket.issue.id))
  const placed = new Set<string>()
  const waves: EpicTicket[][] = []
  let left = [...tickets]
  while (left.length > 0) {
    const wave = left.filter((ticket) => ticket.dependsOn.every((id) => !ids.has(id) || placed.has(id)))
    if (wave.length === 0) break
    for (const ticket of wave) placed.add(ticket.issue.id)
    waves.push(wave)
    left = left.filter((ticket) => !placed.has(ticket.issue.id))
  }
  return { waves, looped: left }
}

export interface ProposalRow {
  ticket: EpicTicket
  // The members who hold the ticket's role.
  candidates: ProjectMember[]
  proposedId: string | null
}

export interface LoadRow {
  member: ProjectMember
  before: number
  after: number
}

const rolesOf = (member: ProjectMember) => member.disciplines ?? (member.discipline ? [member.discipline] : [])

// The assignment proposal, as the assign-tickets skill makes it: every Ready ticket without an assignee, earliest wave
// first, goes to the member of the ticket's role who carries the fewest points so far. The tech lead confirms or changes it.
export function proposeAssignment(waves: readonly EpicTicket[][], members: readonly ProjectMember[], load: readonly MemberLoad[]) {
  const points = new Map(members.map((member) => [member.id, load.find((row) => row.userId === member.id)?.points ?? 0]))
  const before = new Map(points)
  const rows: ProposalRow[] = []
  for (const ticket of waves.flat()) {
    if (!ticket.readiness.ready || ticket.issue.assigneeId) continue
    const candidates = members.filter((member) => ticket.issue.role !== null && rolesOf(member).includes(ticket.issue.role))
    const lightest = [...candidates].sort((a, b) => (points.get(a.id) ?? 0) - (points.get(b.id) ?? 0) || a.email.localeCompare(b.email))[0]
    if (lightest) points.set(lightest.id, (points.get(lightest.id) ?? 0) + (ticket.issue.points ?? 0))
    rows.push({ ticket, candidates, proposedId: lightest?.id ?? null })
  }
  return { rows, before }
}

// The load of each member who holds a ticket role, before and after the chosen assignees.
export function loadAfter(
  members: readonly ProjectMember[],
  before: ReadonlyMap<string, number>,
  rows: ReadonlyArray<{ ticket: EpicTicket; assigneeId: string | null }>,
): LoadRow[] {
  return members
    .filter((member) => rows.some((row) => row.assigneeId === member.id) || (before.get(member.id) ?? 0) > 0)
    .map((member) => ({
      member,
      before: before.get(member.id) ?? 0,
      after:
        (before.get(member.id) ?? 0) +
        rows.filter((row) => row.assigneeId === member.id).reduce((sum, row) => sum + (row.ticket.issue.points ?? 0), 0),
    }))
}
