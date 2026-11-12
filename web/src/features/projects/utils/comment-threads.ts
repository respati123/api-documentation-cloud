import type { PlanningComment } from '@/features/projects/models/planning.model'

export interface CommentThread {
  root: PlanningComment
  replies: Array<PlanningComment & { replyToAuthor: string | null }>
}

// Groups comments into one level of threads, oldest first. A reply to a reply joins the same thread
// and keeps the name of the person it answers, so the conversation still reads in order.
export function buildThreads(comments: PlanningComment[]): CommentThread[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]))
  const rootOf = (comment: PlanningComment): PlanningComment => {
    let current = comment
    const seen = new Set<string>()
    while (current.parentId && byId.has(current.parentId) && !seen.has(current.id)) {
      seen.add(current.id)
      current = byId.get(current.parentId) as PlanningComment
    }
    return current
  }
  const ordered = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const threads = new Map<string, CommentThread>()
  for (const comment of ordered) {
    const root = rootOf(comment)
    if (root.id === comment.id) threads.set(comment.id, { root: comment, replies: threads.get(comment.id)?.replies ?? [] })
    else {
      const thread = threads.get(root.id) ?? { root, replies: [] }
      const parent = comment.parentId ? byId.get(comment.parentId) : undefined
      thread.replies.push({ ...comment, replyToAuthor: parent && parent.id !== root.id ? parent.authorEmail : null })
      threads.set(root.id, thread)
    }
  }
  return [...threads.values()]
}
