import { describe, expect, test } from 'vitest'
import type { PlanningItem, PlanningTask } from '@/features/projects/models/planning.model'
import {
  buildEpicRows,
  describeLines,
  EPIC_GROUPS,
  type EpicRow,
  epicSections,
  epicsSummary,
  filterEpics,
  groupOf,
} from '@/features/projects/utils/epics'

function item(overrides: Partial<PlanningItem>): PlanningItem {
  return {
    id: 'i',
    kind: 'story',
    parentId: null,
    title: 'Item',
    description: '',
    acceptanceCriteria: '',
    status: 'draft',
    publishedAt: null,
    sourceDocumentId: 'd',
    sourceVersion: 1,
    sourceOutdated: false,
    sourceSection: null,
    participantIds: [],
    ...overrides,
  }
}

function task(overrides: Partial<PlanningTask>): PlanningTask {
  return {
    id: 't',
    storyId: 's1',
    title: 'Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    publishedAt: null,
    ...overrides,
  }
}

const items = [
  item({
    id: 'e1',
    kind: 'epic',
    title: 'Onboarding merchant',
    status: 'in_progress',
    description: 'Daftar sendiri.\nBaris kedua.',
    participantIds: ['u1'],
    sourceSection: '2. Alur',
  }),
  item({ id: 's1', parentId: 'e1', title: 'Form pendaftaran', stage: 'done', status: 'done', participantIds: ['u2'] }),
  item({ id: 's2', parentId: 'e1', title: 'Unggah dokumen KYB', stage: 'design', status: 'refinement' }),
  item({ id: 'e2', kind: 'epic', title: 'Refund', status: 'ready', sourceOutdated: true }),
]
const tasks = [
  task({ id: 't1', storyId: 's1', status: 'done', assigneeId: 'u3' }),
  task({ id: 't2', storyId: 's1', status: 'in_progress', assigneeId: 'u2' }),
]
const members = [
  { id: 'u1', email: 'rani@contoh.test' },
  { id: 'u2', email: 'dewi@contoh.test' },
  { id: 'u3', email: 'fajar@contoh.test' },
]
const codes = { e1: 'E-1', s1: 'S-1.1', s2: 'S-1.2', e2: 'E-2' }
const rows = buildEpicRows({ items, tasks, members, codes, sourceTitle: () => 'PRD Onboarding' })

describe('buildEpicRows', () => {
  test('counts stories, tasks, and stages per epic', () => {
    const epic = rows[0] as EpicRow
    expect(epic).toMatchObject({ id: 'e1', code: 'E-1', storiesDone: 1, percent: 50, awaitingDesign: 1, summary: 'Daftar sendiri.' })
    expect(epic.stageCounts).toMatchObject({ done: 1, design: 1, draft: 0 })
    expect(epic.stories[0]).toMatchObject({ id: 's1', tasksDone: 1, tasksTotal: 2 })
    expect(epic.stories[1]).toMatchObject({ id: 's2', tasksDone: 0, tasksTotal: 0 })
    expect(epic.source).toBe('PRD Onboarding · 2. Alur')
  })

  test('the team joins epic and story participants with task assignees, once each', () => {
    expect((rows[0] as EpicRow).team.map((person) => person.name)).toEqual(['rani', 'dewi', 'fajar'])
  })

  test('an epic without stories is at zero percent', () => {
    expect(rows[1]).toMatchObject({ id: 'e2', percent: 0, storiesDone: 0, outdated: true })
  })
})

describe('epicsSummary', () => {
  test('sums the epics and stories', () => {
    expect(epicsSummary(rows)).toMatchObject({ epics: 2, active: 1, stories: 2, storiesDone: 1, awaitingDesign: 1 })
  })
})

describe('filterEpics', () => {
  test('filters by group', () => {
    expect(filterEpics(rows, 'ready', '').map((row) => row.id)).toEqual(['e2'])
    expect(filterEpics(rows, 'planning', '')).toEqual([])
    expect(filterEpics(rows, 'active', '').map((row) => row.id)).toEqual(['e1'])
  })

  test('a search matches an epic by a story title and says which stories matched', () => {
    const found = filterEpics(rows, 'all', 'kyb')
    expect(found.map((row) => row.id)).toEqual(['e1'])
    expect(found[0]?.matchedStory).toBe(true)
  })

  test('a search on an epic title does not count as a story match', () => {
    expect(filterEpics(rows, 'all', 'refund')[0]?.matchedStory).toBe(false)
  })
})

describe('groupOf', () => {
  test('every status belongs to one board column', () => {
    const statuses = EPIC_GROUPS.flatMap((group) => group.statuses)
    expect(new Set(statuses).size).toBe(statuses.length)
    expect(groupOf('review')).toBe('active')
    expect(groupOf('refinement')).toBe('planning')
  })
})

describe('describeLines', () => {
  test('a "Label: text" line becomes a labelled entry and other lines stay as text', () => {
    expect(describeLines('Tujuan: pasien memesan sendiri\ntanpa chat ke admin.\nMencakup: R1, R2\n\nCatatan bebas')).toEqual([
      { label: 'Tujuan', text: 'pasien memesan sendiri\ntanpa chat ke admin.' },
      { label: 'Mencakup', text: 'R1, R2' },
      { label: null, text: 'Catatan bebas' },
    ])
  })

  test('a URL or a long sentence with a colon is not read as a label', () => {
    expect(describeLines('Lihat https://contoh.test/a untuk detail')).toEqual([
      { label: null, text: 'Lihat https://contoh.test/a untuk detail' },
    ])
    expect(describeLines('Pasien yang sudah login lalu memilih cabang: lanjut')[0]?.label).toBeNull()
  })

  test('an empty description has no entries', () => {
    expect(describeLines('  \n ')).toEqual([])
  })
})

describe('team disciplines', () => {
  test('the team carries each member discipline when it is known', () => {
    const withRoles = buildEpicRows({
      items,
      tasks,
      members: [{ id: 'u1', email: 'rani@contoh.test', discipline: 'pm' }],
      codes,
      sourceTitle: () => null,
    })
    expect(withRoles[0]?.team).toEqual([{ id: 'u1', name: 'rani', discipline: 'pm' }])
  })
})

describe('epicSections', () => {
  const overview = describeLines(
    [
      'Tujuan: pasien memesan janji temu sendiri dari HP.',
      'Mencakup: R1, R2, R3, R7.',
      'Ukuran sukses yang digerakkan: porsi janji temu online (0% → ≥ 60%), pesan WhatsApp per admin (±120 → ≤ 40), jadwal bentrok (11% -> 0%).',
      'Catatan: dikerjakan setelah tahap 1.',
    ].join('\n'),
  )

  test('reads the goal, the requirement list, and before → target metrics', () => {
    expect(epicSections(overview)).toEqual([
      { kind: 'goal', label: 'Tujuan', text: 'pasien memesan janji temu sendiri dari HP.' },
      { kind: 'scope', label: 'Mencakup', items: ['R1', 'R2', 'R3', 'R7'] },
      {
        kind: 'metrics',
        label: 'Ukuran sukses yang digerakkan',
        items: [
          { name: 'porsi janji temu online', from: '0%', to: '≥ 60%' },
          { name: 'pesan WhatsApp per admin', from: '±120', to: '≤ 40' },
          { name: 'jadwal bentrok', from: '11%', to: '0%' },
        ],
      },
      { kind: 'text', label: 'Catatan', text: 'dikerjakan setelah tahap 1.' },
    ])
  })

  test('a scope or metric line in another shape stays as text', () => {
    const loose = describeLines('Mencakup: semua alur pembayaran yang dipakai merchant kecil\nUkuran sukses: lebih sedikit keluhan')
    expect(epicSections(loose).map((section) => section.kind)).toEqual(['text', 'text'])
  })

  test('English labels are read too', () => {
    const english = describeLines('Goal: patients book on their own.\nScope: R1, R2')
    expect(epicSections(english).map((section) => section.kind)).toEqual(['goal', 'scope'])
  })
})

describe('epic template sections', () => {
  const overview = describeLines(
    [
      'Tujuan: pasien memesan sendiri.',
      'Di luar cakupan: R6, pembayaran online',
      'Kriteria selesai:',
      '- Pasien bisa memesan tanpa admin',
      '- Halaman terbuka di bawah 2 detik',
      'Risiko & dependensi:',
      '- Jadwal dokter masih di spreadsheet',
      'Catatan:',
    ].join('\n'),
  )

  test('a label on its own line takes the "- " lines under it as a list, and an empty label is dropped', () => {
    expect(epicSections(overview)).toEqual([
      { kind: 'goal', label: 'Tujuan', text: 'pasien memesan sendiri.' },
      { kind: 'outOfScope', label: 'Di luar cakupan', items: ['R6', 'pembayaran online'] },
      { kind: 'criteria', label: 'Kriteria selesai', items: ['Pasien bisa memesan tanpa admin', 'Halaman terbuka di bawah 2 detik'] },
      { kind: 'risks', label: 'Risiko & dependensi', items: ['Jadwal dokter masih di spreadsheet'] },
    ])
  })

  test('a "- R6: text" list line stays inside its list instead of starting a new label', () => {
    const lines = describeLines('Di luar cakupan:\n- R6: pembayaran online\n- R8: rekam medis')
    expect(epicSections(lines)).toEqual([
      { kind: 'outOfScope', label: 'Di luar cakupan', items: ['R6: pembayaran online', 'R8: rekam medis'] },
    ])
  })

  test('English labels for the new sections', () => {
    const english = describeLines('Out of scope: payments\nDone when: patients book alone\nRisks & dependencies: clinic data')
    expect(epicSections(english).map((section) => section.kind)).toEqual(['outOfScope', 'criteria', 'risks'])
  })
})

describe('untouched template', () => {
  test('an epic left as the empty template shows no sections', () => {
    const template = 'Tujuan: \nMencakup: \nDi luar cakupan: \nUkuran sukses: \nKriteria selesai:\n- \nRisiko & dependensi:\n- '
    expect(epicSections(describeLines(template))).toEqual([])
  })

  test('a template with only the goal filled shows only the goal', () => {
    const filled = 'Tujuan: pasien memesan sendiri.\nMencakup: \nKriteria selesai:\n- '
    expect(epicSections(describeLines(filled))).toEqual([{ kind: 'goal', label: 'Tujuan', text: 'pasien memesan sendiri.' }])
  })
})
