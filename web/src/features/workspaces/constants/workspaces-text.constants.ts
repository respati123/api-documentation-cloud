import type { WorkspaceRole } from '@/shared/models/workspace.model'

export const WORKSPACES_PAGE_TEXT = {
  overview: {
    title: 'overview.title',
    subtitle: 'overview.subtitle',
  },
  list: {
    title: 'list.title',
    subtitle: 'list.subtitle',
  },
} as const

export const WORKSPACES_TEXT = {
  list: {
    create: 'list.create',
    emptyTitle: 'list.emptyTitle',
    emptyDetail: 'list.emptyDetail',
    open: 'list.open',
    updatedUnavailable: 'list.updatedUnavailable',
    columns: {
      workspace: 'list.columns.workspace',
      role: 'list.columns.role',
      updated: 'list.columns.updated',
      action: 'list.columns.action',
    },
  },
  summary: {
    total: 'summary.total',
    owned: 'summary.owned',
    shared: 'summary.shared',
    totalHint: 'summary.totalHint',
    ownedHint: 'summary.ownedHint',
    sharedHint: 'summary.sharedHint',
  },
  create: {
    title: 'create.title',
    description: 'create.description',
    nameLabel: 'create.nameLabel',
    namePlaceholder: 'create.namePlaceholder',
    cancel: 'create.cancel',
    submit: 'create.submit',
    busy: 'create.busy',
    ready: 'workspaces:create.ready',
  },
} as const

export const WORKSPACES_ROLE_TEXT = {
  owner: 'workspaces:roles.owner',
  editor: 'workspaces:roles.editor',
  viewer: 'workspaces:roles.viewer',
} as const satisfies Record<WorkspaceRole, string>
