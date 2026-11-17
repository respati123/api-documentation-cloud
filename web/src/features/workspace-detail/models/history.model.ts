import type { ChangeKind } from '@/features/workspace-detail/utils/snapshot-diff'
import type { DiffBlock, SplitRow } from '@/features/workspace-detail/utils/text-diff'
import type { ApiNode } from '@/shared/models/cloud-workspace.model'

export type DiffLayout = 'split' | 'unified'

export interface DiffStats {
  added: number
  removed: number
}

export type FileDiffBlock = DiffBlock & { splitRows: SplitRow[] }

// One changed collection item in a commit, shaped like one file in a GitHub commit.
export interface FileDiff {
  id: string
  kind: ChangeKind
  nodeKind: ApiNode['kind']
  method: string
  name: string
  url: string
  path: string[]
  stats: DiffStats
  blocks: FileDiffBlock[]
}

export interface ChangeTreeGroup {
  id: string
  path: string[]
  files: Array<Pick<FileDiff, 'id' | 'kind' | 'nodeKind' | 'method' | 'name' | 'stats'>>
}

export interface CommitRow {
  id: string
  shortId: string
  message: string
  authorEmail: string
  when: string
  isLatest: boolean
}

export interface CommitDayGroup {
  key: string
  label: string
  commits: CommitRow[]
}
