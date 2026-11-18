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
import { linearScale, niceMax, ticks } from '@/shared/utils/chart-geometry'
import { cn } from '@/shared/utils/cn'

export interface BarGroup {
  id: string
  label: string
  // One value for each series, in the same order.
  values: number[]
}

// Bars grouped by label, such as the committed and the completed points of each sprint.
export function BarChart({
  groups,
  series,
  ariaLabel,
  summary,
  testId,
}: {
  groups: BarGroup[]
  series: ChartSeries[]
  ariaLabel: string
  summary: string[]
  testId: string
}) {
  const max = niceMax(Math.max(0, ...groups.flatMap((group) => group.values)))
  const y = linearScale([0, max], [PLOT.y0, PLOT.y1])
  const slot = (PLOT.x1 - PLOT.x0) / Math.max(1, groups.length)
  const center = (index: number) => PLOT.x0 + slot * index + slot / 2
  const barWidth = Math.min(28, (slot * 0.7) / Math.max(1, series.length))

  return (
    <figure className="grid gap-2" data-testid={testId}>
      <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} className="h-auto w-full">
        <ValueAxis ticks={ticks(max, 5)} y={y} />
        <LabelAxis labels={groups.map((group) => group.label)} x={center} />
        {groups.map((group, groupIndex) =>
          group.values.map((value, seriesIndex) => {
            const left = center(groupIndex) - (barWidth * series.length) / 2 + barWidth * seriesIndex
            return (
              <rect
                key={`${group.id}-${series[seriesIndex]?.id ?? seriesIndex}`}
                data-testid={`${testId}-bar-${group.id}-${series[seriesIndex]?.id ?? seriesIndex}`}
                x={left}
                y={y(value)}
                width={Math.max(0, barWidth - 2)}
                height={Math.max(0, PLOT.y0 - y(value))}
                rx={2}
                className={cn(TONE[series[seriesIndex]?.tone ?? 1].fill)}
              />
            )
          }),
        )}
      </svg>
      <ChartLegend items={series} />
      <ChartSummary lines={summary} />
    </figure>
  )
}
