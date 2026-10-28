import { lazy } from 'react'

export { WORKSPACE_TEXT } from './constants/workspace-detail-text.constants'
export { usePendingInviteViewModel } from './viewmodels/use-pending-invite.viewmodel'

// The page and its views load on first visit, so the sign-in and workspace list stay small.
export const WorkspacePage = lazy(() => import('./pages/workspace.page').then((module) => ({ default: module.WorkspacePage })))
