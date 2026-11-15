import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { detectBreakingChanges } from '@/features/workspace-detail/utils/breaking-changes'
import { buildChangeTree, buildFileDiffs, diffTotals } from '@/features/workspace-detail/utils/commit-history'
import { compareSnapshots } from '@/features/workspace-detail/utils/snapshot-diff'
import { CommitDetailView, type CommitDetailViewProps } from '@/features/workspace-detail/views/commit-detail.view'
import type { RequestNode } from '@/shared/models/cloud-workspace.model'

const request = (id: string, url: string): RequestNode => ({ id, kind: 'request', name: id, method: 'GET', url, body: '' })
const files = buildFileDiffs(compareSnapshots([request('a', '/v1')], [request('a', '/v2'), request('b', '/b')]))

const props: CommitDetailViewProps = {
  commit: {
    id: 'c3-full',
    shortId: 'c3',
    message: 'Rename paths',
    authorEmail: 'ada@test.dev',
    when: 'today',
    date: 'Nov 7',
    parentId: 'c2-full',
    parentShortId: 'c2',
    isLatest: false,
  },
  status: 'ready',
  error: null,
  files,
  tree: buildChangeTree(files),
  breakingChanges: [],
  breakingFileIds: [],
  totals: diffTotals(files),
  layout: 'split',
  diffLayout: 'split',
  canChooseLayout: true,
  viewedIds: [],
  collapsedIds: [],
  expandedGapKeys: [],
  canRestore: true,
  onBack: vi.fn(),
  onOpenCommit: vi.fn(),
  onRetry: vi.fn(),
  onLayoutChange: vi.fn(),
  onToggleViewed: vi.fn(),
  onToggleCollapsed: vi.fn(),
  onExpandGap: vi.fn(),
  onJumpToFile: vi.fn(),
  onRestore: vi.fn(),
}

afterEach(() => {
  cleanup()
})

describe('CommitDetailView', () => {
  test('shows each changed item with its diff', () => {
    render(<CommitDetailView {...props} />)

    expect(screen.getByTestId('history-file-a')).toHaveAttribute('data-kind', 'modified')
    expect(screen.getByTestId('history-file-b')).toHaveAttribute('data-kind', 'added')
    expect(screen.getByTestId('history-diff-a')).toBeInTheDocument()
  })

  test('hides the diff of a folded item', () => {
    render(<CommitDetailView {...props} collapsedIds={['a']} />)

    expect(screen.queryByTestId('history-diff-a')).not.toBeInTheDocument()
    expect(screen.getByTestId('history-diff-b')).toBeInTheDocument()
  })

  test('reports viewed, fold, jump, parent, and layout choices', () => {
    render(<CommitDetailView {...props} />)

    fireEvent.click(screen.getByTestId('history-file-a-viewed'))
    fireEvent.click(screen.getByTestId('history-file-b-toggle'))
    fireEvent.click(screen.getByTestId('history-tree-b'))
    fireEvent.click(screen.getByTestId('history-commit-parent'))
    fireEvent.click(screen.getByTestId('history-layout-unified'))

    expect(props.onToggleViewed).toHaveBeenCalledWith('a')
    expect(props.onToggleCollapsed).toHaveBeenCalledWith('b')
    expect(props.onJumpToFile).toHaveBeenCalledWith('b')
    expect(props.onOpenCommit).toHaveBeenCalledWith('c2-full')
    expect(props.onLayoutChange).toHaveBeenCalledWith('unified')
  })

  test('hides the layout choice on a narrow screen', () => {
    render(<CommitDetailView {...props} canChooseLayout={false} diffLayout="unified" />)

    expect(screen.queryByTestId('history-layout-toggle')).not.toBeInTheDocument()
    expect(screen.getByTestId('history-diff-a')).toHaveAttribute('data-layout', 'unified')
  })

  test('disables restore on the latest commit and hides it without permission', () => {
    const { rerender } = render(<CommitDetailView {...props} commit={{ ...props.commit, isLatest: true }} />)
    expect(screen.getByTestId('history-restore-button')).toBeDisabled()

    rerender(<CommitDetailView {...props} canRestore={false} />)
    expect(screen.queryByTestId('history-restore-button')).not.toBeInTheDocument()
  })

  test('shows loading, error with retry, and empty states', () => {
    const { rerender } = render(<CommitDetailView {...props} status="loading" />)
    expect(screen.getByTestId('history-commit-loading')).toBeInTheDocument()

    rerender(<CommitDetailView {...props} status="error" error="Commit not found" />)
    expect(screen.getByTestId('history-commit-error')).toHaveTextContent('Commit not found')

    rerender(<CommitDetailView {...props} files={[]} tree={[]} />)
    expect(screen.getByTestId('history-commit-empty')).toBeInTheDocument()
  })
})

describe('CommitDetailView breaking changes', () => {
  const breaking = detectBreakingChanges([request('a', '/v1')], [request('a', '/v2')])

  test('marks the commit, lists each reason, and flags the item', () => {
    render(<CommitDetailView {...props} breakingChanges={breaking} breakingFileIds={['a']} />)

    expect(screen.getByTestId('history-commit-breaking-badge')).toBeInTheDocument()
    expect(screen.getByTestId('history-breaking-panel')).toHaveTextContent('/v1 → /v2')
    expect(screen.getByTestId('history-file-a-breaking')).toBeInTheDocument()
    expect(screen.queryByTestId('history-file-b-breaking')).not.toBeInTheDocument()
  })

  test('jumps to the item from a listed reason', () => {
    render(<CommitDetailView {...props} breakingChanges={breaking} breakingFileIds={['a']} />)

    fireEvent.click(screen.getByTestId('history-breaking-a-path-changed'))

    expect(props.onJumpToFile).toHaveBeenCalledWith('a')
  })

  test('shows no breaking marks for a safe commit', () => {
    render(<CommitDetailView {...props} />)

    expect(screen.queryByTestId('history-commit-breaking-badge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('history-breaking-panel')).not.toBeInTheDocument()
  })
})
