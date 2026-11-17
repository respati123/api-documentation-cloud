// The numbers behind the SVG charts. Everything here is plain arithmetic, so it is easy to test.

// The smallest 1, 2, 5, or 10 times a power of ten that is not below the value. An empty chart still gets an axis from 0 to 1.
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const fraction = value / power
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return step * power
}

export function linearScale(domain: [number, number], range: [number, number]): (value: number) => number {
  const [from, to] = domain
  const [start, end] = range
  if (to === from) return () => start
  return (value) => start + ((value - from) / (to - from)) * (end - start)
}

// `count` marks from zero to the maximum, evenly spaced.
export function ticks(max: number, count: number): number[] {
  if (count < 2) return [0, max]
  return Array.from({ length: count }, (_, index) => (max * index) / (count - 1))
}

export interface Point {
  x: number
  y: number
}

// A missing value starts a new piece of the line, so a gap shows as a gap.
export function linePath(points: Array<Point | null>): string {
  const parts: string[] = []
  let drawing = false
  let last: Point | null = null
  let pieceLength = 0
  for (const point of points) {
    if (!point) {
      if (drawing && pieceLength === 1 && last) parts.push(`L${last.x} ${last.y}`)
      drawing = false
      pieceLength = 0
      continue
    }
    parts.push(`${drawing ? 'L' : 'M'}${point.x} ${point.y}`)
    drawing = true
    pieceLength += 1
    last = point
  }
  if (drawing && pieceLength === 1 && last) parts.push(`L${last.x} ${last.y}`)
  return parts.join(' ')
}

export interface BandPoint extends Point {
  // The y of the edge the band sits on. It is the baseline for the first band and the top of the band below for the rest.
  base: number
}

// A band between a line and the edge below it: along the top from left to right, then back along the base.
export function areaPath(points: BandPoint[]): string {
  if (points.length === 0) return ''
  const top = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`)
  const bottom = [...points].reverse().map((point) => `L${point.x} ${point.base}`)
  return `${[...top, ...bottom].join(' ')} Z`
}
