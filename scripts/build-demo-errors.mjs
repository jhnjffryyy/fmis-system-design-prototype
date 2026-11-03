// Builds the 23-row demo file with planted errors from the bundled real file.
// Never edits the bundled file. Errors (1-based data rows, header excluded):
//   row 4: Price emptied, row 8: Date repeats row 7, rows 12/13 swapped,
//   row 18: Price set to "0.0000"
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src/data/prices/DITO-Historical-Data.csv')
const out = join(root, 'src/data/demo/DITO-demo-with-errors.csv')

const lines = readFileSync(src, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
const header = lines[0]
const rows = lines.slice(1, 24).map((l) => {
  if (!l.startsWith('"') || !l.endsWith('"')) throw new Error(`unexpected quoting: ${l}`)
  return l.slice(1, -1).split('","')
})
const encode = (f) => `"${f.join('","')}"`

rows[3][1] = ''
rows[7][0] = rows[6][0]
rows[17][1] = '0.0000'
;[rows[11], rows[12]] = [rows[12], rows[11]]

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, [header, ...rows.map(encode)].join('\n') + '\n')
console.log(`wrote ${out} (${rows.length} data rows)`)
