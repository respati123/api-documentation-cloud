import { create } from 'zustand'

// Which workspaces show the sample project instead of their own data. Kept in memory only, so a reload returns to real data.
interface PlanningDemoState {
  workspaceIds: string[]
  setDemo: (workspaceId: string, on: boolean) => void
}

export const usePlanningDemoStore = create<PlanningDemoState>((set) => ({
  workspaceIds: [],
  setDemo: (workspaceId, on) =>
    set((state) => ({
      workspaceIds: on ? [...new Set([...state.workspaceIds, workspaceId])] : state.workspaceIds.filter((id) => id !== workspaceId),
    })),
}))

export function isDemoWorkspace(workspaceId: string): boolean {
  return usePlanningDemoStore.getState().workspaceIds.includes(workspaceId)
}

export function useSampleMode(workspaceId: string): boolean {
  return usePlanningDemoStore((state) => state.workspaceIds.includes(workspaceId))
}
