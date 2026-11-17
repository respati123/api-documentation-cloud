import { describe, expect, test } from 'vitest'
import { areaPath, linearScale, linePath, niceMax, ticks } from '@/shared/utils/chart-geometry'

describe('niceMax', () => {
  test('rounds a maximum up to 1, 2, 5, or 10 times a power of ten', () => {
    expect(niceMax(8)).toBe(10)
    expect(niceMax(13)).toBe(20)
    expect(niceMax(21)).toBe(50)
    expect(niceMax(0.3)).toBe(0.5)
    expect(niceMax(100)).toBe(100)
  })

  test('is 1 for nothing, so an empty chart still has an axis', () => {
    expect(niceMax(0)).toBe(1)
    expect(niceMax(-4)).toBe(1)
    expect(niceMax(Number.NaN)).toBe(1)
  })
})

describe('linearScale', () => {
  test('maps the domain to the range, and the range may run backwards', () => {
    const y = linearScale([0, 10], [200, 0])
    expect(y(0)).toBe(200)
    expect(y(10)).toBe(0)
    expect(y(5)).toBe(100)
  })

  test('maps everything to the start of the range when the domain has no width', () => {
    expect(linearScale([3, 3], [10, 90])(3)).toBe(10)
  })
})

describe('ticks', () => {
  test('are evenly spaced from zero to the maximum', () => {
    expect(ticks(10, 5)).toEqual([0, 2.5, 5, 7.5, 10])
    expect(ticks(4, 2)).toEqual([0, 4])
  })
})

describe('linePath', () => {
  test('joins the points, and a missing value breaks the line', () => {
    expect(linePath([{ x: 0, y: 10 }, { x: 10, y: 20 }, null, { x: 30, y: 5 }, { x: 40, y: 6 }])).toBe('M0 10 L10 20 M30 5 L40 6')
  })

  test('has no path without points', () => {
    expect(linePath([])).toBe('')
    expect(linePath([null, null])).toBe('')
  })

  test('draws a lone point as a dot of zero length', () => {
    expect(linePath([{ x: 5, y: 5 }])).toBe('M5 5 L5 5')
  })
})

describe('areaPath', () => {
  test('closes the area down to the baseline', () => {
    expect(
      areaPath([
        { x: 0, y: 10, base: 40 },
        { x: 10, y: 20, base: 40 },
      ]),
    ).toBe('M0 10 L10 20 L10 40 L0 40 Z')
  })

  test('follows a base that is not flat, such as the top of the series below', () => {
    expect(
      areaPath([
        { x: 0, y: 5, base: 20 },
        { x: 10, y: 8, base: 25 },
      ]),
    ).toBe('M0 5 L10 8 L10 25 L0 20 Z')
  })

  test('has no path without points', () => {
    expect(areaPath([])).toBe('')
  })
})
