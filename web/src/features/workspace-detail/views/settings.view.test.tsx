import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { WorkspaceSettingsView } from './settings.view'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WorkspaceSettingsView', () => {
  test('keeps save disabled until the name changes', () => {
    render(<WorkspaceSettingsView workspaceName="Payments API" onRename={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByTestId('workspace-rename-submit-button')).toBeDisabled()

    fireEvent.change(screen.getByTestId('workspace-rename-input'), { target: { value: 'Billing API' } })

    expect(screen.getByTestId('workspace-rename-submit-button')).toBeEnabled()
  })

  test('requires the exact workspace name before delete is enabled', () => {
    render(<WorkspaceSettingsView workspaceName="Payments API" onRename={vi.fn()} onDelete={vi.fn()} />)

    fireEvent.change(screen.getByTestId('workspace-delete-input'), { target: { value: 'Payments' } })
    expect(screen.getByTestId('workspace-delete-submit-button')).toBeDisabled()

    fireEvent.change(screen.getByTestId('workspace-delete-input'), { target: { value: 'Payments API' } })
    expect(screen.getByTestId('workspace-delete-submit-button')).toBeEnabled()
  })

  test('sends the trimmed name when renaming', () => {
    const onRename = vi.fn()
    render(<WorkspaceSettingsView workspaceName="Payments API" onRename={onRename} onDelete={vi.fn()} />)

    fireEvent.change(screen.getByTestId('workspace-rename-input'), { target: { value: '  Billing API  ' } })
    fireEvent.submit(screen.getByTestId('workspace-rename-form'))

    expect(onRename).toHaveBeenCalledWith('Billing API')
  })
})
