import { describe, expect, it } from 'vitest'
import { checkFile } from '../lib/checks'
import { analyze } from '../lib/analysis'
import { recommend } from '../lib/recommend'
import reversedCsv from '../../docs/qa/files/reversed.csv?raw'
import shuffledCsv from '../../docs/qa/files/shuffled.csv?raw'
import missingPriceCsv from '../../docs/qa/files/missing-price.csv?raw'
import badDateCsv from '../../docs/qa/files/bad-date.csv?raw'
import testHoldCsv from '../../docs/qa/files/test-hold.csv?raw'
import testWaitCsv from '../../docs/qa/files/test-wait.csv?raw'
import testSellCsv from '../../docs/qa/files/test-sell.csv?raw'

const FIXTURES: Record<string, string> = {
  'reversed.csv': reversedCsv,
  'shuffled.csv': shuffledCsv,
  'missing-price.csv': missingPriceCsv,
  'bad-date.csv': badDateCsv,
  'test-hold.csv': testHoldCsv,
  'test-wait.csv': testWaitCsv,
  'test-sell.csv': testSellCsv,
}

const load = (name: string) => {
  const text = FIXTURES[name]
  const r = checkFile(text)
  return { text, r, a: r.ok ? analyze(r.rows) : null }
}

describe('QA fixture files', () => {
  it('reversed bundled file passes', () => {
    const { r } = load('reversed.csv')
    expect(r.ok).toBe(true)
    expect(r.records).toBe(930)
  })

  it('shuffled file fails with out-of-order', () => {
    const { r } = load('shuffled.csv')
    expect(r.ok).toBe(false)
    expect(r.problems.some((p) => p.message.includes('out of order'))).toBe(true)
  })

  it('missing Price column names the column', () => {
    const { r } = load('missing-price.csv')
    expect(r.ok).toBe(false)
    expect(r.problems[0].message).toContain('Price')
  })

  it('bad date file names the row', () => {
    const { r } = load('bad-date.csv')
    expect(r.ok).toBe(false)
    expect(r.problems[0].message).toBe('Row 10: date is not valid. Use MM/DD/YYYY or YYYY-MM-DD.')
  })

  it('rising series recommends HOLD', () => {
    const { a } = load('test-hold.csv')
    expect(a).not.toBeNull()
    expect(recommend(a!).decision).toBe('HOLD')
  })

  it('falling then rising series recommends WAIT AND WATCH', () => {
    const { a } = load('test-wait.csv')
    expect(a).not.toBeNull()
    expect(recommend(a!).decision).toBe('WAIT AND WATCH')
  })

  it('falling series recommends SELL', () => {
    const { a } = load('test-sell.csv')
    expect(a).not.toBeNull()
    expect(recommend(a!).decision).toBe('SELL')
  })
})

describe('performance (NFR-1)', () => {
  it('checkFile + analyze on 5000 rows stays under 1000 ms', () => {
    // deterministic synthetic file, 5000 weekday rows
    const lines = ['"Date","Price"']
    const d = new Date(Date.UTC(2007, 0, 1))
    for (let i = 0; i < 5000; i++) {
      while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
      lines.push(`"${d.toISOString().slice(0, 10)}","${(0.5 + i * 0.001).toFixed(4)}"`)
      d.setUTCDate(d.getUTCDate() + 1)
    }
    const t0 = performance.now()
    const r = checkFile(lines.join('\r\n'))
    const a = analyze(r.rows)
    const ms = performance.now() - t0
    console.log(`checkFile+analyze on 5000 rows: ${ms.toFixed(1)} ms`)
    expect(r.ok).toBe(true)
    expect(a.rows).toHaveLength(5000)
    expect(ms).toBeLessThan(1000)
  })
})
