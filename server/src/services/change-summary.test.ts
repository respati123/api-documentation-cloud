import { describe, expect, test } from 'bun:test'
import { maxChangeSummary, summarizeChanges } from '@/services/change-summary'
import type { TreeNode } from '@/models/workspace'

const request = (id: string, name: string, method: string, url = '/x'): TreeNode => ({ id, kind: 'request', name, method, url, body: '' })
const folder = (id: string, name: string, children: TreeNode[]): TreeNode => ({ id, kind: 'folder', name, children })

describe('summarizeChanges', () => {
  test('an added, an edited and a deleted request are told apart, with their method and folder', () => {
    const before = [folder('f', 'Users', [request('a', 'Get list', 'GET'), request('b', 'Old', 'DELETE')])]
    const after = [folder('f', 'Users', [request('a', 'Get list', 'GET', '/users?page=1'), request('c', 'Create', 'POST')])]
    expect(summarizeChanges(before, after)).toEqual([
      { id: 'a', name: 'Get list', status: 'modified', method: 'GET', folder: 'Users' },
      { id: 'c', name: 'Create', status: 'added', method: 'POST', folder: 'Users' },
      { id: 'b', name: 'Old', status: 'deleted', method: 'DELETE', folder: 'Users' },
    ])
  })

  test('an item that did not change is not listed', () => {
    const tree = [request('a', 'Get list', 'GET')]
    expect(summarizeChanges(tree, tree)).toEqual([])
  })

  test('a folder that only holds a changed request is not itself listed as changed', () => {
    const before = [folder('f', 'Users', [request('a', 'Get list', 'GET', '/a')])]
    const after = [folder('f', 'Users', [request('a', 'Get list', 'GET', '/b')])]
    expect(summarizeChanges(before, after).map((item) => item.id)).toEqual(['a'])
  })

  test('a first push with no earlier tree lists everything as added', () => {
    expect(summarizeChanges([], [request('a', 'Get list', 'GET')])).toEqual([{ id: 'a', name: 'Get list', status: 'added', method: 'GET' }])
  })

  test('the list length is capped by the constant the notification uses', () => {
    const many = Array.from({ length: maxChangeSummary + 5 }, (_, index) => request(`r${index}`, `R${index}`, 'GET'))
    expect(summarizeChanges([], many)).toHaveLength(maxChangeSummary + 5)
  })
})
