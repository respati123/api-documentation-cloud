import { cn } from '@/shared/utils/cn'

export type ChartTone = 1 | 2 | 3 | 4 | 5

// Full class names, so Tailwind finds them. The tones are the chart colors of the theme.
export const TONE: Record<ChartTone, { stroke: string; fill: string; swatch: string }> = {
  1: { stroke: 'stroke-chart-1', fill: 'fill-chart-1', swatch: 'bg-chart-1' },
  2: { stroke: 'stroke-chart-2', fill: 'fill-chart-2', swatch: 'bg-chart-2' },
  3: { stroke: 'stroke-chart-3', fill: 'fill-chart-3', swatch: 'bg-chart-3' },
  4: { stroke: 'stroke-chart-4', fill: 'fill-chart-4', swatch: 'bg-chart-4' },
  5: { stroke: 'stroke-chart-5', fill: 'fill-chart-5', swatch: 'bg-chart-5' },
}

export const FRAME = { width: 640, height: 260, top: 12, right: 16, bottom: 30, left: 38 }
export const PLOT = { x0: FRAME.left, x1: FRAME.width - FRAME.right, y0: FRAME.height - FRAME.bottom, y1: FRAME.top }

export interface ChartSeries {
  id: string
  label: string
  tone: ChartTone
}

export function ChartLegend({ items }: { items: Array<ChartSeries & { dashed?: boolean }> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <li key={item.id} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn('inline-block h-0.5 w-4 rounded-full', TONE[item.tone].swatch, item.dashed && 'opacity-60')}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// The value axis: a gridline and a number at each tick.
export function ValueAxis({ ticks, y }: { ticks: number[]; y: (value: number) => number }) {
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={PLOT.x0} x2={PLOT.x1} y1={y(tick)} y2={y(tick)} className="stroke-border" strokeWidth={1} />
          <text x={PLOT.x0 - 6} y={y(tick) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </text>
        </g>
      ))}
    </g>
  )
}

// The label axis shows about six labels, always the first and the last.
export function LabelAxis({ labels, x }: { labels: string[]; x: (index: number) => number }) {
  const step = Math.max(1, Math.ceil(labels.length / 6))
  return (
    <g>
      {labels.map((label, index) =>
        index % step === 0 || index === labels.length - 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the labels of an axis keep their position, and two can be alike
          <text
            key={`${label}-${index}`}
            x={x(index)}
            y={FRAME.height - 10}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {label}
          </text>
        ) : null,
      )}
    </g>
  )
}

// What the chart says, as a list that a screen reader reads.
export function ChartSummary({ lines }: { lines: string[] }) {
  return (
    <ul className="sr-only">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}
