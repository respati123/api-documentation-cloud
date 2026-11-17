import { describe, expect, test } from 'vitest'
import type { Task } from '@/features/projects/models/project.model'
import { type BoardFilters, filterTasks } from '@/features/projects/viewmodels/use-projects.viewmodel'

function task(overrides: Partial<Task>): Task {
  return {
    id: 't',
    projectId: 'p',
    title: 'Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeId: null,
    assigneeEmail: null,
    dueDate: null,
    position: '1',
    createdAt: '2026-11-01',
    updatedAt: '2026-11-01',
    ...overrides,
  }
}

const none: BoardFilters = { search: '', mine: false, overdue: false, priority: '', assigneeId: '', role: '' }
const today = new Date(2026, 10, 12)
const tasks = [
  task({ id: 'mine-late', assigneeId: 'me', dueDate: '2026-11-10', priority: 'high', title: 'Invite endpoint' }),
  task({ id: 'other', assigneeId: 'you', priority: 'low', title: 'Invite dialog' }),
  task({ id: 'done-late', assigneeId: 'me', dueDate: '2026-11-01', status: 'done', title: 'Old work' }),
]

describe('filterTasks', () => {
  test('no filter keeps every task', () => {
    expect(filterTasks(tasks, none, 'me', today)).toHaveLength(3)
  })

  test('assigned to me and overdue combine, and a done task is never overdue', () => {
    expect(filterTasks(tasks, { ...none, mine: true, overdue: true }, 'me', today).map((row) => row.id)).toEqual(['mine-late'])
  })

  test('priority, assignee, and search narrow the list', () => {
    expect(filterTasks(tasks, { ...none, priority: 'low' }, 'me', today).map((row) => row.id)).toEqual(['other'])
    expect(filterTasks(tasks, { ...none, assigneeId: 'you' }, 'me', today).map((row) => row.id)).toEqual(['other'])
    expect(filterTasks(tasks, { ...none, search: 'invite' }, 'me', today).map((row) => row.id)).toEqual(['mine-late', 'other'])
  })
})
