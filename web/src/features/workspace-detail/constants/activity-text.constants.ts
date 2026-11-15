import type { DiffLayout } from '@/features/workspace-detail/models/history.model'
import type { ChangeKind } from '@/features/workspace-detail/utils/snapshot-diff'

export const ACTIVITY_TEXT = {
  empty: {
    title: 'activity:empty.title',
    detail: 'activity:empty.detail',
    branchTitle: 'activity:empty.branchTitle',
    branchDetail: 'activity:empty.branchDetail',
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
    retry: 'activity:actions.retry',
  },
  list: {
    title: 'activity:list.title',
    count: 'activity:list.count',
    day: 'activity:list.day',
    latest: 'activity:list.latest',
    copyId: 'activity:list.copyId',
    copied: 'activity:list.copied',
    open: 'activity:list.open',
    unknownAuthor: 'activity:list.unknownAuthor',
  },
  commit: {
    back: 'activity:commit.back',
    committed: 'activity:commit.committed',
    parent: 'activity:commit.parent',
    commitId: 'activity:commit.commitId',
    summary: 'activity:commit.summary',
    additions: 'activity:commit.additions',
    deletions: 'activity:commit.deletions',
    tree: 'activity:commit.tree',
    root: 'activity:commit.root',
    viewed: 'activity:commit.viewed',
    collapse: 'activity:commit.collapse',
    expand: 'activity:commit.expand',
    expandLines: 'activity:commit.expandLines',
    folder: 'activity:commit.folder',
    jumpTo: 'activity:commit.jumpTo',
  },
  layout: {
    label: 'activity:layout.label',
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

export const ACTIVITY_KIND_SHORT_TEXT: Record<ChangeKind, string> = {
  added: 'activity:kindShort.added',
  modified: 'activity:kindShort.modified',
  deleted: 'activity:kindShort.deleted',
}

export const DIFF_LAYOUT_TEXT: Record<DiffLayout, string> = {
  split: 'activity:layout.split',
  unified: 'activity:layout.unified',
}
