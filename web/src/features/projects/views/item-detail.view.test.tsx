import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ItemDetailView } from '@/features/projects/views/item-detail.view'

type Planning = ComponentProps<typeof ItemDetailView>['planning']

vi.mock('@/features/projects/views/planning-comments.view', () => ({ PlanningCommentsView: () => null }))
vi.mock('@/features/projects/views/story-parts.view', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/projects/views/story-parts.view')>()),
  StoryTabs: () => null,
  RoleLanes: () => null,
}))

function planning(): Planning {
  const value = {
    go: vi.fn(),
    openItem: vi.fn(),
    openDocument: vi.fn(),
    activity: [],
    comments: {},
    storyExtras: {
      available: true,
      stage: 'design',
      userStory: { role: 'pasien', action: 'memilih jam yang kosong', benefit: 'tahu kapan harus datang' },
      error: null,
      tasksDone: 1,
      tasksTotal: 3,
      dodDone: 2,
      dodTotal: 5,
      dodPercent: 40,
      designApproval: null,
      canApproveDesign: false,
      lanes: [
        { role: 'backend', done: 1, percent: 50, tasks: [{ id: 't1' }, { id: 't2' }] },
        { role: 'qa', done: 0, percent: 0, tasks: [{ id: 't3' }] },
      ],
      startEdit: vi.fn(),
    },
    itemDetail: {
      item: {
        id: 's2',
        kind: 'story',
        title: 'Memesan slot dokter yang masih kosong',
        description: '',
        acceptanceCriteria: '',
        status: 'refinement',
        publishedAt: null,
        sourceOutdated: false,
        sourceSection: 'R4 Sistem menolak janji baru pada slot yang sudah terisi. (must)',
      },
      code: 'ST-2',
      parent: { id: 'e1', code: 'EP-1', title: 'Pemesanan janji temu online oleh pasien' },
      source: { id: 'd1', title: 'PRD: Reservasi Online Klinik Sehat Bersama', version: 1 },
      participants: [{ id: 'u1', email: 'rani@contoh.test', discipline: 'pm' }],
      tasks: [],
      error: null,
      canManage: false,
      canRebase: false,
      canPublish: false,
      canMoveNext: false,
      canAddTask: false,
      editing: false,
      isBusy: false,
    },
  }
  return value as unknown as Planning
}

afterEach(() => {
  cleanup()
})

describe('story detail', () => {
  test('the header shows the user story and a compact stage track, and the PRD line is quoted in the main column', () => {
    render(<ItemDetailView planning={planning()} onNewStory={vi.fn()} onOpenTask={vi.fn()} />)

    expect(screen.getByTestId('projects-story-user-story')).toHaveTextContent('memilih jam yang kosong')
    expect(screen.getByTestId('projects-story-stepper').querySelector('[aria-current="step"]')).toHaveTextContent('Design')
    expect(screen.getByTestId('projects-story-source-section')).toHaveTextContent('R4 Sistem menolak janji baru')
  })

  test('the progress panel shows tasks, Definition of Done, and each role', () => {
    render(<ItemDetailView planning={planning()} onNewStory={vi.fn()} onOpenTask={vi.fn()} />)

    const progress = screen.getByTestId('projects-story-progress')
    expect(progress).toHaveTextContent('1/3')
    expect(progress).toHaveTextContent('2/5')
    expect(screen.getByTestId('projects-story-progress-lanes')).toHaveTextContent('1/2')
    expect(screen.getByTestId('projects-story-progress-lanes')).toHaveTextContent('0/1')
  })

  test('the epic and PRD links open them', () => {
    const vm = planning()
    render(<ItemDetailView planning={vm} onNewStory={vi.fn()} onOpenTask={vi.fn()} />)

    fireEvent.click(screen.getByTestId('projects-item-parent'))
    fireEvent.click(screen.getByTestId('projects-item-source'))

    expect(vm.openItem).toHaveBeenCalledWith('e1')
    expect(vm.openDocument).toHaveBeenCalledWith('d1')
  })
})
