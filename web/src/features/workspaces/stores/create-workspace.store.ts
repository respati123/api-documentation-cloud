import { create } from 'zustand'

interface CreateWorkspaceState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useCreateWorkspaceStore = create<CreateWorkspaceState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
