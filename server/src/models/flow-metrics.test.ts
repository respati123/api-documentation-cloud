import { describe, expect, test } from 'bun:test'
import { cumulativeFlow, cycleTimeDays, type FlowEvent, type FlowItem, summarize, throughputPerDay, workItemAges } from '@/models/flow-metrics'

const at = (day: string, time = '12:00:00') => new Date(`${day}T${time}Z`)
const item = (id: string, created: string, status: string): FlowItem => ({ id, createdAt: at(created), status })
const move = (issueId: string, toStatus: string, day: string, time = '12:00:00'): FlowEvent => ({ issueId, toStatus, at: at(day, time) })

describe('cumulativeFlow', () => {
  test('counts the items of each category at the end of each day', () => {
    const items = [item('a', '2026-07-01', 'done'), item('b', '2026-07-01', 'in_progress'), item('c', '2026-07-02', 'todo')]
    const events = [move('a', 'in_progress', '2026-07-02'), move('a', 'done', '2026-07-03'), move('b', 'in_progress', '2026-07-03')]
    const flow = cumulativeFlow(items, events, ['2026-07-01', '2026-07-02', '2026-07-03'])
    expect(flow).toEqual([
      { date: '2026-07-01', todo: 2, in_progress: 0, done: 0 },
      { date: '2026-07-02', todo: 2, in_progress: 1, done: 0 },
      { date: '2026-07-03', todo: 1, in_progress: 1, done: 1 },
    ])
  })

  test('an item that does not exist yet is not counted, and a status the page does not know counts as todo', () => {
    const flow = cumulativeFlow([item('a', '2026-07-05', 'weird')], [], ['2026-07-04', '2026-07-05'])
    expect(flow.map((day) => day.todo)).toEqual([0, 1])
  })
})

describe('cycleTimeDays', () => {
  test('runs from the first move out of todo to the move to done', () => {
    const events = [move('a', 'in_progress', '2026-07-01', '12:00:00'), move('a', 'in_review', '2026-07-02'), move('a', 'done', '2026-07-04', '12:00:00')]
    expect(cycleTimeDays(events)).toBe(3)
  })

  test('is zero when the item jumps straight to done, and null when it is not done', () => {
    expect(cycleTimeDays([move('a', 'done', '2026-07-01')])).toBe(0)
    expect(cycleTimeDays([move('a', 'in_progress', '2026-07-01')])).toBeNull()
    expect(cycleTimeDays([move('a', 'in_progress', '2026-07-01'), move('a', 'done', '2026-07-02'), move('a', 'in_progress', '2026-07-03')])).toBeNull()
    expect(cycleTimeDays([])).toBeNull()
  })

  test('is unknown, not zero, when the only record is a move whose starting status nobody knew', () => {
    expect(cycleTimeDays([{ ...move('a', 'done', '2026-07-01'), fromStatus: null }])).toBeNull()
    expect(cycleTimeDays([{ ...move('a', 'done', '2026-07-01'), fromStatus: 'todo' }])).toBe(0)
  })

  test('counts from the first start, even when the item went back to todo in between', () => {
    const events = [move('a', 'in_progress', '2026-07-01'), move('a', 'todo', '2026-07-02'), move('a', 'in_progress', '2026-07-03'), move('a', 'done', '2026-07-05')]
    expect(cycleTimeDays(events)).toBe(4)
  })
})

describe('workItemAges', () => {
  test('is the time an unfinished item has been in progress, oldest first', () => {
    const items = [item('a', '2026-06-01', 'in_progress'), item('b', '2026-06-01', 'in_review'), item('c', '2026-06-01', 'todo'), item('d', '2026-06-01', 'done')]
    const events = [move('a', 'in_progress', '2026-07-05'), move('b', 'in_review', '2026-07-01'), move('d', 'done', '2026-07-02')]
    expect(workItemAges(items, events, at('2026-07-08'))).toEqual([
      { id: 'b', ageDays: 7 },
      { id: 'a', ageDays: 3 },
    ])
  })

  test('an item in progress with no history is as old as the item', () => {
    expect(workItemAges([item('a', '2026-07-01', 'in_progress')], [], at('2026-07-04'))).toEqual([{ id: 'a', ageDays: 3 }])
  })
})

describe('throughputPerDay', () => {
  test('counts the items that reached done on each day, once each', () => {
    const events = [move('a', 'done', '2026-07-01'), move('b', 'done', '2026-07-01'), move('a', 'in_progress', '2026-07-02'), move('a', 'done', '2026-07-02'), move('c', 'in_progress', '2026-07-02')]
    expect(throughputPerDay(events, ['2026-07-01', '2026-07-02', '2026-07-03'])).toEqual([
      { date: '2026-07-01', done: 2 },
      { date: '2026-07-02', done: 1 },
      { date: '2026-07-03', done: 0 },
    ])
  })
})

describe('summarize', () => {
  test('gives the count, the average, the median, and the 85th percentile', () => {
    expect(summarize([1, 2, 3, 4, 10])).toEqual({ count: 5, average: 4, median: 3, p85: 10 })
  })

  test('averages the two middle values for the median, and rounds to one decimal', () => {
    expect(summarize([1, 2, 3, 4])).toMatchObject({ median: 2.5, average: 2.5 })
    expect(summarize([1, 1, 2])).toMatchObject({ average: 1.3 })
  })

  test('has nothing to say about nothing', () => {
    expect(summarize([])).toEqual({ count: 0, average: 0, median: 0, p85: 0 })
  })
})
