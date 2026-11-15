import { describe, expect, test } from 'vitest'
import { buildSidebar } from '@/features/app-shell/utils/sidebar'
import type { CloudWorkspaceRef } from '@/shared/models/workspace.model'

const workspace = (id: string, role: CloudWorkspaceRef['role']): CloudWorkspaceRef => ({
  id,
  name: id,
  role,
  headCommitId: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: null,
})

describe('buildSidebar', () => {
  test('shows the home links outside a workspace, with the workspace count', () => {
    const items = buildSidebar({ page: 'overview' }, [workspace('a', 'owner'), workspace('b', 'viewer')])

    expect(items.map((item) => item.id)).toEqual(['home', 'workspaces'])
    expect(items[0].active).toBe(true)
    expect(items[1].count).toBe(2)
  })

  test('shows the workspace menu inside a workspace, with API grouping collections and history', () => {
    const items = buildSidebar({ page: 'workspace', workspaceId: 'a', tab: 'overview' }, [workspace('a', 'owner')])

    expect(items.map((item) => item.id)).toEqual(['overview', 'api', 'projects', 'team', 'settings'])
    expect(items[1].children?.map((item) => item.id)).toEqual(['collections', 'history'])
    expect(items[1].children?.[1].route).toEqual({ page: 'workspace', workspaceId: 'a', tab: 'history' })
  })

  test('marks API active when one of its sections is open', () => {
    const items = buildSidebar({ page: 'workspace', workspaceId: 'a', tab: 'history', commitId: 'c1' }, [workspace('a', 'editor')])
    const api = items.find((item) => item.id === 'api')

    expect(api?.active).toBe(true)
    expect(api?.children?.find((item) => item.id === 'history')?.active).toBe(true)
    expect(api?.children?.find((item) => item.id === 'collections')?.active).toBe(false)
  })

  test('hides settings from members who do not own the workspace', () => {
    const items = buildSidebar({ page: 'workspace', workspaceId: 'a' }, [workspace('a', 'editor')])

    expect(items.map((item) => item.id)).not.toContain('settings')
  })

  test('hides settings in a workspace missing from the list, such as an admin read-only view', () => {
    const items = buildSidebar({ page: 'workspace', workspaceId: 'other' }, [workspace('a', 'owner')])

    expect(items.map((item) => item.id)).not.toContain('settings')
    expect(items[0].active).toBe(true)
  })
})
