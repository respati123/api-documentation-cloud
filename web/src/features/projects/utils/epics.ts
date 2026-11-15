import type { PlanningItem, PlanningStatus, PlanningTask } from '@/features/projects/models/planning.model'
import { STORY_STAGES, type StoryStage, storyStage } from '@/features/projects/models/story.model'

// The epic list filter and the board columns use the same groups, so a filter always matches one column.
export const EPIC_GROUPS = [
  { id: 'planning', statuses: ['draft', 'refinement'] },
  { id: 'ready', statuses: ['ready'] },
  { id: 'active', statuses: ['in_progress', 'review'] },
  { id: 'done', statuses: ['done'] },
] as const satisfies ReadonlyArray<{ id: string; statuses: readonly PlanningStatus[] }>

export type EpicGroup = (typeof EPIC_GROUPS)[number]['id']
export type EpicFilter = EpicGroup | 'all'

export function groupOf(status: PlanningStatus): EpicGroup {
  return EPIC_GROUPS.find((group) => (group.statuses as readonly PlanningStatus[]).includes(status))?.id ?? 'planning'
}

export type StageCounts = Record<StoryStage, number>

export interface EpicStoryRow {
  id: string
  code: string
  title: string
  stage: StoryStage
  tasksDone: number
  tasksTotal: number
}

export interface EpicRow {
  id: string
  code: string
  title: string
  summary: string
  overview: Array<{ label: string | null; text: string }>
  sections: EpicSection[]
  status: PlanningStatus
  group: EpicGroup
  published: boolean
  outdated: boolean
  source: string | null
  stories: EpicStoryRow[]
  storiesDone: number
  percent: number
  // Stories that cannot be built yet: still a draft or waiting for design approval.
  awaitingDesign: number
  stageCounts: StageCounts
  team: Array<{ id: string; name: string; discipline: string | null }>
}

interface EpicInput {
  items: PlanningItem[]
  tasks: PlanningTask[]
  members: Array<{ id: string; email: string; discipline?: string | null }>
  codes: Record<string, string>
  sourceTitle: (documentId: string | null) => string | null
}

export function countStages(stages: StoryStage[]): StageCounts {
  const counts = Object.fromEntries(STORY_STAGES.map((stage) => [stage, 0])) as StageCounts
  for (const stage of stages) counts[stage] += 1
  return counts
}

export function buildEpicRows({ items, tasks, members, codes, sourceTitle }: EpicInput): EpicRow[] {
  return items
    .filter((item) => item.kind === 'epic')
    .map((epic) => {
      const stories = items.filter((item) => item.parentId === epic.id)
      const storyRows = stories.map((story) => {
        const own = tasks.filter((row) => row.storyId === story.id)
        return {
          id: story.id,
          code: codes[story.id] ?? '',
          title: story.title,
          stage: story.stage ?? storyStage(story.status),
          tasksDone: own.filter((row) => row.status === 'done').length,
          tasksTotal: own.length,
        }
      })
      const storyIds = new Set(stories.map((story) => story.id))
      const teamIds = [
        ...epic.participantIds,
        ...stories.flatMap((story) => story.participantIds),
        ...tasks.filter((row) => storyIds.has(row.storyId)).flatMap((row) => (row.assigneeId ? [row.assigneeId] : [])),
      ]
      const team = [...new Set(teamIds)].flatMap((id) => {
        const member = members.find((row) => row.id === id)
        return member ? [{ id, name: member.email.split('@')[0] ?? member.email, discipline: member.discipline ?? null }] : []
      })
      const storiesDone = storyRows.filter((story) => story.stage === 'done').length
      const title = sourceTitle(epic.sourceDocumentId)
      return {
        id: epic.id,
        code: codes[epic.id] ?? '',
        title: epic.title,
        summary: epic.description.split('\n')[0]?.trim() ?? '',
        overview: describeLines(epic.description),
        sections: epicSections(describeLines(epic.description)),
        status: epic.status,
        group: groupOf(epic.status),
        published: Boolean(epic.publishedAt),
        outdated: Boolean(epic.sourceOutdated),
        source: title ? [title, epic.sourceSection].filter(Boolean).join(' · ') : null,
        stories: storyRows,
        storiesDone,
        percent: storyRows.length ? Math.round((storiesDone / storyRows.length) * 100) : 0,
        awaitingDesign: storyRows.filter((story) => story.stage === 'draft' || story.stage === 'design').length,
        stageCounts: countStages(storyRows.map((story) => story.stage)),
        team,
      }
    })
}

export function epicsSummary(rows: EpicRow[]) {
  const stories = rows.flatMap((row) => row.stories)
  return {
    epics: rows.length,
    active: rows.filter((row) => row.group === 'active').length,
    stories: stories.length,
    storiesDone: stories.filter((story) => story.stage === 'done').length,
    awaitingDesign: stories.filter((story) => story.stage === 'design').length,
    stageCounts: countStages(stories.map((story) => story.stage)),
  }
}

export function filterEpics(rows: EpicRow[], filter: EpicFilter, query: string): Array<EpicRow & { matchedStory: boolean }> {
  const needle = query.trim().toLowerCase()
  const has = (text: string) => text.toLowerCase().includes(needle)
  return rows.flatMap((row) => {
    if (filter !== 'all' && row.group !== filter) return []
    if (!needle) return [{ ...row, matchedStory: false }]
    const epicMatch = has(row.title) || has(row.code)
    const matchedStory = row.stories.some((story) => has(story.title) || has(story.code))
    return epicMatch || matchedStory ? [{ ...row, matchedStory: matchedStory && !epicMatch }] : []
  })
}

// A short "Label: text" line, like "Tujuan: ..." in an epic written from a PRD, is shown as a labelled entry.
// A label alone on its line ("Kriteria selesai:") takes the lines under it. Lines after a label, up to the next
// label or an empty line, belong to it. A list line ("- R6: ...") never starts a new label.
const LABEL_LINE = /^([^:\n/\-•*\s][^:\n/]{1,31}):(?:\s+(.+))?$/

function labelOf(line: string): { label: string; text: string } | null {
  const match = LABEL_LINE.exec(line)
  const label = match?.[1]?.trim()
  if (!match || !label || label.split(' ').length > 4) return null
  return { label, text: match[2]?.trim() ?? '' }
}

export function describeLines(text: string): Array<{ label: string | null; text: string }> {
  const entries: Array<{ label: string | null; text: string }> = []
  let open = false
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      open = entries.at(-1)?.text === ''
      continue
    }
    const labelled = labelOf(line)
    const last = entries.at(-1)
    if (labelled) entries.push(labelled)
    else if (open && last) last.text = last.text ? `${last.text}\n${line}` : line
    else entries.push({ label: null, text: line })
    open = true
  }
  return entries.filter((entry) => entry.text !== '')
}

export type EpicListKind = 'outOfScope' | 'criteria' | 'risks'
type ListSection<K extends string> = { kind: K; label: string; items: string[] }
export type EpicSection =
  | { kind: 'goal'; label: string; text: string }
  | { kind: 'text'; label: string | null; text: string }
  | ListSection<'scope'>
  | ListSection<'outOfScope'>
  | ListSection<'criteria'>
  | ListSection<'risks'>
  | { kind: 'metrics'; label: string; items: Array<{ name: string; from: string; to: string }> }

const GOAL_LABEL = /^(tujuan|goal|objective)\b/i
const OUT_OF_SCOPE_LABEL = /^(di luar cakupan|tidak termasuk|out of scope|non-goals?)\b/i
const SCOPE_LABEL = /^(mencakup|cakupan|scope|covers)\b/i
const METRIC_LABEL = /^(ukuran sukses|metrik|success|kpi)/i
const CRITERIA_LABEL = /^(kriteria selesai|selesai jika|acceptance criteria|done when|definition of done)\b/i
const RISK_LABEL = /^(risiko|dependensi|risks?|dependencies)\b/i
// "name (before → target)", with -> accepted for the arrow.
const METRIC = /([^,(\n]+?)\s*\(\s*([^()]+?)\s*(?:→|->)\s*([^()]+?)\s*\)/g

// "- a" lines become one item each. A single line is split on semicolons, or on commas when asked.
function listItems(text: string, commas: boolean): string[] {
  const lines = text.split('\n').map((line) => line.replace(/^[-•*]\s*/, '').trim())
  const items = lines.length > 1 ? lines : (lines[0] ?? '').replace(/\.$/, '').split(commas ? /[,;]\s*/ : /;\s*/)
  return items.map((item) => item.trim()).filter(Boolean)
}

// Epics drafted from a PRD follow a template: goal, scope, out of scope, metrics as "before → target", done criteria,
// and risks. A line that does not fit its pattern is kept as plain text, so nothing is lost.
export function epicSections(overview: Array<{ label: string | null; text: string }>): EpicSection[] {
  return overview.map(toSection).filter((section) => !('items' in section) || section.items.length > 0)
}

function toSection(entry: { label: string | null; text: string }): EpicSection {
  const { label, text } = entry
  if (!label) return { kind: 'text', label, text }
  if (GOAL_LABEL.test(label)) return { kind: 'goal', label, text }
  if (OUT_OF_SCOPE_LABEL.test(label)) return { kind: 'outOfScope', label, items: listItems(text, true) }
  if (SCOPE_LABEL.test(label)) {
    const items = listItems(text, true)
    if (items.length > 0 && items.every((item) => item.length <= 12)) return { kind: 'scope', label, items }
  }
  if (METRIC_LABEL.test(label)) {
    const items = [...text.matchAll(METRIC)].map((match) => ({
      name: (match[1] ?? '').replace(/^[-•*]\s*/, '').trim(),
      from: (match[2] ?? '').trim(),
      to: (match[3] ?? '').trim(),
    }))
    if (items.length > 0) return { kind: 'metrics', label, items }
  }
  if (CRITERIA_LABEL.test(label)) return { kind: 'criteria', label, items: listItems(text, false) }
  if (RISK_LABEL.test(label)) return { kind: 'risks', label, items: listItems(text, false) }
  return { kind: 'text', label, text }
}
