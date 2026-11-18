import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { issuesService } from '@/features/projects/services/issues.service'
import { DEMO_PROJECT_ID } from '@/features/projects/services/mock/planning-mock.data'
import { usePlanningDemoStore } from '@/features/projects/stores/planning-demo.store'
import * as client from '@/shared/services/api-client'

describe('issue lists in the sample workspace', () => {
  beforeEach(() => usePlanningDemoStore.getState().setDemo('w-sample', true))
  afterEach(() => {
    usePlanningDemoStore.getState().setDemo('w-sample', false)
    vi.restoreAllMocks()
  })

  test('epics, sub-tasks, and the children of an item come from the sample data, with no request to the server', async () => {
    const network = vi.spyOn(client, 'apiPage')
    const epics = await issuesService.epics('t', 'w-sample', DEMO_PROJECT_ID)
    expect(epics.items.map((item) => item.type)).toEqual(['epic'])
    expect(epics.nextCursor).toBeNull()
    const subtasks = await issuesService.subtasks('t', 'w-sample', DEMO_PROJECT_ID)
    expect(subtasks.items.length).toBeGreaterThan(1)
    const children = await issuesService.children('t', 'w-sample', DEMO_PROJECT_ID, subtasks.items[0].parentId as string)
    expect(children.items.length).toBeGreaterThan(0)
    expect(network).not.toHaveBeenCalled()
  })

  test('a workspace that is not the sample asks the server', async () => {
    const network = vi.spyOn(client, 'apiPage').mockResolvedValue({ data: { issues: [] }, nextCursor: 'next' } as never)
    const page = await issuesService.epics('t', 'w-real', 'p1', 'abc')
    expect(page).toEqual({ items: [], nextCursor: 'next' })
    expect(network).toHaveBeenCalledWith('/api/workspaces/w-real/projects/p1/issues?type=epic&limit=100&cursor=abc', { token: 't' })
  })
})
