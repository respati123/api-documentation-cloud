import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import {
  backlogSchema,
  burndownSchema,
  checklistItemSchema,
  issueLinkSchema,
  issueSchema,
  sprintReportSchema,
  sprintSchema,
  velocitySchema,
} from '@/features/projects/models/issue.model'
import { agileDemoRequest, NOT_AGILE } from '@/features/projects/services/mock/agile-mock-api'
import { DEMO_PROJECT_ID } from '@/features/projects/services/mock/planning-mock.data'

const at = (path: string) => `/projects/${DEMO_PROJECT_ID}${path}`
const get = (path: string) => agileDemoRequest('GET', at(path))

describe('sample data for the agile screens', () => {
  test('the backlog has a running sprint with items, a planned sprint, and loose items by rank', () => {
    const backlog = backlogSchema.parse(get('/backlog?limit=100'))
    expect(backlog.sprints.map((sprint) => [sprint.name, sprint.status])).toEqual([
      ['Sprint 4', 'active'],
      ['Sprint 5', 'planned'],
    ])
    expect(backlog.sprints[0].issues.length).toBeGreaterThan(1)
    expect(backlog.backlog.items.length).toBeGreaterThan(1)
    const ranks = backlog.backlog.items.map((item) => item.rank as number)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(backlog.backlog.items.every((item) => item.sprintId === null)).toBe(true)
  })

  test('the sample holds each type, and a story that is not ready for a sprint', () => {
    const backlog = backlogSchema.parse(get('/backlog'))
    const all = [...backlog.sprints.flatMap((sprint) => sprint.issues), ...backlog.backlog.items]
    expect(new Set(all.map((issue) => issue.type))).toEqual(new Set(['story', 'task', 'bug']))
    expect(backlog.backlog.items.some((item) => item.type === 'story' && item.status !== 'ready')).toBe(true)
  })

  test('epics, sub-tasks, and the children of an item come as lists of issues', () => {
    const list = (query: string) => z.object({ issues: z.array(issueSchema) }).parse(get(`/issues?${query}`)).issues
    expect(list('type=epic&limit=100').map((issue) => issue.type)).toEqual(['epic'])
    const subtasks = list('type=subtask&limit=100')
    expect(subtasks.length).toBeGreaterThan(1)
    const parent = subtasks[0].parentId as string
    expect(list(`epic=${parent}&limit=100`).every((issue) => issue.parentId === parent)).toBe(true)
  })

  test('an issue is read by its id or by its key, and a missing one is refused', () => {
    const [epic] = z.object({ issues: z.array(issueSchema) }).parse(get('/issues?type=epic')).issues
    const byId = z.object({ issue: issueSchema }).parse(get(`/issues/${epic.id}`)).issue
    const byKey = z.object({ issue: issueSchema }).parse(get(`/issues/${epic.key}`)).issue
    expect(byKey.id).toBe(byId.id)
    expect(() => get('/issues/PAY-999')).toThrow()
  })

  test('the checklist and the links of an issue have the shape the screens read', () => {
    const [subtask] = z.object({ issues: z.array(issueSchema) }).parse(get('/issues?type=subtask')).issues
    const parent = subtask.parentId as string
    z.object({ items: z.array(checklistItemSchema) }).parse(get(`/issues/${parent}/checklist`))
    z.object({ links: z.array(issueLinkSchema) }).parse(get(`/issues/${parent}/links`))
  })

  test('the sprints and the reports of the running sprint have the shape the screens read', () => {
    const { sprints } = z.object({ sprints: z.array(sprintSchema) }).parse(get('/sprints'))
    const running = sprints.find((sprint) => sprint.status === 'active') as { id: string }
    const burndown = burndownSchema.parse(get(`/sprints/${running.id}/burndown`))
    expect(burndown.days.length).toBeGreaterThan(5)
    expect(burndown.days[0].remaining).toBe(burndown.total)
    sprintReportSchema.parse(get(`/sprints/${running.id}/report`))
    expect(velocitySchema.parse(get('/reports/velocity?limit=6')).sprints.length).toBeGreaterThan(1)
  })

  test('a change is refused as sample data, and a route that is not agile is left to the caller', () => {
    for (const [method, path] of [
      ['POST', '/issues'],
      ['PATCH', '/issues/PAY-1'],
      ['POST', '/sprints'],
      ['POST', '/sprints/x/start'],
      ['PATCH', ''],
    ] as const) {
      expect(() => agileDemoRequest(method, at(path))).toThrow(/sample/i)
    }
    expect(agileDemoRequest('GET', '/project-members')).toBe(NOT_AGILE)
    expect(agileDemoRequest('GET', at('/tasks'))).toBe(NOT_AGILE)
  })
})
