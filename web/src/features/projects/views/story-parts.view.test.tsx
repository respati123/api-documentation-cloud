import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { useStoryExtrasViewModel } from '@/features/projects/viewmodels/use-story-extras.viewmodel'
import { StoryTabs } from '@/features/projects/views/story-parts.view'

type Extras = ReturnType<typeof useStoryExtrasViewModel>

function makeExtras(overrides: Partial<Extras> = {}): Extras {
  return {
    isLoading: false,
    available: true,
    dodTotal: 0,
    dodDone: 0,
    dodPercent: 0,
    dod: [],
    flowBlocks: [],
    designs: [],
    onOpenDesign: vi.fn(),
    contracts: [],
    testCases: [],
    copiedId: null,
    onCopyTestCase: vi.fn(),
    stitchkit: { options: [{ value: 's1::sc1', label: 'Kopi · Masuk' }], choice: '', setChoice: vi.fn(), attach: vi.fn(), isBusy: false },
    dataModels: [{ id: 'dm1', projectId: 'd1', projectName: 'Toko', tableId: 't1', tableName: 'orders' }],
    dbdesign: { options: [{ value: 'd1::t2', label: 'Toko · customers' }], choice: '', setChoice: vi.fn(), add: vi.fn(), isBusy: false },
    onRemoveDataModel: vi.fn(),
    removingDataModelId: null,
    ...overrides,
  } as unknown as Extras
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StoryTabs app parts', () => {
  test('the data model tab lists linked tables, removes one, and adds only after a choice', () => {
    const extras = makeExtras()
    const { rerender } = render(<StoryTabs extras={extras} description="" acceptance="" />)
    fireEvent.click(screen.getByTestId('projects-story-tab-data'))
    expect(screen.getByTestId('projects-story-data-model-dm1')).toHaveTextContent('orders')
    fireEvent.click(screen.getByTestId('projects-story-data-model-remove-dm1'))
    expect(extras.onRemoveDataModel).toHaveBeenCalledWith('dm1')
    expect(screen.getByTestId('projects-story-dbdesign-submit')).toBeDisabled()

    const chosen = makeExtras({ dbdesign: { ...extras.dbdesign, choice: 'd1::t2' } })
    rerender(<StoryTabs extras={chosen} description="" acceptance="" />)
    fireEvent.click(screen.getByTestId('projects-story-dbdesign-submit'))
    expect(chosen.dbdesign.add).toHaveBeenCalledTimes(1)
  })

  test('the design tab offers Stitchkit screens from linked projects', () => {
    const extras = makeExtras({ stitchkit: { ...makeExtras().stitchkit, choice: 's1::sc1' } })
    render(<StoryTabs extras={extras} description="" acceptance="" />)
    fireEvent.click(screen.getByTestId('projects-story-tab-design'))
    fireEvent.click(screen.getByTestId('projects-story-stitchkit-submit'))
    expect(extras.stitchkit.attach).toHaveBeenCalledTimes(1)
  })

  test('without linked projects there is no picker', () => {
    const extras = makeExtras({
      stitchkit: { ...makeExtras().stitchkit, options: [] },
      dbdesign: { ...makeExtras().dbdesign, options: [] },
      dataModels: [],
    })
    render(<StoryTabs extras={extras} description="" acceptance="" />)
    fireEvent.click(screen.getByTestId('projects-story-tab-data'))
    expect(screen.queryByTestId('projects-story-dbdesign-picker')).toBeNull()
  })
})
