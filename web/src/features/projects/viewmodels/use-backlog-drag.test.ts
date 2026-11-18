import { act, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { DROP_ROW_PREFIX, useBacklogDrag } from '@/features/projects/viewmodels/use-backlog-drag'

const server = () => ({ s1: ['a', 'b', 'c'], s2: [] as string[], backlog: ['x', 'y'] })

// A drop as the drag library reports it: the row that was held, and the row or list it was let go on.
const let_go = (id: string, onto: string, canceled = false) =>
  ({ canceled, operation: { source: { id }, target: onto === '' ? null : { id: onto } } }) as never
const row = (id: string) => `${DROP_ROW_PREFIX}${id}`

function setup(enabled = true) {
  const drop = vi.fn()
  const hook = renderHook(({ lists }) => useBacklogDrag(lists, drop, enabled), { initialProps: { lists: server() } })
  return { hook, drop }
}

describe('useBacklogDrag', () => {
  test('shows the lists as the server has them until something is dropped', () => {
    const { hook } = setup()
    expect(hook.result.current.lists).toEqual(server())
  })

  test('a row dropped on a row of another list takes its place, and the neighbours are named', () => {
    const { hook, drop } = setup()
    act(() => hook.result.current.onDragEnd(let_go('b', row('y'))))
    expect(hook.result.current.lists).toEqual({ s1: ['a', 'c'], s2: [], backlog: ['x', 'b', 'y'] })
    expect(drop).toHaveBeenCalledWith(expect.objectContaining({ issueId: 'b', from: 's1', to: 'backlog', afterId: 'x', beforeId: 'y' }))
  })

  test('moving down in the same list lands after the row it was dropped on, and moving up lands before it', () => {
    const down = setup()
    act(() => down.hook.result.current.onDragEnd(let_go('a', row('c'))))
    expect(down.hook.result.current.lists.s1).toEqual(['b', 'c', 'a'])
    expect(down.drop).toHaveBeenCalledWith(expect.objectContaining({ afterId: 'c', beforeId: null }))

    const up = setup()
    act(() => up.hook.result.current.onDragEnd(let_go('c', row('a'))))
    expect(up.hook.result.current.lists.s1).toEqual(['c', 'a', 'b'])
    expect(up.drop).toHaveBeenCalledWith(expect.objectContaining({ afterId: null, beforeId: 'a' }))
  })

  test('a row dropped on a list goes to the end of it, and an empty list has no neighbours', () => {
    const { hook, drop } = setup()
    act(() => hook.result.current.onDragEnd(let_go('a', 'backlog')))
    expect(hook.result.current.lists.backlog).toEqual(['x', 'y', 'a'])
    expect(drop).toHaveBeenLastCalledWith(expect.objectContaining({ to: 'backlog', afterId: 'y', beforeId: null }))

    const empty = setup()
    act(() => empty.hook.result.current.onDragEnd(let_go('a', 's2')))
    expect(empty.hook.result.current.lists.s2).toEqual(['a'])
    expect(empty.drop).toHaveBeenCalledWith(expect.objectContaining({ afterId: null, beforeId: null }))
  })

  test('the moved order stays until the server has answered, then the server order is shown', () => {
    const { hook, drop } = setup()
    act(() => hook.result.current.onDragEnd(let_go('b', 's2')))
    expect(hook.result.current.lists.s2).toEqual(['b'])
    act(() => drop.mock.calls[0][0].onSettled())
    expect(hook.result.current.lists).toEqual(server())
  })

  test('a drop on itself, on nothing, or on a row that is not listed asks nothing of the server', () => {
    const { hook, drop } = setup()
    act(() => hook.result.current.onDragEnd(let_go('b', row('b'))))
    act(() => hook.result.current.onDragEnd(let_go('b', '')))
    act(() => hook.result.current.onDragEnd(let_go('b', row('nowhere'))))
    act(() => hook.result.current.onDragEnd(let_go('ghost', 's2')))
    expect(drop).not.toHaveBeenCalled()
    expect(hook.result.current.lists).toEqual(server())
  })

  test('a cancelled drag changes nothing', () => {
    const { hook, drop } = setup()
    act(() => hook.result.current.onDragEnd(let_go('b', 'backlog', true)))
    expect(hook.result.current.lists).toEqual(server())
    expect(drop).not.toHaveBeenCalled()
  })

  test('does nothing while dragging is switched off', () => {
    const { hook, drop } = setup(false)
    act(() => hook.result.current.onDragEnd(let_go('b', 'backlog')))
    expect(drop).not.toHaveBeenCalled()
  })

  test('a new answer from the server replaces a moved order', () => {
    const { hook } = setup()
    act(() => hook.result.current.onDragEnd(let_go('b', 'backlog')))
    hook.rerender({ lists: { s1: ['a', 'c'], s2: [], backlog: ['x', 'y', 'b'] } })
    expect(hook.result.current.lists.backlog).toEqual(['x', 'y', 'b'])
  })
})
