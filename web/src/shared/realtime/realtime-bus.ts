import { create } from 'zustand'

export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'offline'
type Listener = (event: unknown) => void

const listeners = new Set<Listener>()

// Every feature listens on the one socket the app keeps open. Each listener validates the events it cares about.
export function subscribeRealtime(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitRealtime(event: unknown) {
  for (const listener of listeners) listener(event)
}

export const useRealtimeStatusStore = create<{ status: RealtimeStatus; setStatus: (status: RealtimeStatus) => void }>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}))
