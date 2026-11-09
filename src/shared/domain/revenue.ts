/**
 * Tableau de bord (SPEC §7): revenue of a calendar year next to the year before, month by month.
 * Revenue = done sessions by session date (what was achieved, paid or not).
 */

export interface MonthRevenue {
  /** `2026-10` */
  month: string
  cents: number
}

export interface YearComparison {
  year: number
  /** Twelve months, January first. */
  months: Array<{ month: number; cents: number; previousCents: number }>
  totalCents: number
  previousTotalCents: number
  /** For the current year: total until today, and the year before over the same days. */
  toDate: { cents: number; previousCents: number; until: string } | null
}

/**
 * Builds the comparison from monthly totals and, for the current year, the totals until the same
 * day of the year before (`previousToDateCents`), so that a month in progress is compared fairly.
 */
export function compareYears(
  year: number,
  monthly: MonthRevenue[],
  today: string,
  previousToDateCents: number,
): YearComparison {
  const byMonth = new Map(monthly.map((r) => [r.month, r.cents]))
  const key = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    cents: byMonth.get(key(year, i + 1)) ?? 0,
    previousCents: byMonth.get(key(year - 1, i + 1)) ?? 0,
  }))
  const totalCents = months.reduce((n, m) => n + m.cents, 0)
  const previousTotalCents = months.reduce((n, m) => n + m.previousCents, 0)
  const current = Number(today.slice(0, 4)) === year
  return {
    year,
    months,
    totalCents,
    previousTotalCents,
    toDate: current
      ? { cents: totalCents, previousCents: previousToDateCents, until: today.slice(5) }
      : null,
  }
}

/** « +13 % » / « −4 % », or null when there is nothing to compare with. */
export function evolutionLabel(cents: number, previousCents: number): string | null {
  if (previousCents <= 0) return null
  const pct = Math.round(((cents - previousCents) / previousCents) * 100)
  return `${pct >= 0 ? '+' : '−'}${Math.abs(pct)} %`
}
