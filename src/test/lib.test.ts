import { describe, expect, it } from 'vitest'
import { parseCsv } from '../lib/csv'
import { checkFile } from '../lib/checks'
import { analyze } from '../lib/analysis'
import { recommend } from '../lib/recommend'
import cleanCsv from '../data/sample/DITO-Historical-Data.csv?raw'
import errorsCsv from '../data/sample/DITO-Historical-Data-with-errors.csv?raw'

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
  it('clean sample passes all checks', () => {
    const r = checkFile(cleanCsv)
    expect(r.ok).toBe(true)
    expect(r.problems).toEqual([])
    expect(r.records).toBe(927)
    expect(r.firstDate).toBe('2023-01-03')
    expect(r.lastDate).toBe('2026-10-19')
    expect(r.rows).toHaveLength(927)
    // sorted ascending
    expect(r.rows[0].iso).toBe('2023-01-03')
    expect(r.rows[926].iso).toBe('2026-10-19')
  })

  it('error sample reports exactly the 3 planted problems in row order', () => {
    const r = checkFile(errorsCsv)
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([
      { row: 15, message: 'Row 15: price is empty' },
      { row: 120, message: 'Row 120: date is repeated' },
      { row: 300, message: 'Row 300: price is zero' },
    ])
  })

  const csvOf = (rows: [string, string][]) =>
    ['"Date","Price"', ...rows.map(([d, p]) => `"${d}","${p}"`)].join('\n')

  it('flags a negative price as below zero', () => {
    const r = checkFile(csvOf([['01/03/2023', '2.00'], ['01/04/2023', '-0.50']]))
    expect(r.problems).toEqual([{ row: 2, message: 'Row 2: price is below zero' }])
  })

  it('flags a non-numeric price as empty', () => {
    const r = checkFile(csvOf([['01/03/2023', 'abc']]))
    expect(r.problems).toEqual([{ row: 1, message: 'Row 1: price is empty' }])
  })

  it('flags an unparseable date', () => {
    const r = checkFile(csvOf([['not a date', '1.00']]))
    expect(r.problems).toEqual([{ row: 1, message: 'Row 1: date is not valid' }])
  })

  it('accepts a consistently ascending file', () => {
    const r = checkFile(
      csvOf([['01/03/2023', '1.00'], ['01/04/2023', '1.10'], ['01/05/2023', '1.20']]),
    )
    expect(r.problems.filter((p) => !p.message.includes('at least 120'))).toEqual([])
  })

  it('accepts a consistently descending file', () => {
    const r = checkFile(
      csvOf([['01/05/2023', '1.20'], ['01/04/2023', '1.10'], ['01/03/2023', '1.00']]),
    )
    expect(r.problems.filter((p) => !p.message.includes('at least 120'))).toEqual([])
  })

  it('flags a direction break, flagging the later row', () => {
    const r = checkFile(
      csvOf([
        ['01/05/2023', '1.20'],
        ['01/04/2023', '1.10'],
        ['01/06/2023', '1.30'],
      ]),
    )
    expect(r.problems).toEqual([{ row: 3, message: 'Row 3: date is out of order' }])
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
    expect(r.problems).toEqual([{ row: 3, message: 'Row 3: date is repeated' }])
  })

  it('rejects a clean file with fewer than 120 records', () => {
    const rows: [string, string][] = Array.from({ length: 119 }, (_, i) => {
      const d = new Date(Date.UTC(2023, 0, 3) + i * 86400000)
      return [d.toISOString().slice(0, 10), '1.50']
    })
    const r = checkFile(csvOf(rows))
    expect(r.ok).toBe(false)
    expect(r.problems).toEqual([
      { row: 0, message: 'File needs at least 120 records (found 119)' },
    ])
  })

  it('accepts a clean file with 120 records', () => {
    const rows: [string, string][] = Array.from({ length: 120 }, (_, i) => {
      const d = new Date(Date.UTC(2023, 0, 3) + i * 86400000)
      return [d.toISOString().slice(0, 10), '1.50']
    })
    expect(checkFile(csvOf(rows)).ok).toBe(true)
  })

  it('reports a missing Date/Price header once', () => {
    const r = checkFile('"Foo","Bar"\n"x","1"')
    expect(r.problems).toEqual([
      { row: 0, message: 'File is missing the Date or Price column' },
    ])
  })
})

describe('analyze', () => {
  const rows = checkFile(cleanCsv).rows
  const a = analyze(rows)

  it('matches the shared numbers', () => {
    expect(rows).toHaveLength(927)
    expect(a.latest).toBe(0.59)
    expect(a.latestIso).toBe('2026-10-19')
    expect(a.change.toFixed(2)).toBe('-1.67')
    expect(a.avg30.toFixed(2)).toBe('0.60')
    expect(a.avg90.toFixed(2)).toBe('0.69')
    expect(a.high).toEqual({ v: 3.69, iso: '2023-10-19' })
    expect(a.low).toEqual({ v: 0.54, iso: '2026-10-08' })
    expect(a.first).toBe(2.81)
    expect(a.firstIso).toBe('2023-01-03')
    expect(Math.round(a.drop)).toBe(79)
    expect(a.trend).toBe('Downward')
    expect(a.forecast30).toBeCloseTo(0.4924, 3)
    expect(a.mape).toBeCloseTo(13.41, 1)
  })

  it('produces a 30 point forecast on the next weekdays', () => {
    expect(a.forecast).toHaveLength(30)
    expect(a.forecast[29].v).toBeCloseTo(a.forecast30, 10)
  })

  it('computes rigorous statistical diagnostics and confidence intervals', () => {
    expect(a.stats.olsSlope).toBeLessThan(0)
    expect(a.stats.olsSlope).toBeCloseTo(-0.00265, 4)
    expect(a.stats.regime).toBe('Downward (Death Cross)')
    expect(a.stats.crossoverGap).toBeCloseTo(-0.09, 2)
    expect(a.stats.olsR2).toBeGreaterThan(0)
    expect(a.stats.olsStdErr).toBeGreaterThan(0)
    expect(a.mae).toBeGreaterThan(0)
    expect(a.maxError).toBeGreaterThan(a.mae!)
    expect(a.forecastPct).toBeLessThan(0)

    for (let i = 0; i < a.forecast.length; i++) {
      const f = a.forecast[i]
      expect(f.lower).toBeDefined()
      expect(f.upper).toBeDefined()
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
  const a = analyze(checkFile(cleanCsv).rows)
  it('SELL on the sample data', () => {
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

  it('treats equality as not true', () => {
    expect(
      recommend({ avg30: 0.7, avg90: 0.7, forecast30: 0.8, latest: 0.8 }).decision,
    ).toBe('WAIT AND WATCH')
  })
})
