import '@/shared/i18n'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { ApiNode, RequestNode } from '@/shared/models/cloud-workspace.model'
import { ApiDocsView, type ApiDocsViewProps } from './api-docs.view'

const login: RequestNode = { id: 'r-login', kind: 'request', name: 'Login', method: 'POST', url: '/v1/login', body: '' }
const tree: ApiNode[] = [{ id: 'f-auth', kind: 'folder', name: 'Auth', children: [login] }]

const baseProps: ApiDocsViewProps = {
  tree,
  totalRequests: 1,
  query: '',
  onQueryChange: vi.fn(),
  selectedRequest: login,
  onSelect: vi.fn(),
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ApiDocsView', () => {
  test('reports search input changes', () => {
    const onQueryChange = vi.fn()
    render(<ApiDocsView {...baseProps} onQueryChange={onQueryChange} />)

    fireEvent.change(screen.getByTestId('docs-search-input'), { target: { value: 'login' } })

    expect(onQueryChange).toHaveBeenCalledWith('login')
  })

  test('selects a request from the tree', () => {
    const onSelect = vi.fn()
    render(<ApiDocsView {...baseProps} onSelect={onSelect} />)

    fireEvent.click(screen.getByTestId('docs-request-r-login'))

    expect(onSelect).toHaveBeenCalledWith('r-login')
  })

  test('explains when a search matches nothing', () => {
    render(<ApiDocsView {...baseProps} tree={[]} query="missing" selectedRequest={null} />)

    expect(screen.getByText('No endpoints match this search.')).toBeInTheDocument()
  })

  test('shows the empty document state when no endpoint is selected', () => {
    render(<ApiDocsView {...baseProps} selectedRequest={null} />)

    expect(screen.getByTestId('docs-empty-state')).toBeInTheDocument()
  })
})
