import type { Issue, IssueType, Sprint } from '@/features/projects/models/issue.model'
import { DEMO_PROJECT_ID } from '@/features/projects/services/mock/planning-mock.data'
import { ApiError } from '@/shared/services/api-client'

// Sample issues and sprints for the agile screens, read only. A change is refused, since the sample is not saved anywhere.
// The dates are counted from today, so the running sprint always has days left.
export const NOT_AGILE = Symbol('not an agile route')

const DAY = 86_400_000
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)
const stamp = (offset: number) => new Date(Date.now() + offset * DAY).toISOString()
const PEOPLE = { maya: { id: 'demo-maya', email: 'maya@example.test' }, andi: { id: 'demo-andi', email: 'andi@example.test' } }

const sprint = (n: number, status: Sprint['status'], from: number, to: number, goal: string): Sprint => ({
  id: `demo-sp-${n}`,
  projectId: DEMO_PROJECT_ID,
  name: `Sprint ${n}`,
  goal,
  startsOn: day(from),
  endsOn: day(to),
  status,
  startedAt: status === 'planned' ? null : stamp(from),
  closedAt: status === 'closed' ? stamp(to) : null,
  createdBy: PEOPLE.maya.id,
  createdAt: stamp(from - 3),
})

const SPRINTS: Sprint[] = [
  sprint(2, 'closed', -40, -27, 'Sign in and invites'),
  sprint(3, 'closed', -26, -13, 'Collections and history'),
  sprint(4, 'active', -5, 8, 'Customers can pay with a card'),
  sprint(5, 'planned', 9, 22, 'Refunds and saved cards'),
]
const RUNNING = SPRINTS[2]

function issue(n: number, type: IssueType, title: string, over: Partial<Issue> = {}): Issue {
  return {
    id: `demo-is-${n}`,
    projectId: DEMO_PROJECT_ID,
    number: n,
    key: `PAY-${n}`,
    type,
    parentId: null,
    title,
    description: '',
    acceptanceCriteria: '',
    userStoryRole: '',
    userStoryAction: '',
    userStoryBenefit: '',
    flow: '',
    status: type === 'story' ? 'draft' : 'todo',
    points: null,
    priority: 'medium',
    rank: null,
    sprintId: null,
    role: null,
    assigneeId: null,
    assigneeEmail: null,
    dueDate: null,
    sourceDocumentId: null,
    sourceVersion: null,
    sourceSection: null,
    sourceReviewedVersion: null,
    sourceOutdated: null,
    designApprovedBy: null,
    designApprovedAt: null,
    testCaseId: null,
    publishedAt: stamp(-30),
    createdBy: PEOPLE.maya.id,
    createdAt: stamp(-30),
    updatedAt: stamp(-2),
    ...over,
  }
}

const ISSUES: Issue[] = [
  issue(1, 'epic', 'Checkout', { status: null, description: 'Everything a buyer needs to pay.' }),
  issue(2, 'story', 'Pay with a card', {
    parentId: 'demo-is-1',
    status: 'in_progress',
    points: 5,
    rank: 1024,
    sprintId: RUNNING.id,
    description: 'As a buyer I pay by card, so that I do not wait for an invoice.',
    acceptanceCriteria: 'The card is charged once.\nA receipt is sent by email.',
    assigneeId: PEOPLE.maya.id,
    assigneeEmail: PEOPLE.maya.email,
    designApprovedBy: PEOPLE.maya.id,
    designApprovedAt: stamp(-12),
  }),
  issue(3, 'task', 'Set up the gateway', {
    parentId: 'demo-is-1',
    status: 'in_progress',
    points: 3,
    rank: 2048,
    sprintId: RUNNING.id,
    assigneeId: PEOPLE.andi.id,
    assigneeEmail: PEOPLE.andi.email,
  }),
  issue(4, 'bug', 'Receipt shows the wrong total', { points: 2, rank: 3072, sprintId: RUNNING.id, priority: 'high' }),
  issue(5, 'story', 'Refund a payment', { parentId: 'demo-is-1', rank: 4096, description: 'As support I refund a payment.' }),
  issue(6, 'task', 'Write the release notes', { points: 1, rank: 5120 }),
  issue(7, 'story', 'Saved cards', {
    parentId: 'demo-is-1',
    status: 'ready',
    points: 8,
    rank: 6144,
    acceptanceCriteria: 'A buyer keeps a card for the next payment.',
    designApprovedBy: PEOPLE.maya.id,
    designApprovedAt: stamp(-6),
  }),
  issue(8, 'subtask', 'Card form', {
    parentId: 'demo-is-3',
    role: 'frontend',
    status: 'in_progress',
    assigneeId: PEOPLE.andi.id,
    assigneeEmail: PEOPLE.andi.email,
  }),
  issue(9, 'subtask', 'Gateway call', { parentId: 'demo-is-3', role: 'backend', status: 'todo' }),
  issue(10, 'subtask', 'Design the card dialog', { parentId: 'demo-is-2', role: 'ui_ux', status: 'done' }),
  issue(11, 'subtask', 'Card endpoint', {
    parentId: 'demo-is-2',
    role: 'backend',
    status: 'in_review',
    assigneeId: PEOPLE.andi.id,
    assigneeEmail: PEOPLE.andi.email,
  }),
]

const REFUSED = 'This is sample data and is read only. Turn it off to change real work.'
const refuse = (): never => {
  throw new ApiError(REFUSED, 409, { code: 'DEMO_REFUSED' })
}
const find = (ref: string) => ISSUES.find((item) => item.id === ref || item.key === ref)
const isItem = (item: Issue) => item.type === 'story' || item.type === 'task' || item.type === 'bug'
const reportItem = ({ id, key, title, type, status, points }: Issue) => ({ id, key, title, type, status, points })

function burndown(sprintId: string) {
  const target = SPRINTS.find((item) => item.id === sprintId) ?? RUNNING
  const total = ISSUES.filter((item) => item.sprintId === RUNNING.id).reduce((sum, item) => sum + (item.points ?? 0), 0)
  const start = Date.parse(target.startsOn)
  const length = Math.round((Date.parse(target.endsOn) - start) / DAY) + 1
  const elapsed = Math.floor((Date.now() - start) / DAY)
  const finishedByDay = [0, 0, 2, 2, 3, 3]
  return {
    sprintId: target.id,
    total,
    days: Array.from({ length }, (_, index) => ({
      date: new Date(start + index * DAY).toISOString().slice(0, 10),
      remaining: index > elapsed ? null : total - finishedByDay[Math.min(index, finishedByDay.length - 1)],
      ideal: Math.round(total * (1 - index / (length - 1)) * 100) / 100,
    })),
  }
}

// Answers a request for the agile screens, or says it is not one. `path` starts after /api/workspaces/{id}.
export function agileDemoRequest(method: string, path: string): unknown {
  const url = new URL(path, 'http://sample.local')
  const prefix = `/projects/${DEMO_PROJECT_ID}`
  if (!url.pathname.startsWith(prefix)) return NOT_AGILE
  const rest = url.pathname.slice(prefix.length)
  const agile =
    /^\/(backlog|issues|sprints|reports|flow|wip-limits)(\/|$)/.test(rest) ||
    rest === '' ||
    /^\/documents\/[\w-]+\/draft-backlog$/.test(rest)
  if (!agile) return NOT_AGILE
  if (method !== 'GET') return refuse()

  if (rest === '/backlog') {
    const open = SPRINTS.filter((item) => item.status !== 'closed')
    return {
      sprints: open.map((item) => ({ ...item, issues: ISSUES.filter((row) => row.sprintId === item.id && isItem(row)) })),
      backlog: {
        items: ISSUES.filter((row) => isItem(row) && row.sprintId === null && row.status !== 'done').sort(
          (a, b) => (a.rank ?? 0) - (b.rank ?? 0),
        ),
        nextCursor: null,
      },
    }
  }
  if (rest === '/issues') {
    const type = url.searchParams.get('type')
    const parent = url.searchParams.get('epic')
    return { issues: ISSUES.filter((row) => (type === null || row.type === type) && (parent === null || row.parentId === parent)) }
  }
  let match = rest.match(/^\/issues\/([\w-]+)$/)
  if (match) return { issue: find(match[1]) ?? fail404() }
  match = rest.match(/^\/issues\/([\w-]+)\/checklist$/)
  if (match) {
    const id = (find(match[1]) ?? fail404()).id
    return {
      items:
        id === 'demo-is-3'
          ? [
              { id: 'demo-ck-1', issueId: id, title: 'Sandbox keys are in the vault', done: true, position: 1 },
              { id: 'demo-ck-2', issueId: id, title: 'Webhook is registered', done: false, position: 2 },
            ]
          : [],
    }
  }
  match = rest.match(/^\/issues\/([\w-]+)\/links$/)
  if (match) {
    const id = (find(match[1]) ?? fail404()).id
    return {
      links:
        id === 'demo-is-4'
          ? [
              {
                id: 'demo-lk-1',
                kind: 'found_in',
                direction: 'out',
                issueId: 'demo-is-2',
                issueKey: 'PAY-2',
                issueTitle: 'Pay with a card',
              },
            ]
          : [],
    }
  }
  if (rest === '/sprints') return { sprints: SPRINTS }
  match = rest.match(/^\/sprints\/([\w-]+)\/burndown$/)
  if (match) return burndown(match[1])
  match = rest.match(/^\/sprints\/([\w-]+)\/report$/)
  if (match) {
    const target = SPRINTS.find((item) => item.id === match?.[1]) ?? RUNNING
    const items = ISSUES.filter((row) => row.sprintId === RUNNING.id)
    const finished = target.status === 'closed' ? items.slice(0, 2) : items.filter((row) => row.status === 'done')
    return {
      sprint: target,
      committedPoints: items.reduce((sum, row) => sum + (row.points ?? 0), 0),
      completedPoints: finished.reduce((sum, row) => sum + (row.points ?? 0), 0),
      completed: finished.map(reportItem),
      notCompleted: items.filter((row) => !finished.includes(row)).map(reportItem),
      addedAfterStart: [reportItem(ISSUES[3])],
      removedAfterStart: [],
      pointsChanged: [{ ...reportItem(ISSUES[1]), before: 3, after: 5 }],
    }
  }
  if (rest === '/reports/velocity') {
    const closed = SPRINTS.filter((item) => item.status === 'closed')
    const numbers = [
      { committed: 18, added: 2, completed: 16 },
      { committed: 20, added: 3, completed: 19 },
    ]
    return {
      sprints: closed.map((item, index) => ({
        sprintId: item.id,
        name: item.name,
        startsOn: item.startsOn,
        endsOn: item.endsOn,
        committedPoints: numbers[index].committed,
        addedPoints: numbers[index].added,
        completedPoints: numbers[index].completed,
      })),
      averageCompleted: 17.5,
    }
  }
  if (rest === '/wip-limits') return { limits: [] }
  return NOT_AGILE
}

function fail404(): never {
  throw new ApiError('Issue not found.', 404, { code: 'DEMO_REFUSED' })
}

export const DEMO_AGILE_PROJECT = { key: 'PAY', mode: 'scrum' as const, productGoal: 'Halve the time a buyer needs to pay.' }
