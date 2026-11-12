import { CornerDownRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { usePlanningCommentsViewModel } from '@/features/projects/viewmodels/use-planning-comments.viewmodel'
import { Avatar, Panel } from '@/features/projects/views/planning-marks.view'
import { Badge } from '@/shared/components/primitives/badge'
import { Button } from '@/shared/components/primitives/button'
import { Checkbox } from '@/shared/components/primitives/checkbox'
import { Label } from '@/shared/components/primitives/label'
import { Skeleton } from '@/shared/components/primitives/skeleton'
import { Textarea } from '@/shared/components/primitives/textarea'
import { cn } from '@/shared/utils/cn'

export type PlanningCommentsProps = ReturnType<typeof usePlanningCommentsViewModel>
type Thread = PlanningCommentsProps['threads'][number]
type Message = Omit<Thread, 'replies' | 'replying'> & { replyTo?: string | null }
type MentionList = PlanningCommentsProps['mention']

// A chat-style discussion: each comment starts a thread, replies stay under it, and the reply box opens in place.
export function PlanningCommentsView({ vm, testId }: { vm: PlanningCommentsProps; testId: string }) {
  const { t } = useTranslation('planning')
  return (
    <Panel title={t(PLANNING_TEXT.comments.title)} action={<Badge variant="secondary">{vm.count}</Badge>} testId={testId} clip={false}>
      {vm.isLoading ? (
        <div className="grid gap-3 px-[18px] py-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-2/3" />
        </div>
      ) : vm.threads.length === 0 ? (
        <p className="px-[18px] pt-5 pb-2 text-sm text-muted-foreground">{t(PLANNING_TEXT.comments.empty)}</p>
      ) : (
        <ol className="divide-y divide-border">
          {vm.threads.map((thread) => (
            <li key={thread.id} className="px-[18px] py-4" data-testid={`planning-thread-${thread.id}`}>
              <CommentMessage
                message={thread}
                size="lg"
                onReply={() => vm.onReply(thread.id, thread.id)}
                onResolve={() => vm.onResolve(thread.id)}
              />
              {(thread.replies.length > 0 || thread.replying) && (
                <ol className="mt-3 ml-[15px] grid gap-3 border-l-2 border-border pl-[27px]">
                  {thread.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentMessage
                        message={reply}
                        size="sm"
                        onReply={() => vm.onReply(thread.id, reply.id)}
                        onResolve={() => vm.onResolve(reply.id)}
                      />
                    </li>
                  ))}
                  {thread.replying && (
                    <li>
                      <ReplyBox
                        vm={vm}
                        replyingTo={thread.replying.to}
                        body={thread.replying.body}
                        mention={thread.replying.mention}
                        threadId={thread.id}
                      />
                    </li>
                  )}
                </ol>
              )}
            </li>
          ))}
        </ol>
      )}

      <form
        className="grid gap-2.5 rounded-b-xl border-t border-border bg-muted/30 px-[18px] py-4"
        onSubmit={(event) => {
          event.preventDefault()
          vm.onSend()
        }}
      >
        <MentionField
          label={t(PLANNING_TEXT.comments.placeholder)}
          testId="planning-comment-body"
          className="min-h-20 resize-none bg-card"
          value={vm.body}
          mention={vm.mention}
          onChange={vm.setBody}
          onPick={vm.onPickMention}
          onMentionKey={vm.onMentionKey}
          onSubmitShortcut={() => vm.canSend && vm.onSend()}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {vm.canMarkDecision ? (
            <Label className="text-[13px] font-normal text-muted-foreground">
              <Checkbox
                data-testid="planning-comment-decision"
                checked={vm.decision}
                onChange={(event) => vm.setDecision(event.target.checked)}
              />
              {t(PLANNING_TEXT.comments.markDecision)}
            </Label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" data-testid="planning-comment-send" disabled={!vm.canSend}>
            {t(PLANNING_TEXT.comments.send)}
          </Button>
        </div>
        {vm.error && (
          <p role="alert" className="text-sm text-destructive">
            {vm.error}
          </p>
        )}
      </form>
    </Panel>
  )
}

function CommentMessage({
  message,
  size,
  onReply,
  onResolve,
}: {
  message: Message
  size: 'lg' | 'sm'
  onReply: () => void
  onResolve: () => void
}) {
  const { t } = useTranslation('planning')
  return (
    <article className={cn('grid grid-cols-[auto_minmax(0,1fr)] gap-3', message.isResolved && 'opacity-60')}>
      <Avatar name={message.authorEmail} className={size === 'lg' ? 'size-8 text-xs' : 'size-6 text-[10px]'} />
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="font-semibold">{message.author}</span>
          {message.isMine && <span className="text-xs text-muted-foreground">· {t(PLANNING_TEXT.comments.you)}</span>}
          <span className="text-xs text-muted-foreground">{message.when}</span>
          {message.isDecision && <Badge variant="success">{t(PLANNING_TEXT.comments.decision)}</Badge>}
          {message.isResolved && <Badge variant="outline">{t(PLANNING_TEXT.comments.resolved)}</Badge>}
        </div>
        {message.replyTo && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <CornerDownRight className="size-3" />
            {t(PLANNING_TEXT.comments.replyingTo, { name: message.replyTo })}
          </span>
        )}
        <p
          className={cn(
            'text-sm leading-relaxed whitespace-pre-wrap',
            message.isDecision && 'rounded-lg border-l-[3px] border-success bg-success/5 px-3 py-2',
          )}
        >
          {message.parts.map((part, index) =>
            part.mention ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts of one message keep their order
              <span key={index} className="rounded bg-accent px-1 font-medium text-accent-foreground">
                {part.text}
              </span>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: parts of one message keep their order
              <span key={index}>{part.text}</span>
            ),
          )}
        </p>
        <div className="-ml-2 flex gap-0.5">
          <Button
            size="xs"
            variant="ghost"
            className="text-muted-foreground"
            data-testid={`planning-comment-reply-${message.id}`}
            onClick={onReply}
          >
            {t(PLANNING_TEXT.comments.reply)}
          </Button>
          {message.canResolve && (
            <Button
              size="xs"
              variant="ghost"
              className="text-muted-foreground"
              data-testid={`planning-comment-resolve-${message.id}`}
              onClick={onResolve}
            >
              {t(PLANNING_TEXT.comments.resolve)}
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}

function ReplyBox({
  vm,
  replyingTo,
  body,
  mention,
  threadId,
}: {
  vm: PlanningCommentsProps
  replyingTo: string
  body: string
  mention: MentionList
  threadId: string
}) {
  const { t } = useTranslation('planning')
  return (
    <form
      className="grid gap-2 rounded-xl border border-border bg-card p-2.5"
      data-testid={`planning-reply-box-${threadId}`}
      onSubmit={(event) => {
        event.preventDefault()
        vm.onSendReply()
      }}
    >
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <CornerDownRight className="size-3" />
        {t(PLANNING_TEXT.comments.replyingTo, { name: replyingTo })}
      </span>
      <MentionField
        autoFocus
        label={t(PLANNING_TEXT.comments.replyPlaceholder)}
        testId="planning-reply-body"
        className="min-h-16 resize-none border-0 px-1 shadow-none focus-visible:ring-0"
        value={body}
        mention={mention}
        onChange={vm.setReplyBody}
        onPick={vm.onPickMention}
        onMentionKey={vm.onMentionKey}
        onEscape={vm.onCancelReply}
        onSubmitShortcut={() => vm.canSendReply && vm.onSendReply()}
      />
      <div className="flex justify-end gap-1.5">
        <Button type="button" size="sm" variant="ghost" data-testid="planning-reply-cancel" onClick={vm.onCancelReply}>
          {t(PLANNING_TEXT.comments.cancel)}
        </Button>
        <Button type="submit" size="sm" data-testid="planning-reply-send" disabled={!vm.canSendReply}>
          {t(PLANNING_TEXT.comments.sendReply)}
        </Button>
      </div>
    </form>
  )
}

// A textarea that suggests workspace members after "@". The list sits under the field; the keyboard drives it.
function MentionField({
  label,
  testId,
  className,
  value,
  mention,
  autoFocus,
  onChange,
  onPick,
  onMentionKey,
  onEscape,
  onSubmitShortcut,
}: {
  label: string
  testId: string
  className: string
  value: string
  mention: MentionList
  autoFocus?: boolean
  onChange: (text: string, caret: number) => void
  onPick: (memberId: string) => void
  onMentionKey: (key: string) => boolean
  onEscape?: () => void
  onSubmitShortcut: () => void
}) {
  return (
    <div className="relative">
      <Textarea
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={label}
        data-testid={testId}
        className={className}
        value={value}
        aria-expanded={mention !== null}
        aria-autocomplete="list"
        onChange={(event) => onChange(event.target.value, event.target.selectionStart ?? event.target.value.length)}
        onKeyDown={(event) => {
          if (onMentionKey(event.key)) {
            event.preventDefault()
            return
          }
          if (event.key === 'Escape') onEscape?.()
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            onSubmitShortcut()
          }
        }}
      />
      {mention && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute bottom-full left-0 z-30 mb-1 grid w-64 gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md"
        >
          {mention.items.map((member, index) => (
            <Button
              key={member.id}
              type="button"
              variant="ghost"
              role="option"
              aria-selected={index === mention.activeIndex}
              data-testid={`planning-mention-${member.id}`}
              className={cn(
                'h-auto w-full justify-start gap-2 px-2 py-1.5 text-left font-normal',
                index === mention.activeIndex && 'bg-muted',
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(member.id)}
            >
              <Avatar name={member.email} className="size-6 text-[10px]" />
              <span className="grid min-w-0">
                <span className="truncate text-sm font-medium">@{member.handle}</span>
                <span className="truncate text-xs text-muted-foreground">{member.email}</span>
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
