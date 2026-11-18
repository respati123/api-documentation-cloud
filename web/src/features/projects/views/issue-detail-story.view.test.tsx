import '@/shared/i18n'
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type IssueDetailProps, IssueDetailView } from '@/features/projects/views/issue-detail.view'

vi.mock('@/features/projects/views/story-parts.view', () => ({
  StoryTabs: ({ description, acceptance }: { description: string; acceptance: string }) => (
    <div data-testid="story-tabs">
      {description}|{acceptance}
    </div>
  ),
  DesignNotice: () => <div data-testid="design-notice" />,
}))

const vm = (storyRef: IssueDetailProps['storyRef']) =>
  ({
    open: vi.fn(),
    close: vi.fn(),
    isOpen: true,
    status: 'ready',
    error: null,
    onRetry: vi.fn(),
    actionError: null,
    storyRef,
    issue: {
      key: 'PARI-1',
      title: 'Pay',
      typeLabel: 'Story',
      description: 'As a buyer',
      acceptance: 'It works',
      statusValue: 'ready',
      statusLabel: 'Ready',
      statusOptions: [],
      canSetStatus: false,
      pointsValue: '',
      pointsLabel: 'No points',
      pointsOptions: [],
      showPoints: true,
      canSetPoints: false,
      priorityLabel: 'High',
      assignee: 'rani',
      parent: null,
      sprintLabel: 'Not in a sprint',
      outdated: null,
      canReview: false,
    },
    childrenHeading: 'Sub-tasks',
    showChildren: false,
    children: { rows: [], hasMore: false, isLoadingMore: false, onLoadMore: vi.fn() },
    checklist: { items: [], progress: '', canEdit: false, newItem: '', canAdd: false },
    links: [],
  }) as unknown as IssueDetailProps

const extras = (available: boolean) => ({ available }) as never

beforeEach(async () => {
  await i18next.changeLanguage('en')
})
afterEach(cleanup)

describe('IssueDetailView story parts', () => {
  test('a story shows its parts with the description and acceptance criteria, in place of the plain sections', () => {
    render(<IssueDetailView vm={vm({ id: 'a', status: 'ready' })} extras={extras(true)} />)
    expect(screen.getByTestId('story-tabs')).toHaveTextContent('As a buyer|It works')
    expect(screen.getByTestId('design-notice')).toBeInTheDocument()
    expect(screen.queryByTestId('issue-detail-description')).toBeNull()
  })

  test('the design notice waits until the parts are loaded', () => {
    render(<IssueDetailView vm={vm({ id: 'a', status: 'ready' })} extras={extras(false)} />)
    expect(screen.getByTestId('story-tabs')).toBeInTheDocument()
    expect(screen.queryByTestId('design-notice')).toBeNull()
  })

  test('any other type keeps the plain description and acceptance sections', () => {
    render(<IssueDetailView vm={vm(null)} extras={extras(true)} />)
    expect(screen.queryByTestId('story-tabs')).toBeNull()
    expect(screen.getByTestId('issue-detail-description')).toHaveTextContent('As a buyer')
  })
})
