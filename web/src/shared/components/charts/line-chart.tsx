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
import { linearScale, linePath, niceMax, ticks } from '@/shared/utils/chart-geometry'
import { cn } from '@/shared/utils/cn'

export interface LineSeries extends ChartSeries {
  // A missing value leaves a gap, such as a day that has not come yet.
  values: Array<number | null>
  dashed?: boolean
}

export function LineChart({
  labels,
  series,
  ariaLabel,
  summary,
  testId,
}: {
  labels: string[]
  series: LineSeries[]
  ariaLabel: string
  summary: string[]
  testId: string
}) {
  const max = niceMax(Math.max(0, ...series.flatMap((item) => item.values.filter((value): value is number => value !== null))))
  const y = linearScale([0, max], [PLOT.y0, PLOT.y1])
  const x = (index: number) =>
    labels.length <= 1 ? (PLOT.x0 + PLOT.x1) / 2 : linearScale([0, labels.length - 1], [PLOT.x0, PLOT.x1])(index)

  return (
    <figure className="grid gap-2" data-testid={testId}>
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} className="h-auto w-full">
        <ValueAxis ticks={ticks(max, 5)} y={y} />
        <LabelAxis labels={labels} x={x} />
        {series.map((item) => (
          <path
            key={item.id}
            data-testid={`${testId}-line-${item.id}`}
            d={linePath(item.values.map((value, index) => (value === null ? null : { x: x(index), y: y(value) })))}
            className={cn('fill-none', TONE[item.tone].stroke, item.dashed && '[stroke-dasharray:5_4]')}
            strokeWidth={item.dashed ? 1.5 : 2.25}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <ChartLegend items={series} />
      <ChartSummary lines={summary} />
    </figure>
  )
}
