export const NOTIFICATIONS_TEXT = {
  title: 'notifications:title',
  open: 'notifications:open',
  empty: 'notifications:empty',
  markAll: 'notifications:markAll',
  error: 'notifications:error',
} as const

export const NOTIFICATION_KIND_TEXT: Record<string, string> = {
  mcp_key_ready: 'notifications:kind.mcp_key_ready',
  comment_mention: 'notifications:kind.comment_mention',
  comment_reply: 'notifications:kind.comment_reply',
  task_comment: 'notifications:kind.task_comment',
  task_assigned: 'notifications:kind.task_assigned',
  design_approved: 'notifications:kind.design_approved',
}

export const UNKNOWN_NOTIFICATION_TEXT = 'notifications:kind.unknown'
