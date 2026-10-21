// Generates SAMPLE daily price files for the demo. The values are made up but are
// pinned to the shared numbers in the storyboard (first/last price, high, low,
// year-end closes, 30/90 day averages, latest change, 927 trading days).
// Usage: node scripts/generate-sample-csv.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'sample')

const iso = (d) => d.toISOString().slice(0, 10)
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d))

function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return utc(y, month, day)
}
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)
function lastMonday(y, m) {
  let d = utc(y, m + 1, 0)
  while (d.getUTCDay() !== 1) d = addDays(d, -1)
  return d
}

// Sample market closures (Philippine-style holidays). Sample only.
const lunarNewYear = { 2023: '2023-01-23', 2024: '2024-02-09', 2025: '2025-01-29', 2026: '2026-02-17' }
const eidFitr = { 2023: '2023-04-21', 2024: '2024-04-10', 2025: '2025-04-01', 2026: '2026-03-20' }
const eidAdha = { 2023: '2023-06-28', 2024: '2024-06-17', 2025: '2025-06-06', 2026: '2026-05-27' }
const holidays = new Set()
for (const y of [2023, 2024, 2025, 2026]) {
  const e = easter(y)
  for (const d of [
    utc(y, 1, 1), addDays(e, -3), addDays(e, -2), utc(y, 4, 9), utc(y, 5, 1), utc(y, 6, 12),
    utc(y, 8, 21), lastMonday(y, 8), utc(y, 11, 1), utc(y, 11, 2), utc(y, 11, 30), utc(y, 12, 8),
    utc(y, 12, 24), utc(y, 12, 25), utc(y, 12, 30), utc(y, 12, 31),
  ]) holidays.add(iso(d))
  for (const s of [lunarNewYear[y], eidFitr[y], eidAdha[y]]) holidays.add(s)
}

const dates = []
for (let d = utc(2023, 1, 3); d <= utc(2026, 10, 19); d = addDays(d, 1)) {
  const w = d.getUTCDay()
  if (w !== 0 && w !== 6 && !holidays.has(iso(d))) dates.push(iso(d))
}
const N = 927
if (dates.length < N) throw new Error(`only ${dates.length} trading days`)
// Trim extra sample closures (mid-week days, spread out) until exactly 927 remain.
const keep = new Set(['2023-01-03', '2023-10-19', '2026-10-08', '2026-10-16', '2026-10-19'])
let extra = dates.length - N
for (let i = 40; extra > 0; i += Math.floor(dates.length / (dates.length - N + 1))) {
  const idx = i % dates.length
  if (keep.has(dates[idx]) || new Date(dates[idx]).getUTCDay() !== 3) continue
  dates.splice(idx, 1)
  extra--
}
if (dates.length !== N) throw new Error(`expected ${N}, got ${dates.length}`)

const lastTradingDayOf = (y) => dates.filter((d) => d.startsWith(`${y}-`)).at(-1)
const anchors = new Map([
  ['2023-01-03', 2.81],
  ['2023-05-15', 3.25],
  ['2023-10-19', 3.69],
  [lastTradingDayOf(2023), 2.35],
  ['2024-06-28', 2.0],
  [lastTradingDayOf(2024), 1.64],
  ['2025-06-30', 1.1],
  [lastTradingDayOf(2025), 0.68],
  ['2026-05-29', 0.8],
  ['2026-08-20', 0.7],
  ['2026-09-22', 0.62],
  ['2026-10-08', 0.54],
  ['2026-10-16', 0.6],
  ['2026-10-19', 0.59],
])
for (const d of anchors.keys()) if (!dates.includes(d)) throw new Error(`anchor ${d} is not a trading day`)

let seed = 20261019
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())

const idx = [...anchors.keys()].map((d) => dates.indexOf(d))
const close = new Array(N)
for (let s = 0; s < idx.length - 1; s++) {
  const a = idx[s], b = idx[s + 1], va = anchors.get(dates[a]), vb = anchors.get(dates[b])
  const walk = [0]
  for (let t = a + 1; t <= b; t++) walk.push(walk.at(-1) + gauss())
  for (let t = a; t <= b; t++) {
    const u = (t - a) / (b - a || 1)
    const base = va + (vb - va) * u
    const bridge = walk[t - a] - u * walk[b - a]
    close[t] = base + bridge * base * 0.006
  }
}
const locked = new Set(idx)
const r2 = (x) => Math.round(x * 100) / 100
for (let t = 0; t < N; t++) {
  // Reflect (not clamp) values that cross the pinned high/low so no flat plateau appears.
  const v = close[t] > 3.68 ? 7.36 - close[t] : close[t] < 0.55 ? 1.1 - close[t] : close[t]
  close[t] = locked.has(t) ? anchors.get(dates[t]) : Math.min(3.68, Math.max(0.55, r2(v)))
}

// Pin window sums so the averages come out exactly: last 30 days -> 0.60, last 90 -> 0.69.
function pinSum(from, to, target) {
  const free = []
  for (let t = from; t <= to; t++) if (!locked.has(t)) free.push(t)
  let diff = Math.round((target - close.slice(from, to + 1).reduce((s, v) => s + v, 0)) * 100)
  for (let k = 0; diff !== 0; k++) {
    const t = free[k % free.length], step = Math.sign(diff) * 0.01, v = r2(close[t] + step)
    if (v >= 0.55 && v <= 3.68) { close[t] = v; diff -= Math.sign(diff) }
    if (k > 100000) throw new Error('cannot pin window sum')
  }
}
pinSum(N - 30, N - 1, 18.0)
pinSum(N - 90, N - 31, 62.1 - 18.0)

// ---- self-check against the shared numbers ----
const avg = (n) => close.slice(-n).reduce((s, v) => s + v, 0) / n
const max = Math.max(...close), min = Math.min(...close)
const checks = {
  records: [dates.length, 927],
  first: [`${dates[0]} ${close[0]}`, '2023-01-03 2.81'],
  latest: [`${dates.at(-1)} ${close.at(-1)}`, '2026-10-19 0.59'],
  change: [((close.at(-1) / close.at(-2) - 1) * 100).toFixed(2), '-1.67'],
  avg30: [avg(30).toFixed(2), '0.60'],
  avg90: [avg(90).toFixed(2), '0.69'],
  high: [`${dates[close.indexOf(max)]} ${max}`, '2023-10-19 3.69'],
  highUnique: [close.filter((v) => v === max).length, 1],
  low: [`${dates[close.indexOf(min)]} ${min}`, '2026-10-08 0.54'],
  lowUnique: [close.filter((v) => v === min).length, 1],
  drop: [Math.round((1 - close.at(-1) / close[0]) * 100), 79],
  end2023: [close[dates.indexOf(lastTradingDayOf(2023))], 2.35],
  end2024: [close[dates.indexOf(lastTradingDayOf(2024))], 1.64],
  end2025: [close[dates.indexOf(lastTradingDayOf(2025))], 0.68],
}
let ok = true
for (const [k, [got, want]] of Object.entries(checks)) {
  const pass = String(got) === String(want)
  ok &&= pass
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${k}: ${got} (want ${want})`)
}
if (!ok) throw new Error('sample data does not match the shared numbers')

// ---- write Investing.com-style CSV (latest first) ----
const fmtDate = (d) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)}`
const rows = []
let prev = 2.8
for (let t = 0; t < N; t++) {
  const c = close[t], o = prev
  const hi = r2(Math.max(o, c) + Math.floor(rand() * 3) * 0.01)
  const lo = r2(Math.max(0.01, Math.min(o, c) - Math.floor(rand() * 2) * 0.01))
  const vol = `${(2 + rand() * 30).toFixed(2)}M`
  const chg = `${((c / prev - 1) * 100).toFixed(2)}%`
  rows.push([fmtDate(dates[t]), c.toFixed(2), o.toFixed(2), hi.toFixed(2), lo.toFixed(2), vol, chg])
  prev = c
}
rows.reverse()
const header = ['Date', 'Price', 'Open', 'High', 'Low', 'Vol.', 'Change %']
const toCsv = (rs) => [header, ...rs].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n') + '\n'

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, 'DITO-Historical-Data.csv'), toCsv(rows))

// Broken copy for the "File check failed" demo. Row numbers count data rows (header excluded).
const bad = rows.map((r) => [...r])
bad[15 - 1][1] = ''
bad[120 - 1][0] = bad[119 - 1][0]
bad[300 - 1][1] = '0.00'
writeFileSync(join(OUT_DIR, 'DITO-Historical-Data-with-errors.csv'), toCsv(bad))
console.log(`wrote ${N} rows to ${OUT_DIR}`)
