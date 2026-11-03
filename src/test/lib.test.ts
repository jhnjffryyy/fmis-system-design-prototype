import { describe, expect, it } from 'vitest'
import { parseCsv } from '../lib/csv'
import { checkFile, checkFileSize } from '../lib/checks'
import { analyze } from '../lib/analysis'
import { recommend } from '../lib/recommend'
import { fmtPct, fmtPctAbs } from '../lib/format'
import { nearestEarlierIso, pageCount } from '../lib/paginate'
import { limitations } from '../data/drivers'
import { MAX_FILE_BYTES } from '../config'
import bundledCsv from '../data/prices/DITO-Historical-Data.csv?raw'
import demoErrorsCsv from '../data/demo/DITO-demo-with-errors.csv?raw'

describe('parseCsv', () => {
  it('parses quoted fields, maps by header name, tolerates CRLF and BOM', () => {
    const csv = '﻿"Date","Price"\r\n"01/03/2023","2.81"\r\n"01/04/2023","2.90"'
    const { headers, records } = parseCsv(csv)
    expect(headers).toEqual(['Date', 'Price'])
    expect(records).toEqual([
      ['01/03/2023', '2.81'],
      ['01/04/2023', '2.90'],
    ])
  })
})

describe('checkFile', () => {
  it('clean bundled file passes all checks', () => {
    const r = checkFile(bundledCsv)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
    expect(r.records).toBe(930)
    expect(r.firstDate).toBe('2023-01-03')
    expect(r.lastDate).toBe('2026-10-21')
    expect(r.rows).toHaveLength(930)
    // sorted ascending
    expect(r.rows[0].iso).toBe('2023-01-03')
    expect(r.rows[929].iso).toBe('2026-10-21')
  })

  it('demo error file reports the 4 planted problems plus the 120 rule', () => {
    const r = checkFile(demoErrorsCsv)
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([
      { row: 4, message: 'Row 4: price is empty' },
      { row: 8, message: 'Row 8: date is repeated' },
      { row: 13, message: 'Row 13: date is out of order' },
      { row: 18, message: 'Row 18: price is zero' },
      { row: 0, message: 'File needs at least 120 records. Found 23.' },
    ])
  })

  const csvOf = (rows: [string, string][]) =>
    ['"Date","Price"', ...rows.map(([d, p]) => `"${d}","${p}"`)].join('\n')

  it('flags a negative price as below zero', () => {
    const r = checkFile(csvOf([['01/03/2023', '2.00'], ['01/04/2023', '-0.50']]))
    expect(r.problems.filter((p) => p.row > 0)).toEqual([
      { row: 2, message: 'Row 2: price is below zero' },
    ])
  })

  it('flags a non-numeric price as empty', () => {
    const r = checkFile(csvOf([['01/03/2023', 'abc']]))
    expect(r.problems.filter((p) => p.row > 0)).toEqual([
      { row: 1, message: 'Row 1: price is empty' },
    ])
  })

  it('flags an unparseable date with the accepted formats', () => {
    const r = checkFile(csvOf([['not a date', '1.00']]))
    expect(r.problems.filter((p) => p.row > 0)).toEqual([
      { row: 1, message: 'Row 1: date is not valid. Use MM/DD/YYYY or YYYY-MM-DD.' },
    ])
  })

  it('flags an impossible calendar date', () => {
    expect(
      checkFile(csvOf([['02/31/2026', '1.00']])).problems.filter((p) => p.row > 0),
    ).toEqual([
      { row: 1, message: 'Row 1: date is not valid. Use MM/DD/YYYY or YYYY-MM-DD.' },
    ])
    expect(
      checkFile(csvOf([['2026-02-30', '1.00']])).problems.filter((p) => p.row > 0),
    ).toEqual([
      { row: 1, message: 'Row 1: date is not valid. Use MM/DD/YYYY or YYYY-MM-DD.' },
    ])
    // real leap day is still accepted
    expect(
      checkFile(csvOf([['02/29/2024', '1.00']])).problems.filter((p) => p.row > 0),
    ).toEqual([])
  })

  it('accepts a consistently ascending file', () => {
    const r = checkFile(
      csvOf([['01/03/2023', '1.00'], ['01/04/2023', '1.10'], ['01/05/2023', '1.20']]),
    )
    expect(r.problems.filter((p) => p.row > 0)).toEqual([])
  })

  it('accepts a consistently descending file', () => {
    const r = checkFile(
      csvOf([['01/05/2023', '1.20'], ['01/04/2023', '1.10'], ['01/03/2023', '1.00']]),
    )
    expect(r.problems.filter((p) => p.row > 0)).toEqual([])
  })

  it('flags a direction break, flagging the later row', () => {
    const r = checkFile(
      csvOf([
        ['01/05/2023', '1.20'],
        ['01/04/2023', '1.10'],
        ['01/06/2023', '1.30'],
      ]),
    )
    expect(r.problems.filter((p) => p.row > 0)).toEqual([
      { row: 3, message: 'Row 3: date is out of order' },
    ])
  })

  it('reports a duplicate only as repeated, not out of order', () => {
    const r = checkFile(
      csvOf([
        ['01/03/2023', '1.00'],
        ['01/04/2023', '1.10'],
        ['01/04/2023', '1.10'],
        ['01/05/2023', '1.20'],
      ]),
    )
    expect(r.problems.filter((p) => p.row > 0)).toEqual([
      { row: 3, message: 'Row 3: date is repeated' },
    ])
  })

  it('always reports the 120 record rule, even with other problems', () => {
    const r = checkFile(csvOf([['01/03/2023', ''], ['01/04/2023', '1.00']]))
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([
      { row: 1, message: 'Row 1: price is empty' },
      { row: 0, message: 'File needs at least 120 records. Found 2.' },
    ])
  })

  it('rejects a clean file with fewer than 120 records', () => {
    const rows: [string, string][] = Array.from({ length: 119 }, (_, i) => {
      const d = new Date(Date.UTC(2023, 0, 3) + i * 86400000)
      return [d.toISOString().slice(0, 10), '1.50']
    })
    const r = checkFile(csvOf(rows))
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([
      { row: 0, message: 'File needs at least 120 records. Found 119.' },
    ])
  })

  it('accepts a clean file with 120 records', () => {
    const rows: [string, string][] = Array.from({ length: 120 }, (_, i) => {
      const d = new Date(Date.UTC(2023, 0, 3) + i * 86400000)
      return [d.toISOString().slice(0, 10), '1.50']
    })
    expect(checkFile(csvOf(rows)).ok).toBe(true)
  })

  it('names the missing Price column', () => {
    const r = checkFile('"Date","Foo"\n"01/03/2023","1"')
    expect(r.problems).toEqual([
      {
        row: 0,
        message: 'File is missing the Price column. Add a column named Price and upload again.',
      },
    ])
  })

  it('reports each missing required column', () => {
    const r = checkFile('"Foo","Bar"\n"x","1"')
    expect(r.problems).toEqual([
      {
        row: 0,
        message: 'File is missing the Date column. Add a column named Date and upload again.',
      },
      {
        row: 0,
        message: 'File is missing the Price column. Add a column named Price and upload again.',
      },
    ])
  })

  it('keeps a blank volume as undefined and parses K, M, B suffixes', () => {
    const csv = [
      '"Date","Price","Vol."',
      '"01/03/2023","1.00",""',
      '"01/04/2023","1.10","2.5M"',
      '"01/05/2023","1.20","300K"',
      '"01/06/2023","1.30","1.2B"',
    ].join('\n')
    const r = checkFile(csv)
    expect(r.rows[0].vol).toBeUndefined()
    expect(r.rows[1].vol).toBe(2.5)
    expect(r.rows[2].vol).toBe(0.3)
    expect(r.rows[3].vol).toBe(1200)
  })

  it('reversed bundled file still passes and gives identical analysis', () => {
    const lines = bundledCsv.trim().split('\n')
    const reversed = [lines[0], ...lines.slice(1).reverse()].join('\n')
    const r = checkFile(reversed)
    expect(r.ok).toBe(true)
    expect(analyze(r.rows)).toEqual(analyze(checkFile(bundledCsv).rows))
  })

  it('shuffled file fails with an out of order problem', () => {
    const lines = bundledCsv.trim().split('\n')
    const data = lines.slice(1)
    // deterministic shuffle (LCG)
    let seed = 42
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[data[i], data[j]] = [data[j], data[i]]
    }
    const r = checkFile([lines[0], ...data].join('\n'))
    expect(r.ok).toBe(false)
    expect(r.problems.some((p) => p.message.includes('out of order'))).toBe(true)
  })
})

describe('checkFileSize', () => {
  it('refuses files over 5 MB', () => {
    expect(checkFileSize(MAX_FILE_BYTES + 1)).toBe(
      'File is larger than 5 MB. Choose a smaller CSV file.',
    )
    expect(checkFileSize(MAX_FILE_BYTES)).toBeNull()
    expect(checkFileSize(1024)).toBeNull()
  })
})

describe('analyze', () => {
  const rows = checkFile(bundledCsv).rows
  const a = analyze(rows)

  it('matches the shared reference values', () => {
    expect(rows).toHaveLength(930)
    expect(a.latest).toBe(0.59)
    expect(a.latestIso).toBe('2026-10-21')
    expect(a.change.toFixed(2)).toBe('0.00')
    expect(a.avg30.toFixed(2)).toBe('0.60')
    expect(a.avg90.toFixed(2)).toBe('0.69')
    expect(a.avgPrice.toFixed(2)).toBe('1.71')
    expect(a.high).toEqual({ v: 3.69, iso: '2023-10-19' })
    expect(a.low).toEqual({ v: 0.54, iso: '2026-10-08' })
    expect(a.first).toBe(2.81)
    expect(a.firstIso).toBe('2023-01-03')
    expect(a.totalChange.toFixed(1)).toBe('-79.0')
    expect(a.trend).toBe('Downward')
    expect(a.forecast30.toFixed(2)).toBe('0.51')
    expect(a.forecastPct.toFixed(1)).toBe('-13.2')
    expect(a.mae!.toFixed(2)).toBe('0.06')
    expect(a.maxError!.toFixed(2)).toBe('0.11')
    expect(a.mape!.toFixed(1)).toBe('10.5')
    expect(recommend(a).decision).toBe('SELL')
  })

  it('first 928 rows reproduce the paper column', () => {
    const a928 = analyze(rows.slice(0, 928))
    expect(a928.latestIso).toBe('2026-10-19')
    expect(a928.latest).toBe(0.59)
    expect(a928.change.toFixed(2)).toBe('-1.67')
    expect(a928.avg30.toFixed(2)).toBe('0.60')
    expect(a928.avg90.toFixed(2)).toBe('0.69')
  })

  it('produces a 30 point forecast on the next weekdays', () => {
    expect(a.forecast).toHaveLength(30)
    expect(a.forecast[29].v).toBeCloseTo(a.forecast30, 10)
    for (let i = 0; i < a.forecast.length; i++) {
      const f = a.forecast[i]
      expect(f.upper!).toBeGreaterThanOrEqual(f.v)
      expect(f.lower!).toBeLessThanOrEqual(f.v)
      if (i > 0) {
        const prevSpread = a.forecast[i - 1].upper! - a.forecast[i - 1].lower!
        const currSpread = f.upper! - f.lower!
        expect(currSpread).toBeGreaterThanOrEqual(prevSpread)
      }
    }
    for (const f of a.forecast) {
      const d = new Date(f.t).getUTCDay()
      expect(d).not.toBe(0)
      expect(d).not.toBe(6)
    }
  })

  it('keeps blank volume as null', () => {
    const csv = [
      '"Date","Price","Vol."',
      '"01/03/2023","1.00",""',
      '"01/04/2023","1.10","2.5M"',
      '"01/05/2023","1.20",""',
    ].join('\n')
    const r = checkFile(csv)
    const res = analyze(r.rows)
    expect(res.vol).toEqual([null, 2.5, null])
  })
})

describe('analyze guard', () => {
  it('does not crash on 0 or 1 rows', () => {
    const empty = analyze([])
    expect(empty.latest).toBe(0)
    expect(empty.forecast).toEqual([])
    const one = analyze([{ iso: '2023-01-03', t: Date.UTC(2023, 0, 3), price: 2.81 }])
    expect(one.latest).toBe(2.81)
    expect(one.mape).toBeNull()
  })
})

describe('recommend', () => {
  const a = analyze(checkFile(bundledCsv).rows)
  it('SELL on the bundled data', () => {
    const rec = recommend(a)
    expect(rec.decision).toBe('SELL')
    expect(rec.conditions[0].yes).toBe(true)
    expect(rec.conditions[1].yes).toBe(true)
  })

  it('HOLD when averages rise and the forecast is higher', () => {
    expect(
      recommend({ avg30: 0.9, avg90: 0.6, forecast30: 1.2, latest: 0.8 }).decision,
    ).toBe('HOLD')
  })

  it('WAIT AND WATCH when only one condition is true', () => {
    expect(
      recommend({ avg30: 0.5, avg90: 0.7, forecast30: 1.0, latest: 0.8 }).decision,
    ).toBe('WAIT AND WATCH')
    expect(
      recommend({ avg30: 0.9, avg90: 0.7, forecast30: 0.4, latest: 0.8 }).decision,
    ).toBe('WAIT AND WATCH')
  })

  it('treats equality as not true in either direction', () => {
    expect(
      recommend({ avg30: 0.7, avg90: 0.7, forecast30: 0.8, latest: 0.8 }).decision,
    ).toBe('WAIT AND WATCH')
    expect(
      recommend({ avg30: 0.7, avg90: 0.7, forecast30: 0.9, latest: 0.8 }).decision,
    ).toBe('WAIT AND WATCH')
  })
})

describe('fmtPct', () => {
  it('shows a sign and 2 decimals, no sign on zero', () => {
    expect(fmtPct(0)).toBe('0.00%')
    expect(fmtPct(-1.666)).toBe('-1.67%')
    expect(fmtPct(2)).toBe('+2.00%')
  })
})

describe('new Phase 3 helpers', () => {
  it('fmtPctAbs renders magnitude with 2 decimals and no sign', () => {
    expect(fmtPctAbs(10.54)).toBe('10.54%')
    expect(fmtPctAbs(0)).toBe('0.00%')
  })

  it('nearestEarlierIso finds exact, earlier, and none', () => {
    const isos = ['2026-10-15', '2026-10-16', '2026-10-19', '2026-10-21']
    expect(nearestEarlierIso(isos, '2026-10-16')).toBe('2026-10-16')
    expect(nearestEarlierIso(isos, '2026-10-18')).toBe('2026-10-16')
    expect(nearestEarlierIso(isos, '2026-10-01')).toBeNull()
    expect(nearestEarlierIso(isos, '2026-12-01')).toBe('2026-10-21')
  })

  it('pageCount never returns below 1', () => {
    expect(pageCount(0, 25)).toBe(1)
    expect(pageCount(930, 25)).toBe(38)
  })

  it('limitations fills the live first and last dates', () => {
    const lines = limitations('2023-01-03', '2026-10-21')
    expect(lines).toHaveLength(7)
    expect(lines[0]).toBe('Public data from Investing.com.')
    expect(lines[1]).toBe(
      'Daily prices from Jan 3, 2023 to Oct 21, 2026 of the loaded file only.',
    )
    expect(lines[2]).toBe('Forecast covers 30 days only.')
    expect(lines[6]).toBe(
      'The system cannot confirm that prices match the source unless they are compared with it.',
    )
  })
})