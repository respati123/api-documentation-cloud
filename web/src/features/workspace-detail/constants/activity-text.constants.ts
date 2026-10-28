import type { ChangeKind } from '../utils/snapshot-diff'

export const ACTIVITY_TEXT = {
  empty: {
    title: 'activity:empty.title',
    detail: 'activity:empty.detail',
  },
  history: {
    title: 'activity:history.title',
    count: 'activity:history.count',
  },
  actions: {
    restore: 'activity:actions.restore',
    latest: 'activity:actions.latest',
    restored: 'activity:actions.restored',
    restoreFailed: 'activity:actions.restoreFailed',
    confirmTitle: 'activity:actions.confirmTitle',
    confirmDetail: 'activity:actions.confirmDetail',
    confirm: 'activity:actions.confirm',
    cancel: 'activity:actions.cancel',
  },
  detail: {
    loading: 'activity:detail.loading',
    errorTitle: 'activity:detail.errorTitle',
    errorFallback: 'activity:detail.errorFallback',
    noChangesTitle: 'activity:detail.noChangesTitle',
    noChangesDetail: 'activity:detail.noChangesDetail',
    changedItems: 'activity:detail.changedItems',
    previous: 'activity:detail.previous',
    previousNone: 'activity:detail.previousNone',
    beforeCommit: 'activity:detail.beforeCommit',
    committed: 'activity:detail.committed',
    removed: 'activity:detail.removed',
    afterCommit: 'activity:detail.afterCommit',
    empty: 'activity:detail.empty',
  },
} as const

export const ACTIVITY_KIND_TEXT: Record<ChangeKind, string> = {
  added: 'activity:kind.added',
  modified: 'activity:kind.modified',
  deleted: 'activity:kind.deleted',
}
