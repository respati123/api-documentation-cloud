import { describe, expect, test } from 'vitest'
import type { ApiNode, RequestNode } from '@/shared/models/cloud-workspace.model'
import { countFolders, countRequests, filterCollection, findRequest, firstRequest } from './collection'

const login: RequestNode = { id: 'r-login', kind: 'request', name: 'Login', method: 'POST', url: '/v1/login', body: '' }
const charges: RequestNode = { id: 'r-charges', kind: 'request', name: 'List charges', method: 'GET', url: '/v1/charges', body: '' }
const tree: ApiNode[] = [
  { id: 'f-auth', kind: 'folder', name: 'Auth', children: [login] },
  {
    id: 'f-billing',
    kind: 'folder',
    name: 'Billing',
    children: [{ id: 'f-nested', kind: 'folder', name: 'Charges', children: [charges] }],
  },
]

describe('collection helpers', () => {
  test('counts requests and folders at every depth', () => {
    expect(countRequests(tree)).toBe(2)
    expect(countFolders(tree)).toBe(3)
  })

  test('finds the first request in document order', () => {
    expect(firstRequest(tree)?.id).toBe('r-login')
    expect(firstRequest([])).toBeNull()
  })

  test('finds a request by id at any depth', () => {
    expect(findRequest(tree, 'r-charges')?.name).toBe('List charges')
    expect(findRequest(tree, 'missing')).toBeNull()
  })

  test('filters by method, name, or url and keeps only folders that still have matches', () => {
    const filtered = filterCollection(tree, 'charges')

    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toMatchObject({ id: 'f-billing' })
    expect(countRequests(filtered)).toBe(1)
  })

  test('returns the full tree for an empty query', () => {
    expect(filterCollection(tree, '   ')).toBe(tree)
  })
})
