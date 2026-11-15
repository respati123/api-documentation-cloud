import '@/shared/i18n'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { countStages, type EpicRow } from '@/features/projects/utils/epics'
import { EpicDetailView } from '@/features/projects/views/epic-detail.view'

type Planning = ComponentProps<typeof EpicDetailView>['planning']

const epic: EpicRow = {
  id: 'e1',
  code: 'EP-1',
  title: 'Pemesanan janji temu online',
  summary: '',
  overview: [
    { label: 'Tujuan', text: 'Pasien memesan sendiri dari HP.' },
    { label: null, text: 'Catatan bebas.' },
  ],
  sections: [
    { kind: 'goal', label: 'Tujuan', text: 'Pasien memesan sendiri dari HP.' },
    { kind: 'scope', label: 'Mencakup', items: ['R1', 'R2'] },
    { kind: 'metrics', label: 'Ukuran sukses', items: [{ name: 'Jadwal bentrok', from: '11%', to: '0%' }] },
    { kind: 'outOfScope', label: 'Di luar cakupan', items: ['R6'] },
    { kind: 'criteria', label: 'Kriteria selesai', items: ['Pasien memesan tanpa admin'] },
    { kind: 'risks', label: 'Risiko & dependensi', items: ['Jadwal dokter di spreadsheet'] },
    { kind: 'text', label: null, text: 'Catatan bebas.' },
  ],
  status: 'draft',
  group: 'planning',
  published: false,
  outdated: false,
  source: null,
  stories: [
    { id: 's1', code: 'ST-1', title: 'Masuk dengan OTP', stage: 'design', tasksDone: 0, tasksTotal: 4 },
    { id: 's2', code: 'ST-2', title: 'Memesan slot', stage: 'draft', tasksDone: 0, tasksTotal: 4 },
  ],
  storiesDone: 0,
  percent: 0,
  awaitingDesign: 2,
  stageCounts: countStages(['design', 'draft']),
  team: [{ id: 'u1', name: 'rani', discipline: 'pm' }],
}

function planning(): Planning {
  const value = {
    go: vi.fn(),
    openItem: vi.fn(),
    openDocument: vi.fn(),
    activity: [],
    comments: { threads: [], status: 'ready' },
    epics: { rowOf: () => epic },
    itemDetail: {
      item: {
        id: 'e1',
        kind: 'epic',
        title: epic.title,
        status: 'draft',
        publishedAt: null,
        sourceOutdated: false,
        sourceSection: 'R2 Pasien bisa memilih cabang, poli, dokter, tanggal, dan jam.',
      },
      code: 'EP-1',
      source: { id: 'd1', title: 'PRD: Reservasi Online', version: 2 },
      progress: { tasksDone: 0, tasksTotal: 8 },
      error: null,
      canManage: true,
      canRebase: false,
      canPublish: false,
      canMoveNext: false,
      editing: false,
      isBusy: false,
      onEdit: vi.fn(),
    },
  }
  return value as unknown as Planning
}

vi.mock('@/features/projects/views/planning-comments.view', () => ({ PlanningCommentsView: () => null }))

afterEach(() => {
  cleanup()
})

describe('EpicDetailView', () => {
  test('the description shows its labelled lines, and the PRD section is quoted in the main column', () => {
    render(<EpicDetailView planning={planning()} onNewStory={vi.fn()} />)

    const overview = screen.getByTestId('projects-epic-overview')
    expect(within(overview).getByText('Tujuan')).toBeInTheDocument()
    expect(overview).toHaveTextContent('Pasien memesan sendiri dari HP.')
    expect(overview).toHaveTextContent('Catatan bebas.')
    expect(screen.getByTestId('projects-epic-source-section')).toHaveTextContent('R2 Pasien bisa memilih cabang')
    expect(screen.getByTestId('projects-epic-scope')).toHaveTextContent('R1R2')
    expect(screen.getByTestId('projects-epic-metrics')).toHaveTextContent('Jadwal bentrok')
    expect(screen.getByTestId('projects-epic-metrics')).toHaveTextContent('11%')
    expect(screen.getByTestId('projects-epic-metrics')).toHaveTextContent('0%')
    expect(screen.getByTestId('projects-epic-metrics')).toHaveTextContent('Now')
    expect(screen.getByTestId('projects-epic-metrics')).toHaveTextContent('Target')
    expect(screen.getByTestId('projects-epic-outOfScope')).toHaveTextContent('R6')
    expect(screen.getByTestId('projects-epic-criteria')).toHaveTextContent('Pasien memesan tanpa admin')
    expect(screen.getByTestId('projects-epic-risks')).toHaveTextContent('Jadwal dokter di spreadsheet')
  })

  test('stories are grouped by stage and show their task counts', () => {
    render(<EpicDetailView planning={planning()} onNewStory={vi.fn()} />)

    expect(screen.getByTestId('projects-epic-stage-design')).toHaveTextContent('Masuk dengan OTP')
    expect(screen.getByTestId('projects-epic-stage-draft')).toHaveTextContent('Memesan slot')
    expect(screen.getByTestId('projects-story-s1')).toHaveTextContent('0/4')
    expect(screen.getByTestId('projects-epic-progress')).toHaveTextContent('0/8')
    expect(screen.getByTestId('projects-epic-stage-strip')).toHaveTextContent('Draft')
  })

  test('a PM adds a story to an unpublished epic and opens a story from the list', () => {
    const vm = planning()
    const onNewStory = vi.fn()
    render(<EpicDetailView planning={vm} onNewStory={onNewStory} />)

    fireEvent.click(screen.getByTestId('projects-epic-new-story'))
    fireEvent.click(screen.getByTestId('projects-story-s2'))
    fireEvent.click(screen.getByTestId('projects-item-source'))

    expect(onNewStory).toHaveBeenCalledWith('e1')
    expect(vm.openItem).toHaveBeenCalledWith('s2')
    expect(vm.openDocument).toHaveBeenCalledWith('d1')
  })
})
