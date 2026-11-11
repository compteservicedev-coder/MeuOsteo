import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { formatEurosShort } from '@shared/domain/invoice'
import { MONTHS_LONG } from '@shared/domain/planning'
import { evolutionLabel, revenueTicks, type YearComparison } from '@shared/domain/revenue'
import { EASE_SOFT } from '../../lib/motion'

const SHORT_MONTHS = [
  'Janv.',
  'Févr.',
  'Mars',
  'Avr.',
  'Mai',
  'Juin',
  'Juil.',
  'Août',
  'Sept.',
  'Oct.',
  'Nov.',
  'Déc.',
]
const CURRENT = '#1F4FD8'
const PREVIOUS = '#94A3B8'
const HEIGHT = 250
const PAD = { top: 26, right: 18, bottom: 30, left: 56 }

/**
 * Revenue of a year (blue, values shown on each point) next to the year before (grey), as
 * connected points, with dashed guide lines on round thresholds. Hover a month for both values.
 */
export function RevenueLineChart({
  years,
  currentMonth,
}: {
  years: YearComparison
  /** 0-based month in progress when `years` is the current year, else null (all months shown). */
  currentMonth: number | null
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setWidth(Math.max(320, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ticks = revenueTicks(Math.max(...years.months.flatMap((m) => [m.cents, m.previousCents])))
  const top = ticks.at(-1)!
  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (plotW / 12) * (i + 0.5)
  const y = (cents: number) => PAD.top + plotH - (cents / top) * plotH
  const shown = (i: number) => currentMonth === null || i <= currentMonth
  const path = (pts: Array<[number, number]>) =>
    pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const currentPts = years.months
    .map((m, i) => [i, m.cents] as const)
    .filter(([i]) => shown(i))
    .map(([i, c]) => [x(i), y(c)] as [number, number])
  const previousPts = years.months.map((m, i) => [x(i), y(m.previousCents)] as [number, number])
  const draw = reduced
    ? { initial: false as const }
    : {
        initial: { pathLength: 0 },
        animate: { pathLength: 1 },
        transition: { duration: 0.9, ease: EASE_SOFT },
      }
  const h = hover !== null ? years.months[hover]! : null

  return (
    <div ref={box} className="relative mt-3 w-full" onMouseLeave={() => setHover(null)}>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Chiffre d’affaires ${years.year} et ${years.year - 1}, mois par mois`}
        className="block"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? '#CBD3E1' : '#DCE2EC'}
              strokeDasharray={t === 0 ? undefined : '4 5'}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-ink-500 text-[11px] tabular-nums"
            >
              {formatEurosShort(t)}
            </text>
          </g>
        ))}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top - 8}
            y2={PAD.top + plotH}
            stroke="#B8C2D4"
            strokeWidth={1}
          />
        )}
        <motion.path
          key={`p${years.year}`}
          d={path(previousPts)}
          fill="none"
          stroke={PREVIOUS}
          strokeWidth={2}
          strokeLinejoin="round"
          {...draw}
        />
        <motion.path
          key={`c${years.year}`}
          d={path(currentPts)}
          fill="none"
          stroke={CURRENT}
          strokeWidth={2.5}
          strokeLinejoin="round"
          {...draw}
        />
        {years.months.map((m, i) => (
          <circle
            key={`pp${i}`}
            cx={x(i)}
            cy={y(m.previousCents)}
            r={hover === i ? 5 : 3.5}
            fill={PREVIOUS}
            stroke="white"
            strokeWidth={2}
          />
        ))}
        {years.months.map((m, i) =>
          shown(i) ? (
            <g key={`cp${i}`}>
              <circle
                cx={x(i)}
                cy={y(m.cents)}
                r={hover === i || i === currentMonth ? 6 : 4.5}
                fill={CURRENT}
                stroke="white"
                strokeWidth={2}
              />
              <text
                x={x(i)}
                y={y(m.cents) - 10}
                textAnchor="middle"
                stroke="white"
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
                className="fill-ink-900 text-[11px] font-bold tabular-nums"
              >
                {formatEurosShort(m.cents)}
              </text>
            </g>
          ) : null,
        )}
        {years.months.map((m, i) => (
          <text
            key={`m${i}`}
            x={x(i)}
            y={HEIGHT - 8}
            textAnchor="middle"
            className={
              i === currentMonth
                ? 'fill-royal-700 text-[11px] font-extrabold'
                : 'fill-ink-500 text-[11px]'
            }
          >
            {SHORT_MONTHS[m.month - 1]}
          </text>
        ))}
        {/* Hit areas: a whole month column, larger than the points. */}
        {years.months.map((_, i) => (
          <rect
            key={`h${i}`}
            x={PAD.left + (plotW / 12) * i}
            y={PAD.top - 10}
            width={plotW / 12}
            height={plotH + 10}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {h && hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 min-w-[170px] rounded-xl border border-line-faint bg-white px-3 py-2 text-[12px] shadow-card"
          style={{
            left: Math.min(Math.max(x(hover) - 85, 0), width - 175),
            top: 0,
          }}
        >
          <p className="font-extrabold text-ink-900">{MONTHS_LONG[h.month - 1]}</p>
          <p className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-ink-600">
              <span className="h-2 w-2 rounded-full" style={{ background: CURRENT }} />
              {years.year}
            </span>
            <b className="tabular-nums text-ink-900">
              {shown(hover) ? formatEurosShort(h.cents) : '—'}
            </b>
          </p>
          <p className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-ink-600">
              <span className="h-2 w-2 rounded-full" style={{ background: PREVIOUS }} />
              {years.year - 1}
            </span>
            <b className="tabular-nums text-ink-900">{formatEurosShort(h.previousCents)}</b>
          </p>
          {shown(hover) && evolutionLabel(h.cents, h.previousCents) && (
            <p className="mt-0.5 text-ink-500">
              Évolution : {evolutionLabel(h.cents, h.previousCents)}
            </p>
          )}
        </div>
      )}
      <table className="sr-only">
        <caption>Chiffre d’affaires par mois</caption>
        <thead>
          <tr>
            <th>Mois</th>
            <th>{years.year}</th>
            <th>{years.year - 1}</th>
          </tr>
        </thead>
        <tbody>
          {years.months.map((m, i) => (
            <tr key={m.month}>
              <td>{MONTHS_LONG[m.month - 1]}</td>
              <td>{shown(i) ? formatEurosShort(m.cents) : '—'}</td>
              <td>{formatEurosShort(m.previousCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
