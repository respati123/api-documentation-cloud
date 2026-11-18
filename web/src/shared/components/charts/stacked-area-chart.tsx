import {
  ChartLegend,
  type ChartSeries,
  ChartSummary,
  FRAME,
  LabelAxis,
  PLOT,
  TONE,
  ValueAxis,
} from '@/shared/components/charts/chart-parts'
import { areaPath, linearScale, niceMax, ticks } from '@/shared/utils/chart-geometry'

export interface AreaSeries extends ChartSeries {
  values: number[]
}

// Series stacked on each other, the first at the bottom, such as the items in each column over time.
export function StackedAreaChart({
  labels,
  series,
  ariaLabel,
  summary,
  testId,
}: {
  labels: string[]
  series: AreaSeries[]
  ariaLabel: string
  summary: string[]
  testId: string
}) {
  const totals = labels.map((_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0))
  const max = niceMax(Math.max(0, ...totals))
  const y = linearScale([0, max], [PLOT.y0, PLOT.y1])
  const x = (index: number) =>
    labels.length <= 1 ? (PLOT.x0 + PLOT.x1) / 2 : linearScale([0, labels.length - 1], [PLOT.x0, PLOT.x1])(index)

  const below = labels.map(() => 0)
  const bands = series.map((item) => {
    const points = labels.map((_, index) => {
      const base = below[index]
      below[index] += item.values[index] ?? 0
      return { x: x(index), y: y(below[index]), base: y(base) }
    })
    return { item, d: areaPath(points) }
  })

  return (
    <figure className="grid gap-2" data-testid={testId}>
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} className="h-auto w-full">
        <ValueAxis ticks={ticks(max, 5)} y={y} />
        <LabelAxis labels={labels} x={x} />
        {bands.map(({ item, d }) => (
          <path key={item.id} data-testid={`${testId}-area-${item.id}`} d={d} className={`${TONE[item.tone].fill} opacity-80`} />
        ))}
      </svg>
      <ChartLegend items={[...series].reverse()} />
      <ChartSummary lines={summary} />
    </figure>
  )
}
