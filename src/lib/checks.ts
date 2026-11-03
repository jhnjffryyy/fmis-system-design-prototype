import { parseCsv } from './csv'
import { MIN_RECORDS, MAX_FILE_BYTES } from '../config'

export interface PricePoint {
  /** ISO date string yyyy-mm-dd */
  iso: string
  /** ms since epoch (UTC) */
  t: number
  price: number
  open?: number
  high?: number
  low?: number
  vol?: number
  change?: number
}

export interface Problem {
  row: number
  message: string
}

export interface CheckResult {
  ok: boolean
  problems: Problem[]
  records: number
  firstDate: string | null
  lastDate: string | null
  /** rows with a valid date and a numeric price, sorted ascending by date */
  rows: PricePoint[]
}

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

function utcDay(y: number, mo: number, d: number): { iso: string; t: number } | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const t = Date.UTC(y, mo - 1, d)
  const dt = new Date(t)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null // impossible calendar date like 02/31/2026
  }
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { iso, t }
}

function parseDate(s: string): { iso: string; t: number } | null {
  let m = DATE_RE.exec(s)
  if (m) return utcDay(+m[3], +m[1], +m[2])
  m = ISO_RE.exec(s)
  if (m) return utcDay(+m[1], +m[2], +m[3])
  return null
}

export function checkFileSize(bytes: number): string | null {
  return bytes > MAX_FILE_BYTES ? 'File is larger than 5 MB. Choose a smaller CSV file.' : null
}

const missingColumn = (name: string): Problem => ({
  row: 0,
  message: `File is missing the ${name} column. Add a column named ${name} and upload again.`,
})

/** file-level problems (row 0) sort after row problems */
const byRow = (a: Problem, b: Problem) =>
  (a.row === 0 ? 1 : 0) - (b.row === 0 ? 1 : 0) || a.row - b.row

/**
 * Run the five file checks on raw CSV text.
 * Row numbers are 1-based, header excluded.
 */
export function checkFile(text: string): CheckResult {
  const { headers, records } = parseCsv(text)
  const di = headers.indexOf('Date')
  const pi = headers.indexOf('Price')
  const oi = headers.indexOf('Open')
  const hi = headers.indexOf('High')
  const li = headers.indexOf('Low')
  const vi = headers.indexOf('Vol.')
  const ci = headers.indexOf('Change %')
  if (di < 0 || pi < 0) {
    const problems: Problem[] = []
    if (di < 0) problems.push(missingColumn('Date'))
    if (pi < 0) problems.push(missingColumn('Price'))
    return {
      ok: false,
      problems,
      records: records.length,
      firstDate: null,
      lastDate: null,
      rows: [],
    }
  }

  const problems: Problem[] = []
  const seenDates = new Set<string>()
  const parsed: (PricePoint | null)[] = []
  let direction: 1 | -1 | 0 = 0 // +1 ascending, -1 descending, once determined
  let prevT: number | null = null

  records.forEach((r, i) => {
    const n = i + 1
    const rawPrice = (r[pi] ?? '').trim()
    const rawDate = (r[di] ?? '').trim()

    // price: empty / non-number -> empty; 0 -> zero; <0 -> below zero
    const price = Number(rawPrice)
    if (rawPrice === '' || Number.isNaN(price)) {
      problems.push({ row: n, message: `Row ${n}: price is empty` })
    } else if (price === 0) {
      problems.push({ row: n, message: `Row ${n}: price is zero` })
    } else if (price < 0) {
      problems.push({ row: n, message: `Row ${n}: price is below zero` })
    }

    // date
    const d = rawDate === '' ? null : parseDate(rawDate)
    if (rawDate === '' || !d) {
      problems.push({
        row: n,
        message: `Row ${n}: date is not valid. Use MM/DD/YYYY or YYYY-MM-DD.`,
      })
      parsed.push(null)
      return
    }

    if (seenDates.has(d.iso)) {
      problems.push({ row: n, message: `Row ${n}: date is repeated` })
    } else {
      seenDates.add(d.iso)
      // ordering: file may be consistently ascending OR descending
      if (prevT !== null) {
        if (direction === 0) {
          direction = d.t > prevT ? 1 : d.t < prevT ? -1 : 0
        } else if ((direction === 1 && d.t < prevT) || (direction === -1 && d.t > prevT)) {
          problems.push({ row: n, message: `Row ${n}: date is out of order` })
        }
      }
      prevT = d.t
    }
    let vol: number | undefined
    if (vi >= 0) {
      const rawVol = (r[vi] ?? '').trim()
      if (rawVol) {
        const num = parseFloat(rawVol.replace(/,/g, ''))
        if (!Number.isNaN(num)) {
          if (/m$/i.test(rawVol)) vol = num
          else if (/k$/i.test(rawVol)) vol = num / 1000
          else if (/b$/i.test(rawVol)) vol = num * 1000
          else vol = num
        }
      }
    }
    let change: number | undefined
    if (ci >= 0) {
      const rawChg = (r[ci] ?? '').trim().replace('%', '')
      if (rawChg) {
        const num = parseFloat(rawChg)
        if (!Number.isNaN(num)) change = num
      }
    }
    let open: number | undefined
    if (oi >= 0 && r[oi]?.trim()) {
      const num = parseFloat(r[oi].trim())
      if (!Number.isNaN(num)) open = num
    }
    let high: number | undefined
    if (hi >= 0 && r[hi]?.trim()) {
      const num = parseFloat(r[hi].trim())
      if (!Number.isNaN(num)) high = num
    }
    let low: number | undefined
    if (li >= 0 && r[li]?.trim()) {
      const num = parseFloat(r[li].trim())
      if (!Number.isNaN(num)) low = num
    }
    parsed.push({
      iso: d.iso,
      t: d.t,
      price: Number.isNaN(price) ? 0 : price,
      open,
      high,
      low,
      vol,
      change,
    })
  })

  // the analysis needs a 90-day forecast window plus a 30-day back-test
  if (records.length < MIN_RECORDS) {
    problems.push({
      row: 0,
      message: `File needs at least ${MIN_RECORDS} records. Found ${records.length}.`,
    })
  }
  const rows = parsed.filter((p): p is PricePoint => p !== null).sort((a, b) => a.t - b.t)
  return {
    ok: problems.length === 0,
    problems: problems.sort(byRow),
    records: records.length,
    firstDate: rows.length ? rows[0].iso : null,
    lastDate: rows.length ? rows[rows.length - 1].iso : null,
    rows,
  }
}
