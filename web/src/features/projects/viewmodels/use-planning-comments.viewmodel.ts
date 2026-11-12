import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { PlanningComment, TargetKind } from '@/features/projects/models/planning.model'
import { planningService } from '@/features/projects/services/planning.service'
import { buildThreads } from '@/features/projects/utils/comment-threads'
import {
  activeMention,
  bodyParts,
  handleOf,
  insertMention,
  type MentionMember,
  mentionedIds,
  mentionSuggestions,
} from '@/features/projects/utils/mentions'
import { planningKeys } from '@/features/projects/viewmodels/planning-keys'
import { readErrorMessage } from '@/shared/utils/error-message'
import { formatRelativeDate } from '@/shared/utils/format'

export interface CommentTarget {
  kind: TargetKind
  id: string
}

interface ReplyDraft {
  threadId: string
  parentId: string
  parentAuthor: string
  body: string
}

// "main" is the new-comment box; a thread id is the reply box open in that thread.
interface MentionState {
  box: string
  query: string
  start: number
  caret: number
  index: number
}

const MAIN = 'main'

// One discussion at a time: the document, item, or task that is open. The query stays idle while nothing is open.
export function usePlanningCommentsViewModel(
  workspaceId: string,
  target: CommentTarget | null,
  canManage: boolean,
  members: MentionMember[],
) {
  const { t, i18n } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const userId = useAuthSessionStore((state) => state.userId)
  const queryClient = useQueryClient()
  const [body, setBodyText] = useState('')
  const [decision, setDecision] = useState(false)
  const [reply, setReply] = useState<ReplyDraft | null>(null)
  const [mention, setMention] = useState<MentionState | null>(null)
  const key = target ? planningKeys.comments(workspaceId, target.kind, target.id) : ['planning', workspaceId, 'comments', 'none']
  const mentionable = members.filter((member) => member.id !== userId)

  const comments = useQuery({
    queryKey: key,
    queryFn: () => (target ? planningService.comments(token, workspaceId, target.kind, target.id) : Promise.resolve([])),
    enabled: target !== null,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const send = (text: string, options: { isDecision?: boolean; parentId?: string }) =>
    planningService.comment(
      token,
      workspaceId,
      target?.kind ?? 'document',
      target?.id ?? '',
      text.trim(),
      options.isDecision ?? false,
      options.parentId,
      mentionedIds(text, mentionable),
    )
  const post = useMutation({
    mutationFn: () => send(body, { isDecision: decision }),
    onSuccess: async () => {
      setBodyText('')
      setDecision(false)
      await refresh()
    },
  })
  const postReply = useMutation({
    mutationFn: (draft: ReplyDraft) => send(draft.body, { parentId: draft.parentId }),
    onSuccess: async () => {
      setReply(null)
      await refresh()
    },
  })
  const resolve = useMutation({ mutationFn: (id: string) => planningService.resolveComment(token, workspaceId, id), onSuccess: refresh })

  const trackMention = (box: string, text: string, caret: number) => {
    const found = activeMention(text, caret)
    setMention(found ? { box, query: found.query, start: found.start, caret, index: 0 } : null)
  }
  const suggestions = mention ? mentionSuggestions(mentionable, mention.query) : []
  const textOf = (box: string) => (box === MAIN ? body : reply?.threadId === box ? reply.body : '')
  const writeText = (box: string, text: string) => {
    if (box === MAIN) setBodyText(text)
    else setReply((current) => current && { ...current, body: text })
  }
  const pick = (member: MentionMember) => {
    if (!mention) return
    const next = insertMention(textOf(mention.box), mention.start, mention.caret, handleOf(member))
    writeText(mention.box, next.text)
    setMention(null)
  }

  const list = comments.data ?? []
  const failure = post.error ?? postReply.error ?? resolve.error ?? comments.error
  const view = (comment: PlanningComment) => ({
    id: comment.id,
    author: comment.authorEmail.split('@')[0],
    authorEmail: comment.authorEmail,
    isMine: comment.createdBy === userId,
    parts: bodyParts(comment.body, members),
    when: formatRelativeDate(comment.createdAt, i18n.language) ?? '',
    isDecision: comment.isDecision,
    isResolved: comment.resolvedAt !== null,
    canResolve: comment.resolvedAt === null && (canManage || comment.createdBy === userId),
  })
  const mentionFor = (box: string) =>
    mention?.box === box && suggestions.length > 0
      ? {
          items: suggestions.map((member) => ({ id: member.id, handle: handleOf(member), email: member.email })),
          activeIndex: Math.min(mention.index, suggestions.length - 1),
        }
      : null

  return {
    threads: buildThreads(list).map((thread) => ({
      ...view(thread.root),
      replies: thread.replies.map((item) => ({ ...view(item), replyTo: item.replyToAuthor?.split('@')[0] ?? null })),
      replying:
        reply?.threadId === thread.root.id ? { to: reply.parentAuthor, body: reply.body, mention: mentionFor(thread.root.id) } : null,
    })),
    count: list.length,
    decisions: list.filter((comment) => comment.isDecision && comment.resolvedAt === null),
    isLoading: comments.isPending && target !== null,
    body,
    setBody: (text: string, caret: number) => {
      setBodyText(text)
      trackMention(MAIN, text, caret)
    },
    mention: mentionFor(MAIN),
    canMarkDecision: canManage,
    decision,
    setDecision,
    canSend: Boolean(body.trim()) && !post.isPending,
    onSend: () => post.mutate(),
    onReply: (threadId: string, parentId: string) => {
      const parent = list.find((comment) => comment.id === parentId)
      const author = parent?.authorEmail.split('@')[0] ?? ''
      // Replying to someone else starts with their handle, so they are notified like any mention.
      const prefill = parent && parent.createdBy !== userId ? `@${author} ` : ''
      setReply({ threadId, parentId, parentAuthor: author, body: prefill })
      setMention(null)
    },
    setReplyBody: (text: string, caret: number) => {
      setReply((current) => current && { ...current, body: text })
      if (reply) trackMention(reply.threadId, text, caret)
    },
    onCancelReply: () => {
      setReply(null)
      setMention(null)
    },
    canSendReply: Boolean(reply?.body.trim()) && !postReply.isPending,
    onSendReply: () => reply && postReply.mutate(reply),
    onPickMention: (memberId: string) => {
      const member = suggestions.find((item) => item.id === memberId)
      if (member) pick(member)
    },
    // Arrow keys move through the suggestions, Enter or Tab picks, Escape closes. Returns true when the key was used.
    onMentionKey: (key: string): boolean => {
      if (!mention || suggestions.length === 0) return false
      if (key === 'ArrowDown' || key === 'ArrowUp') {
        const step = key === 'ArrowDown' ? 1 : -1
        setMention({ ...mention, index: (mention.index + step + suggestions.length) % suggestions.length })
        return true
      }
      if (key === 'Enter' || key === 'Tab') {
        pick(suggestions[Math.min(mention.index, suggestions.length - 1)])
        return true
      }
      if (key === 'Escape') {
        setMention(null)
        return true
      }
      return false
    },
    onResolve: (id: string) => resolve.mutate(id),
    error: failure ? readErrorMessage(failure, t(PLANNING_TEXT.error)) : null,
  }
}
