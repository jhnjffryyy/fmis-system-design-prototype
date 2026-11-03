import type { PricePoint } from './checks'
import { SHORT_WINDOW, LONG_WINDOW, FIT_WINDOW, FORECAST_HORIZON, MIN_RECORDS } from '../config'

export type Trend = 'Upward' | 'Downward' | 'Flat'

export interface ForecastPoint {
  iso: string
  t: number
  v: number
  lower?: number
  upper?: number
}

export interface Analysis {
  rows: PricePoint[]
  latest: number
  latestIso: string
  change: number // percent
  avg30: number
  avg90: number
  avgPrice: number
  totalChange: number // percent
  ma30: (number | null)[]
  ma90: (number | null)[]
  high: { v: number; iso: string }
  low: { v: number; iso: string }
  first: number
  firstIso: string
  trend: Trend
  /** 30 forecast points (x = 90..119 of the last-90 OLS), dated to the next 30 weekdays */
  forecast: ForecastPoint[]
  forecast30: number
  /** mean absolute percentage error of the same model run 30 days back */
  mape: number | null
  mae: number | null
  maxError: number | null
  forecastPct: number
  chg: number[]
  vol: (number | null)[]
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

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
      rows,
      latest: only,
      latestIso: iso,
      change: 0,
      avg30: only,
      avg90: only,
      avgPrice: only,
      totalChange: 0,
      ma30: [],
      ma90: [],
      high: { v: only, iso },
      low: { v: only, iso },
      first: only,
      firstIso: iso,
      trend: 'Flat',
      forecast: [],
      forecast30: only,
      mape: null,
      mae: null,
      maxError: null,
      forecastPct: 0,
      chg: [0],
      vol: [null],
    }
  }
  const latest = closes[n - 1]
  const prev = closes[n - 2]
  const avg30 = mean(closes.slice(-SHORT_WINDOW))
  const avg90 = mean(closes.slice(-LONG_WINDOW))

  let hiI = 0
  let loI = 0
  for (let i = 0; i < n; i++) {
    if (closes[i] > closes[hiI]) hiI = i
    if (closes[i] < closes[loI]) loI = i
  }

  const trend: Trend = avg30 < avg90 ? 'Downward' : avg30 > avg90 ? 'Upward' : 'Flat'

  // OLS on last 90 closes, x = 0..89; forecast x = 90..119
  const win = closes.slice(-FIT_WINDOW)
  const { a, b } = ols(win)

  let ssRes = 0
  for (let x = 0; x < win.length; x++) {
    const yHat = a + b * x
    ssRes += (win[x] - yHat) ** 2
  }
  const df = Math.max(1, win.length - 2)
  const olsStdErr = Math.sqrt(ssRes / df)
  const mx = (win.length - 1) / 2
  let ssX = 0
  for (let x = 0; x < win.length; x++) ssX += (x - mx) ** 2
  const tCrit = 1.987 // 95% prediction interval critical value for df ~ 88

  const lastT = rows[n - 1].t
  const fut = nextWeekdays(lastT, FORECAST_HORIZON)
  const forecast: ForecastPoint[] = fut.map((f, i) => {
    const xVal = FIT_WINDOW + i
    const v = a + b * xVal
    const sePred = olsStdErr * Math.sqrt(1 + 1 / win.length + ((xVal - mx) ** 2) / (ssX || 1))
    const margin = tCrit * sePred
    return {
      ...f,
      v,
      lower: Math.max(0.01, v - margin),
      upper: v + margin,
    }
  })
  const forecast30 = a + b * (FIT_WINDOW + FORECAST_HORIZON - 1)

  // accuracy: same fit on closes[-120:-30], compare with the real last 30
  let mape: number | null = null
  let mae: number | null = null
  let maxError: number | null = null
  if (n >= MIN_RECORDS) {
    const base = closes.slice(-MIN_RECORDS, -FORECAST_HORIZON)
    const fit = ols(base)
    const actual = closes.slice(-FORECAST_HORIZON)
    const diffs = actual.map((v, i) => Math.abs(fit.a + fit.b * (FIT_WINDOW + i) - v))
    const errs = actual.map((v, i) => diffs[i] / v)
    mae = mean(diffs)
    maxError = Math.max(...diffs)
    mape = mean(errs) * 100
  }

  const chg = closes.map((v, i) =>
    rows[i].change !== undefined
      ? rows[i].change!
      : i > 0
      ? ((v / closes[i - 1]) - 1) * 100
      : 0,
  )

  const vol = rows.map((r) => (r.vol !== undefined && r.vol > 0 ? r.vol : null))

  return {
    rows,
    latest,
    latestIso: rows[n - 1].iso,
    change: (latest / prev - 1) * 100,
    avg30,
    avg90,
    avgPrice: mean(closes),
    totalChange: (latest / closes[0] - 1) * 100,
    ma30: ma(closes, SHORT_WINDOW),
    ma90: ma(closes, LONG_WINDOW),
    high: { v: closes[hiI], iso: rows[hiI].iso },
    low: { v: closes[loI], iso: rows[loI].iso },
    first: closes[0],
    firstIso: rows[0].iso,
    trend,
    forecast,
    forecast30,
    mape,
    mae,
    maxError,
    forecastPct: latest > 0 ? ((forecast30 / latest) - 1) * 100 : 0,
    chg,
    vol,
  }
}
