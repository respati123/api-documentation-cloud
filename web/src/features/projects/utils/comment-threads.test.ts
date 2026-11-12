import { describe, expect, test } from 'vitest'
import type { PlanningComment } from '@/features/projects/models/planning.model'
import { buildThreads } from '@/features/projects/utils/comment-threads'

function comment(id: string, parentId: string | null, createdAt: string, author = `${id}@test.dev`): PlanningComment {
  return { id, parentId, body: id, isDecision: false, resolvedAt: null, createdBy: author, authorEmail: author, createdAt }
}

describe('buildThreads', () => {
  test('a reply sits under the comment it answers, even when other comments came in between', () => {
    const threads = buildThreads([
      comment('first', null, '2026-11-12T10:00:00Z'),
      comment('second', null, '2026-11-12T10:01:00Z'),
      comment('reply-first', 'first', '2026-11-12T10:02:00Z'),
    ])

    expect(threads.map((thread) => [thread.root.id, thread.replies.map((reply) => reply.id)])).toEqual([
      ['first', ['reply-first']],
      ['second', []],
    ])
  })

  test('a reply to a reply stays in the same thread and names who it answers', () => {
    const threads = buildThreads([
      comment('root', null, '2026-11-12T10:00:00Z'),
      comment('answer', 'root', '2026-11-12T10:01:00Z', 'arif@test.dev'),
      comment('follow-up', 'answer', '2026-11-12T10:02:00Z'),
    ])

    expect(threads).toHaveLength(1)
    expect(threads[0].replies.map((reply) => [reply.id, reply.replyToAuthor])).toEqual([
      ['answer', null],
      ['follow-up', 'arif@test.dev'],
    ])
  })
})
