export type WorkspaceListStatus = 'loading' | 'error' | 'empty' | 'ready'

// Counts over every workspace of the user, not only the pages loaded so far.
export interface WorkspaceCounts {
  total: number
  owned: number
}
