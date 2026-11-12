import type { PlanningComment, PlanningDocument, PlanningEvent, PlanningItem } from '@/features/projects/models/planning.model'
import type { Task } from '@/features/projects/models/project.model'
import type { DodItem, StoryDetails, Subtask } from '@/features/projects/models/story.model'
import {
  DEMO_LOCKED_MESSAGE,
  DEMO_PROJECT_ID,
  demoComments,
  demoDocuments,
  demoEvents,
  demoItems,
  demoMembers,
  demoPlanningTasks,
  demoStories,
  demoSubtasks,
  demoTasks,
} from '@/features/projects/services/mock/planning-mock.data'
import i18next from '@/shared/i18n'
import { ApiError } from '@/shared/services/api-client'

interface DemoState {
  documents: PlanningDocument[]
  items: PlanningItem[]
  tasks: Task[]
  stories: Record<string, StoryDetails>
  subtasks: Record<string, Subtask[]>
  comments: Record<string, PlanningComment[]>
  events: PlanningEvent[]
}

let state: DemoState = seed()

function seed(): DemoState {
  return {
    documents: demoDocuments(),
    items: demoItems(),
    tasks: demoTasks(),
    stories: demoStories(),
    subtasks: demoSubtasks(),
    comments: demoComments(),
    events: demoEvents(),
  }
}

export function resetDemoState() {
  state = seed()
}

let counter = 0
const newId = (prefix: string) => `demo-${prefix}-${Date.now()}-${++counter}`
const now = () => new Date().toISOString()

// Tasks for any role but UI/UX wait for the story design, as plan 4.2 describes.
function isLocked(task: Task): boolean {
  const stage = task.storyId ? state.stories[task.storyId]?.stage : undefined
  return task.role !== 'ui_ux' && (stage === 'draft' || stage === 'design')
}

function withComputed(task: Task): Task {
  const subtasks = state.subtasks[task.id] ?? []
  return { ...task, locked: isLocked(task), subtaskDone: subtasks.filter((subtask) => subtask.done).length, subtaskTotal: subtasks.length }
}

function summary(document: PlanningDocument) {
  const {
    content: _content,
    fileName: _fileName,
    mimeType: _mimeType,
    sourceVersion: _sourceVersion,
    versions: _versions,
    createdAt: _createdAt,
    ...rest
  } = document
  return rest
}

function fail(status: number, message: string): never {
  throw new ApiError(message, status, { code: 'DEMO_REFUSED' })
}

function record(targetKind: string, targetId: string, action: string) {
  state.events = [
    { id: newId('ev'), actorId: 'demo-maya', apiKeyId: null, targetKind, targetId, action, createdAt: now() },
    ...state.events,
  ]
}

type Body = Record<string, unknown>

// Answers a portal request the way the planned server endpoints would. `path` starts after /api/workspaces/{id}.
export async function demoRequest(method: string, path: string, body: unknown): Promise<unknown> {
  const input = (body && typeof body === 'object' && !(body instanceof FormData) ? body : {}) as Body
  const route = `${method} ${path}`
  let match: RegExpMatchArray | null

  if (route === 'GET /projects')
    return {
      projects: [
        {
          id: DEMO_PROJECT_ID,
          workspaceId: 'demo',
          name: 'Payments API',
          description: '',
          createdAt: now(),
          taskCount: state.tasks.length,
        },
      ],
    }
  if (route === 'GET /project-members') return { members: demoMembers }
  if (route === `GET /projects/${DEMO_PROJECT_ID}/tasks`) return { tasks: state.tasks.map(withComputed) }
  if (route === `POST /projects/${DEMO_PROJECT_ID}/tasks`) {
    const assignee = demoMembers.find((member) => member.id === input.assigneeId)
    const task: Task = {
      id: newId('tk'),
      projectId: DEMO_PROJECT_ID,
      title: String(input.title ?? ''),
      description: String(input.description ?? ''),
      status: (input.status as Task['status']) ?? 'backlog',
      priority: (input.priority as Task['priority']) ?? 'medium',
      assigneeId: assignee?.id ?? null,
      assigneeEmail: assignee?.email ?? null,
      dueDate: (input.dueDate as string | null) ?? null,
      position: String(state.tasks.length + 1),
      createdAt: now(),
      updatedAt: now(),
      storyId: null,
      role: null,
      dependsOn: [],
    }
    state.tasks = [...state.tasks, task]
    return { task: withComputed(task) }
  }
  match = route.match(/^PATCH \/tasks\/([\w-]+)$/)
  if (match) {
    const task = state.tasks.find((row) => row.id === match?.[1])
    if (!task) fail(404, 'Task not found.')
    if (input.status && input.status !== task.status && input.status !== 'backlog' && isLocked(task))
      fail(409, DEMO_LOCKED_MESSAGE[i18next.language === 'id' ? 'id' : 'en'])
    const assignee = input.assigneeId === undefined ? undefined : demoMembers.find((member) => member.id === input.assigneeId)
    const next: Task = {
      ...task,
      ...(input.title !== undefined && { title: String(input.title) }),
      ...(input.description !== undefined && { description: String(input.description) }),
      ...(input.status !== undefined && { status: input.status as Task['status'] }),
      ...(input.priority !== undefined && { priority: input.priority as Task['priority'] }),
      ...(input.dueDate !== undefined && { dueDate: input.dueDate as string | null }),
      ...(input.assigneeId !== undefined && { assigneeId: assignee?.id ?? null, assigneeEmail: assignee?.email ?? null }),
      updatedAt: now(),
    }
    state.tasks = state.tasks.map((row) => (row.id === task.id ? next : row))
    return { task: withComputed(next) }
  }
  match = route.match(/^GET \/tasks\/([\w-]+)\/subtasks$/)
  if (match) return { subtasks: state.subtasks[match[1]] ?? [] }
  match = route.match(/^POST \/tasks\/([\w-]+)\/subtasks$/)
  if (match) {
    const taskId = match[1]
    const title = String(input.title ?? '').trim()
    if (!title) fail(400, 'Sub-task title is required.')
    const owner = state.tasks.find((task) => task.id === taskId)?.assigneeEmail ?? null
    const subtask: Subtask = { id: newId('sub'), title, done: false, assigneeEmail: owner }
    state.subtasks = { ...state.subtasks, [taskId]: [...(state.subtasks[taskId] ?? []), subtask] }
    return { subtask }
  }
  match = route.match(/^PATCH \/tasks\/([\w-]+)\/subtasks\/([\w-]+)$/)
  if (match) {
    const [, taskId, subtaskId] = match
    state.subtasks = {
      ...state.subtasks,
      [taskId]: (state.subtasks[taskId] ?? []).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, done: Boolean(input.done) } : subtask,
      ),
    }
    return { subtask: state.subtasks[taskId]?.find((subtask) => subtask.id === subtaskId) }
  }

  if (route === 'GET /planning/documents') return { documents: state.documents.map(summary), canManage: true, canApprove: true }
  if (route === 'POST /planning/documents' || route === 'POST /planning/documents/upload') {
    const form = body instanceof FormData ? body : null
    const kind = (form?.get('kind') ?? input.kind) === 'prd' ? 'prd' : 'brd'
    const source = String(form?.get('sourceDocumentId') ?? input.sourceDocumentId ?? '') || null
    const document: PlanningDocument = {
      id: newId(kind),
      kind,
      title: String(form?.get('title') ?? input.title ?? ''),
      status: kind === 'brd' ? 'approved' : 'draft',
      currentVersion: 1,
      sourceDocumentId: source,
      sourceOutdated: false,
      approvedAt: null,
      updatedAt: now(),
      content: String(input.content ?? (form?.get('file') as File | null)?.name ?? ''),
      fileName: null,
      mimeType: null,
      sourceVersion: source ? 1 : null,
      createdAt: now(),
      versions: [{ version: 1, fileName: null, createdAt: now() }],
    }
    state.documents = [document, ...state.documents]
    record('document', document.id, 'created')
    return { document: summary(document) }
  }
  match = route.match(/^GET \/planning\/documents\/([\w-]+)$/)
  if (match) {
    const document = state.documents.find((row) => row.id === match?.[1])
    if (!document) fail(404, 'Document not found.')
    return { document }
  }
  match = route.match(/^GET \/planning\/documents\/([\w-]+)\/versions\/(\d+)$/)
  if (match) {
    const document = state.documents.find((row) => row.id === match?.[1])
    return { version: { version: Number(match[2]), content: document?.content ?? '', createdAt: now() } }
  }
  match = route.match(/^PATCH \/planning\/documents\/([\w-]+)$/)
  if (match) {
    const id = match[1]
    state.documents = state.documents.map((document) =>
      document.id === id
        ? {
            ...document,
            content: String(input.content ?? document.content),
            currentVersion: document.currentVersion + 1,
            updatedAt: now(),
            versions: [{ version: document.currentVersion + 1, fileName: null, createdAt: now() }, ...document.versions],
          }
        : document,
    )
    record('document', id, 'revised')
    return {}
  }
  match = route.match(/^POST \/planning\/documents\/([\w-]+)\/status$/)
  if (match) {
    const id = match[1]
    const status = input.status as PlanningDocument['status']
    state.documents = state.documents.map((document) =>
      document.id === id ? { ...document, status, approvedAt: status === 'approved' ? now() : null, updatedAt: now() } : document,
    )
    record('document', id, `status:${status}`)
    return {}
  }

  if (route === 'GET /planning/items') return { items: state.items, tasks: demoPlanningTasks(state.tasks) }
  if (route === 'POST /planning/items') {
    const parent = state.items.find((row) => row.id === input.parentId)
    const created: PlanningItem = {
      id: newId(input.kind === 'story' ? 'st' : 'ep'),
      kind: input.kind === 'story' ? 'story' : 'epic',
      parentId: parent?.id ?? null,
      title: String(input.title ?? ''),
      description: String(input.description ?? ''),
      acceptanceCriteria: String(input.acceptanceCriteria ?? ''),
      status: 'draft',
      publishedAt: null,
      sourceDocumentId: String(input.sourceDocumentId ?? ''),
      sourceVersion: 1,
      sourceOutdated: false,
      sourceSection: (input.sourceSection as string | undefined) ?? null,
      participantIds: (input.participantIds as string[] | undefined) ?? [],
      createdAt: now(),
    }
    state.items = [...state.items, created]
    if (created.kind === 'story')
      state.stories = {
        ...state.stories,
        [created.id]: {
          storyId: created.id,
          stage: 'draft',
          userStory: { role: '', action: '', benefit: '' },
          flow: '',
          definitionOfDone: [],
          designs: [],
          designApprovedBy: null,
          designApprovedAt: null,
          contracts: [],
          testCases: [],
        },
      }
    record(created.kind, created.id, 'draft_created')
    return { item: created }
  }
  match = route.match(/^PATCH \/planning\/items\/([\w-]+)$/)
  if (match) {
    const id = match[1]
    state.items = state.items.map((row) => (row.id === id ? { ...row, ...(input as Partial<PlanningItem>) } : row))
    record('item', id, 'updated')
    return {}
  }
  match = route.match(/^POST \/planning\/items\/([\w-]+)\/(publish|rebase)$/)
  if (match) {
    const [, id, action] = match
    if (action === 'publish')
      state.items = state.items.map((row) => (row.id === id || row.parentId === id ? { ...row, publishedAt: now() } : row))
    record('epic', id, action === 'publish' ? 'published' : 'source_reviewed')
    return {}
  }
  if (route === 'POST /planning/task-drafts') return { task: { id: newId('draft') } }
  if (route.startsWith('PATCH /planning/task-drafts/')) return { task: {} }

  match = route.match(/^GET \/planning\/stories\/([\w-]+)$/)

  if (match) {
    const story = state.stories[match[1]]
    if (!story) fail(404, 'Story not found.')
    return { story }
  }
  match = route.match(/^PATCH \/planning\/stories\/([\w-]+)$/)
  if (match) {
    const id = match[1]
    const story = state.stories[id]
    if (!story) fail(404, 'Story not found.')
    const userStory = (input.userStory as StoryDetails['userStory'] | undefined) ?? story.userStory
    const dod = (input.definitionOfDone as Array<{ id?: string; text: string; role: DodItem['role'] }> | undefined)?.map((entry) => ({
      id: entry.id ?? newId('dod'),
      text: entry.text,
      role: entry.role,
      done: story.definitionOfDone.find((current) => current.id === entry.id)?.done ?? false,
    }))
    state.stories = {
      ...state.stories,
      [id]: { ...story, userStory, flow: String(input.flow ?? story.flow), definitionOfDone: dod ?? story.definitionOfDone },
    }
    return { story: state.stories[id] }
  }
  match = route.match(/^POST \/planning\/stories\/([\w-]+)\/approve-design$/)
  if (match) {
    const id = match[1]
    const story = state.stories[id]
    if (!story || story.designs.length === 0) fail(409, 'Attach a design before approving it.')
    state.stories = {
      ...state.stories,
      [id]: { ...story, stage: 'design_approved', designApprovedBy: 'maya@contoh.test', designApprovedAt: now() },
    }
    state.items = state.items.map((row) => (row.id === id ? { ...row, status: 'ready' } : row))
    record('story', id, 'design_approved')
    return { story: state.stories[id] }
  }
  match = route.match(/^PATCH \/planning\/stories\/([\w-]+)\/dod\/([\w-]+)$/)
  if (match) {
    const [, id, itemId] = match
    const story = state.stories[id]
    if (!story) fail(404, 'Story not found.')
    state.stories = {
      ...state.stories,
      [id]: {
        ...story,
        definitionOfDone: story.definitionOfDone.map((entry) => (entry.id === itemId ? { ...entry, done: Boolean(input.done) } : entry)),
      },
    }
    return { story: state.stories[id] }
  }

  match = route.match(/^GET \/planning\/(document|epic|story|task)\/([\w-]+)\/comments$/)

  if (match) return { comments: state.comments[`${match[1]}:${match[2]}`] ?? [] }
  match = route.match(/^POST \/planning\/(document|epic|story|task)\/([\w-]+)\/comments$/)
  if (match) {
    const key = `${match[1]}:${match[2]}`
    const comment: PlanningComment = {
      id: newId('c'),
      parentId: (input.parentId as string | undefined) ?? null,
      body: String(input.body ?? ''),
      isDecision: Boolean(input.isDecision),
      resolvedAt: null,
      createdBy: 'demo-maya',
      authorEmail: 'maya@contoh.test',
      createdAt: now(),
    }
    state.comments = { ...state.comments, [key]: [...(state.comments[key] ?? []), comment] }
    return { id: comment.id }
  }
  match = route.match(/^POST \/planning\/comments\/([\w-]+)\/resolve$/)
  if (match) {
    const id = match[1]
    state.comments = Object.fromEntries(
      Object.entries(state.comments).map(([key, list]) => [
        key,
        list.map((comment) => (comment.id === id ? { ...comment, resolvedAt: now() } : comment)),
      ]),
    )
    return {}
  }
  if (route === 'GET /planning/events') return { events: state.events }

  fail(404, 'Sample data has no answer for this request.')
}
