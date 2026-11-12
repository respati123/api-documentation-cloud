import '@/shared/i18n'
import { beforeEach, describe, expect, test } from 'vitest'
import type { Task } from '@/features/projects/models/project.model'
import { DEMO_PROJECT_ID } from '@/features/projects/services/mock/planning-mock.data'
import { demoRequest, resetDemoState } from '@/features/projects/services/mock/planning-mock-api'

async function tasks(): Promise<Task[]> {
  return ((await demoRequest('GET', `/projects/${DEMO_PROJECT_ID}/tasks`, undefined)) as { tasks: Task[] }).tasks
}

beforeEach(() => {
  resetDemoState()
})

describe('sample data API', () => {
  test('tasks for other roles are locked while the story is in design, UI/UX tasks are not', async () => {
    const list = await tasks()
    expect(list.find((task) => task.id === 'demo-tk-47')?.locked).toBe(true)
    expect(list.find((task) => task.id === 'demo-tk-46')?.locked).toBe(false)
  })

  test('moving a locked task out of the backlog is refused with a message', async () => {
    await expect(demoRequest('PATCH', '/tasks/demo-tk-47', { status: 'todo' })).rejects.toMatchObject({ status: 409 })
  })

  test('approving the design unlocks the other tasks of that story', async () => {
    await demoRequest('POST', '/planning/stories/demo-st-14/approve-design', undefined)

    expect((await tasks()).find((task) => task.id === 'demo-tk-47')?.locked).toBe(false)
    await expect(demoRequest('PATCH', '/tasks/demo-tk-47', { status: 'todo' })).resolves.toBeDefined()
  })

  test('sub-task counts follow added and finished sub-tasks', async () => {
    await demoRequest('POST', '/tasks/demo-tk-41/subtasks', { title: 'Log invite events' })
    await demoRequest('PATCH', '/tasks/demo-tk-41/subtasks/demo-sub-3', { done: true })

    const task = (await tasks()).find((row) => row.id === 'demo-tk-41')
    expect(task).toMatchObject({ subtaskDone: 3, subtaskTotal: 5 })
  })

  test('a Definition of Done item can be ticked', async () => {
    const result = (await demoRequest('PATCH', '/planning/stories/demo-st-12/dod/demo-dod-4', { done: true })) as {
      story: { definitionOfDone: Array<{ id: string; done: boolean }> }
    }
    expect(result.story.definitionOfDone.find((entry) => entry.id === 'demo-dod-4')?.done).toBe(true)
  })
})
