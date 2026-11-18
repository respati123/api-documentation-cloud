import { useState } from 'react'
import { dropPlacement } from '@/features/projects/utils/backlog'

export type DragLists = Record<string, string[]>

// A row is a place to drop as well as a thing to hold. Its drop id carries this prefix, and a list's drop id is its group.
export const DROP_ROW_PREFIX = 'row:'

interface DragEndEvent {
  canceled?: boolean
  operation: { source: { id: string | number } | null; target: { id: string | number } | null }
}

export interface Drop {
  issueId: string
  from: string
  to: string
  afterId: string | null
  beforeId: string | null
  // Called when the server has answered, so the order shown goes back to the server's.
  onSettled: () => void
}

// The order of the backlog lists around a drop. The drag library only carries the row along with the pointer and reports
// where it was let go, so the place is worked out here: on a row it takes that row's place, on a list it goes to the end.
// The new order shows at once and stays until the server has answered, or the row would jump back for a moment.
export function useBacklogDrag(server: DragLists, drop: (input: Drop) => void, enabled: boolean) {
  const signature = JSON.stringify(server)
  const [moved, setMoved] = useState<{ signature: string; lists: DragLists } | null>(null)
  const lists = moved && moved.signature === signature ? moved.lists : server
  const groupOf = (id: string) => Object.keys(lists).find((key) => lists[key].includes(id))

  return {
    lists,
    onDragEnd: (event: DragEndEvent) => {
      const { source, target } = event.operation
      if (!enabled || event.canceled || !source || !target) return
      const id = String(source.id)
      const from = groupOf(id)
      const overId = String(target.id)
      if (!from || overId === `${DROP_ROW_PREFIX}${id}`) return

      let to: string | undefined
      let index = 0
      const others = (group: string) => lists[group].filter((other) => other !== id)
      if (overId.startsWith(DROP_ROW_PREFIX)) {
        const rowId = overId.slice(DROP_ROW_PREFIX.length)
        to = groupOf(rowId)
        if (!to) return
        const beside = others(to).indexOf(rowId)
        // Going down in its own list, the row lands after the one it was let go on. Anywhere else it lands before it.
        index = from === to && lists[to].indexOf(id) < lists[to].indexOf(rowId) ? beside + 1 : beside
      } else if (overId in lists) {
        to = overId
        index = others(to).length
      } else return

      const next = {
        ...Object.fromEntries(Object.entries(lists).map(([key, ids]) => [key, ids.filter((other) => other !== id)])),
      }
      next[to] = [...next[to].slice(0, index), id, ...next[to].slice(index)]
      setMoved({ signature, lists: next })
      drop({ issueId: id, from, to, ...dropPlacement(next, to, id, index), onSettled: () => setMoved(null) })
    },
  }
}
