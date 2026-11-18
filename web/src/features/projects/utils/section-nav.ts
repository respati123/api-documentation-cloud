import { PLANNING_TEXT } from '@/features/projects/constants/planning-text.constants'
import type { ProjectSection } from '@/features/projects/viewmodels/use-planning.viewmodel'

// With the agile screens the first tab is the Overview, the documents are Discovery, and the board is the Board.
const AGILE_NAME: Partial<Record<ProjectSection, string>> = {
  flow: PLANNING_TEXT.nav.overview,
  documents: PLANNING_TEXT.nav.discovery,
  board: PLANNING_TEXT.nav.agileBoard,
}

export function navLabelKey(section: ProjectSection, agile: boolean): string {
  return (agile ? AGILE_NAME[section] : undefined) ?? PLANNING_TEXT.nav[section]
}
