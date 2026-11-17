import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { buildFileDiffs } from '@/features/workspace-detail/utils/commit-history'
import { compareSnapshots } from '@/features/workspace-detail/utils/snapshot-diff'
import { DiffView } from '@/features/workspace-detail/views/diff-view.view'
import type { RequestNode } from '@/shared/models/cloud-workspace.model'

const request = (url: string, documentation = ''): RequestNode => ({
  id: 'r',
  kind: 'request',
  name: 'List',
  method: 'GET',
  url,
  body: '',
  documentation,
})

// A long body pushes the change far from the end, so the tail folds into a gap.
const longBody = JSON.stringify(Object.fromEntries(Array.from({ length: 15 }, (_, index) => [`field${index}`, index])))
const [file] = buildFileDiffs(
  compareSnapshots([{ ...request('/v1/users'), body: longBody }], [{ ...request('/v2/users'), body: longBody }]),
)

afterEach(() => {
  cleanup()
})

describe('DiffView', () => {
  test('renders removed and added lines with their kind', () => {
    const { container } = render(<DiffView fileId="r" blocks={file.blocks} layout="unified" expandedGapKeys={[]} onExpandGap={vi.fn()} />)

    expect(container.querySelectorAll('[data-kind="removed"]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-kind="added"]')).toHaveLength(1)
  })

  test('asks to open a folded gap, and shows its lines once opened', () => {
    const onExpandGap = vi.fn()
    const gap = file.blocks.find((block) => block.kind === 'gap')
    if (!gap) throw new Error('expected a gap')
    const { container, rerender } = render(
      <DiffView fileId="r" blocks={file.blocks} layout="unified" expandedGapKeys={[]} onExpandGap={onExpandGap} />,
    )
    const before = container.querySelectorAll('[data-kind="same"]').length

    fireEvent.click(screen.getByTestId(`history-diff-r-expand-${gap.id}`))
    expect(onExpandGap).toHaveBeenCalledWith('r', gap.id)

    rerender(<DiffView fileId="r" blocks={file.blocks} layout="unified" expandedGapKeys={[`r:${gap.id}`]} onExpandGap={onExpandGap} />)
    expect(container.querySelectorAll('[data-kind="same"]').length).toBe(before + gap.lines.length)
  })

  test('puts the old and new line side by side in split layout', () => {
    render(<DiffView fileId="r" blocks={file.blocks} layout="split" expandedGapKeys={[]} onExpandGap={vi.fn()} />)

    expect(screen.getByTestId('history-diff-r')).toHaveAttribute('data-layout', 'split')
  })
})
