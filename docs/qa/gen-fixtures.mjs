// Generates the QA fixture files under docs/qa/files/.
// Deterministic; reversed/shuffled derive from the bundled real file.
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'files')
const csv = readFileSync(join(ROOT, 'src/data/prices/DITO-Historical-Data.csv'), 'utf8')
const lines = csv.trimEnd().split(/\r?\n/)
const header = lines[0]
const rows = lines.slice(1)

// 1. reversed: oldest first (valid)
writeFileSync(join(OUT, 'reversed.csv'), [header, ...[...rows].reverse()].join('\r\n') + '\r\n')

// 2. shuffled: deterministic interleave -> dates out of order
const mid = Math.floor(rows.length / 2)
const shuffled = []
for (let i = 0; i < mid; i++) {
  shuffled.push(rows[i])
  if (mid + i < rows.length) shuffled.push(rows[mid + i])
}
writeFileSync(join(OUT, 'shuffled.csv'), [header, ...shuffled].join('\r\n') + '\r\n')

// 3. missing Price column
const noPrice = rows.map((r) => r.replace(/,"[^"]*","[^"]*","[^"]*","[^"]*","[^"]*","[^"]*"$/, ''))
writeFileSync(
  join(OUT, 'missing-price.csv'),
  ['"Date","Open","High","Low","Vol.","Change %"'.replace(/,$/, ''), ...noPrice].join('\r\n') + '\r\n',
)

// 4. not a csv
writeFileSync(join(OUT, 'not-a-csv.txt'), 'this is not a csv file\r\n'.repeat(4))

// 5. > 5 MB csv
{
  const parts = [header]
  let size = header.length
  const block = rows.slice(0, 400)
  const blockBytes = block.join('\r\n').length
  while (size < 6 * 1024 * 1024) {
    parts.push(...block)
    size += blockBytes
  }
  writeFileSync(join(OUT, 'too-big.csv'), parts.join('\r\n') + '\r\n')
}

// 6. bad date: row 10 (data row) has 02/31/2026
{
  const bad = rows.slice(0, 130).map((r) => r.replace(/^"[^"]+"/, (m) => m))
  bad[9] = bad[9].replace(/^"[^"]+"/, '"02/31/2026"')
  writeFileSync(join(OUT, 'bad-date.csv'), [header, ...bad].join('\r\n') + '\r\n')
}

// synthetic series: weekday dates from 2026-01-05, N rows
function series(n, priceFn) {
  const out = ['"Date","Price"']
  const d = new Date(Date.UTC(2026, 0, 5))
  for (let i = 0; i < n; i++) {
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1)
    const iso = d.toISOString().slice(0, 10)
    out.push(`"${iso}","${priceFn(i).toFixed(4)}"`)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out.join('\r\n') + '\r\n'
}
// HOLD: steady rise
writeFileSync(join(OUT, 'test-hold.csv'), series(200, (i) => 0.5 + i * 0.02))
// SELL: steady fall
writeFileSync(join(OUT, 'test-sell.csv'), series(200, (i) => 4 - i * 0.01))
// WAIT: long fall, then sharp recent rise -> signals mixed
writeFileSync(
  join(OUT, 'test-wait.csv'),
  series(200, (i) => (i < 170 ? 4 - i * 0.012 : 1.96 + (i - 170) * 0.1)),
)
console.log('fixtures written to', OUT)
