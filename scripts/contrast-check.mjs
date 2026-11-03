// WCAG contrast audit for every text/graphic token pair used in the UI.
// Text needs >= 4.5:1; chart lines, control borders and focus rings need >= 3:1.
// Decorative borders/grid lines are listed as explicit exceptions below.
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8')

const vars = {}
for (const m of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})/g)) {
  vars[m[1]] = m[2]
}

const hex = (h) => {
  let s = h.replace('#', '')
  if (s.length === 3) s = s.split('').map((c) => c + c).join('')
  return [0, 1, 2].map((i) => parseInt(s.slice(i * 2, i * 2 + 2), 16) / 255)
}
const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
const lum = (h) => {
  const [r, g, b] = hex(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const C = (k, hex) => { vars[k] = hex; return hex }
const W = vars.white || '#FFFFFF'

// c-volume darkened from #B9C7DC to pass 3:1 for data bars
const volume = vars['c-volume']

const checks = [
  // [label, fg token, bg token, min, exempt reason or null]
  ['body text ink on white', 'ink', 'white', 4.5],
  ['secondary text ink-2 on white', 'ink-2', 'white', 4.5],
  ['links/active tab brand on white', 'brand', 'white', 4.5],
  ['brand-dk text on white', 'brand-dk', 'white', 4.5],
  ['sell text on white', 'sell', 'white', 4.5],
  ['hold text on white', 'hold', 'white', 4.5],
  ['wait word wait-text on white', 'wait-text', 'white', 4.5],
  ['white text on brand (primary btn)', 'white', 'brand', 4.5],
  ['white text on brand-dk (header)', 'white', 'brand-dk', 4.5],
  ['white text on sell tag', 'white', 'sell', 4.5],
  ['white text on hold tag', 'white', 'hold', 4.5],
  ['dark text #1A1300 on wait tag', '#1A1300', 'wait', 4.5],
  ['hold text on tagbg (greentag)', 'hold', 'tagbg', 4.5],
  ['DEMO tag ink-2 on canvas', 'ink-2', 'canvas', 4.5],
  ['ink-2 on ice panels', 'ink-2', 'ice', 4.5],
  ['error text err-text on err-bg', 'err-text', 'err-bg', 4.5],
  ['chart axis text on white', 'c-axis-text', 'white', 4.5],
  ['price line on white', 'c-price', 'white', 3],
  ['30d avg line on white', 'c-ma30', 'white', 3],
  ['90d avg line on white', 'c-ma90', 'white', 3],
  ['forecast line on white', 'c-forecast', 'white', 3],
  ['volume bars on white', volume, 'white', 3],
  ['control borders line-ctl on white', 'line-ctl', 'white', 3],
  ['focus ring brand on white', 'brand', 'white', 3],
  ['focus ring white on brand-dk header', 'white', 'brand-dk', 3],
  // exemptions: decorative only, carry no meaning by themselves
  ['card borders line/line-2 (decorative)', 'line-2', 'white', 3, 'decorative container border'],
  ['grid lines c-grid (decorative)', 'c-grid', 'white', 3, 'background grid, values carry labels'],
  ['forecast zone fill c-fzone (decorative)', 'c-fzone', 'white', 3, 'shaded zone, has text label'],
  ['header sky accent (decorative)', 'sky', 'brand-dk', 3, 'decorative underline in header'],
  ['tag/demo border line-2 (decorative)', 'line-2', 'canvas', 3, 'decorative border'],
]

let fails = 0
const rows = []
for (const [label, fg, bg, min, exempt] of checks) {
  const f = vars[fg] ?? fg
  const b = vars[bg] ?? bg
  const r = ratio(f, b)
  const pass = r >= min
  const mark = exempt ? (pass ? 'exempt-ok' : 'exempt') : pass ? 'PASS' : 'FAIL'
  if (!pass && !exempt) fails++
  rows.push({ label, fg: f, bg: b, ratio: +r.toFixed(2), need: min, mark, exempt })
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`=== CONTRAST CHECK (${rows.length} pairs) ===`)
for (const r of rows) {
  console.log(
    `${pad(r.mark, 9)} ${pad(r.ratio, 5)} needs ${pad(r.need, 4)} ${pad(r.fg, 8)} on ${pad(r.bg, 8)} ${r.label}${r.exempt ? ' [exception: ' + r.exempt + ']' : ''}`,
  )
}
const exempts = rows.filter((r) => r.exempt)
console.log(`\nexemptions (${exempts.length}):`)
for (const r of exempts) console.log(`  - ${r.label}: ${r.exempt}`)
if (fails) {
  console.error(`\n${fails} non-exempt contrast failure(s)`)
  process.exit(1)
}
console.log('\nALL PASS')
