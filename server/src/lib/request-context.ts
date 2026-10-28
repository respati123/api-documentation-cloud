import { AsyncLocalStorage } from 'node:async_hooks'

const store = new AsyncLocalStorage<{ requestId: string }>()

export function runWithRequestId<T>(requestId: string, fn: () => Promise<T>): Promise<T> {
  return store.run({ requestId }, fn)
}

export function currentRequestId(): string {
  return store.getStore()?.requestId ?? ''
}
