import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { DesignAppViewModel } from '@/features/app-integrations/viewmodels/use-design-app.viewmodel'
import { DesignAppView } from '@/features/app-integrations/views/design-app.view'

function makeVm(overrides: Partial<DesignAppViewModel> = {}): DesignAppViewModel {
  return {
    status: 'ready',
    errorMessage: null,
    retry: vi.fn(),
    enabled: true,
    baseUrl: 'https://dbdesign.test',
    links: [{ id: 'l1', projectId: 'd1', name: 'Toko', url: 'https://dbdesign.test/project/d1' }],
    canManage: false,
    openUrl: vi.fn(),
    unlink: vi.fn(),
    unlinkingId: null,
    dialog: {
      isOpen: false,
      open: vi.fn(),
      close: vi.fn(),
      projects: [],
      isLoading: false,
      loadError: null,
      choice: '',
      setChoice: vi.fn(),
      confirm: vi.fn(),
      isBusy: false,
      saveError: null,
    },
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DesignAppView', () => {
  test('an app that is not set up on the server says so', () => {
    render(<DesignAppView app="dbdesign" vm={makeVm({ enabled: false })} />)
    expect(screen.getByTestId('design-dbdesign-not-configured')).toBeInTheDocument()
  })

  test('a member sees linked projects and can open them, but cannot link or unlink', () => {
    const vm = makeVm()
    render(<DesignAppView app="dbdesign" vm={vm} />)
    expect(screen.getByTestId('design-dbdesign-link-d1')).toHaveTextContent('Toko')
    fireEvent.click(screen.getByTestId('design-dbdesign-open-d1'))
    expect(vm.openUrl).toHaveBeenCalledWith('https://dbdesign.test/project/d1')
    expect(screen.queryByTestId('design-dbdesign-link-button')).toBeNull()
    expect(screen.queryByTestId('design-dbdesign-unlink-d1')).toBeNull()
  })

  test('the owner can start linking and unlink a project', () => {
    const vm = makeVm({ canManage: true })
    render(<DesignAppView app="dbdesign" vm={vm} />)
    fireEvent.click(screen.getByTestId('design-dbdesign-link-button'))
    expect(vm.dialog.open).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('design-dbdesign-unlink-d1'))
    expect(vm.unlink).toHaveBeenCalledWith('l1')
  })

  test('with no linked project, the owner is told how to add one', () => {
    render(<DesignAppView app="stitchkit" vm={makeVm({ canManage: true, links: [] })} />)
    expect(screen.getByTestId('design-stitchkit-empty')).toHaveTextContent('Link a project you can open in the app')
  })
})
