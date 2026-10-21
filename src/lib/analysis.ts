import type { PricePoint } from './checks'

export type Trend = 'Upward' | 'Downward' | 'Flat'

export interface ForecastPoint {
  iso: string
  t: number
  v: number
}

export interface Analysis {
  rows: PricePoint[]
  latest: number
  latestIso: string
  change: number // percent
  avg30: number
  avg90: number
  ma30: (number | null)[]
  ma90: (number | null)[]
  high: { v: number; iso: string }
  low: { v: number; iso: string }
  first: number
  firstIso: string
  drop: number // percent
  trend: Trend
  /** 30 forecast points (x = 90..119 of the last-90 OLS), dated to the next 30 weekdays */
  forecast: ForecastPoint[]
  forecast30: number
  /** mean absolute percentage error of the same model run 30 days back */
  mape: number | null
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const r2 = (v: number) => Math.round(v * 100) / 100

function ols(ys: number[]): { a: number; b: number } {
  const n = ys.length
  const mx = (n - 1) / 2
  const my = mean(ys)
  let num = 0
  let den = 0
  for (let x = 0; x < n; x++) {
    num += (x - mx) * (ys[x] - my)
    den += (x - mx) * (x - mx)
  }
  const b = num / den
  return { a: my - b * mx, b }
}

function ma(xs: number[], w: number): (number | null)[] {
  const out: (number | null)[] = []
  let s = 0
  for (let i = 0; i < xs.length; i++) {
    s += xs[i]
    if (i >= w) s -= xs[i - w]
    out.push(i >= w - 1 ? s / w : null)
  }
  return out
}

/** next n weekday dates (UTC) after t, as ISO strings */
export function nextWeekdays(t: number, n: number): { iso: string; t: number }[] {
  const out: { iso: string; t: number }[] = []
  let d = t
  while (out.length < n) {
    d += 86400000
    const day = new Date(d).getUTCDay()
    if (day !== 0 && day !== 6) out.push({ iso: new Date(d).toISOString().slice(0, 10), t: d })
  }
  return out
}

export function analyze(rows: PricePoint[]): Analysis {
  const closes = rows.map((r) => r.price)
  const n = closes.length
  if (n < 2) {
    // degenerate input: the UI should never receive this (import requires 120+)
    const only = closes[0] ?? 0
    const iso = rows[0]?.iso ?? ''
    return {
      rows, latest: only, latestIso: iso, change: 0, avg30: only, avg90: only,
      ma30: [], ma90: [], high: { v: only, iso }, low: { v: only, iso },
      first: only, firstIso: iso, drop: 0, trend: 'Flat', forecast: [],
      forecast30: only, mape: null,
    }
  }
  const latest = closes[n - 1]
  const prev = closes[n - 2]
  const avg30 = mean(closes.slice(-30))
  const avg90 = mean(closes.slice(-90))

  let hiI = 0
  let loI = 0
  for (let i = 0; i < n; i++) {
    if (closes[i] > closes[hiI]) hiI = i
    if (closes[i] < closes[loI]) loI = i
  }

  const trend: Trend =
    r2(avg30) < r2(avg90) ? 'Downward' : r2(avg30) > r2(avg90) ? 'Upward' : 'Flat'

  // OLS on last 90 closes, x = 0..89; forecast x = 90..119
  const win = closes.slice(-90)
  const { a, b } = ols(win)
  const lastT = rows[n - 1].t
  const fut = nextWeekdays(lastT, 30)
  const forecast = fut.map((f, i) => ({ ...f, v: a + b * (90 + i) }))
  const forecast30 = a + b * 119

  // accuracy: same fit on closes[-120:-30], compare with the real last 30
  let mape: number | null = null
  if (n >= 120) {
    const base = closes.slice(-120, -30)
    const fit = ols(base)
    const actual = closes.slice(-30)
    const errs = actual.map((v, i) => Math.abs((fit.a + fit.b * (90 + i) - v) / v))
    mape = mean(errs) * 100
  }

  return {
    rows,
    latest,
    latestIso: rows[n - 1].iso,
    change: (latest / prev - 1) * 100,
    avg30,
    avg90,
    ma30: ma(closes, 30),
    ma90: ma(closes, 90),
    high: { v: closes[hiI], iso: rows[hiI].iso },
    low: { v: closes[loI], iso: rows[loI].iso },
    first: closes[0],
    firstIso: rows[0].iso,
    drop: (1 - latest / closes[0]) * 100,
    trend,
    forecast,
    forecast30,
    mape,
  }
}
