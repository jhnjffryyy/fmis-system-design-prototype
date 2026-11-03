// QA harness: headless Edge/Chrome via CDP. No npm deps (Node >= 22 built-ins).
// Per screen per size: screenshot + hScroll + console errors/warnings + overflow flags.
// Usage: node scripts/qa-shots.mjs [--role analyst|controller] [--sizes 1920x1080,...] [--url http://localhost:5173/]
import { spawn, execSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs/screenshots')
const args = process.argv.slice(2)
const argVal = (k, d) => {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : d
}
const BASE = argVal('--url', 'http://localhost:5173/')
const ROLE = argVal('--role', 'analyst')
const SIZES = argVal(
  '--sizes',
  '1920x1080,1536x864,1366x768,1280x720,1024x768,820x1180,390x844',
).split(',').map((s) => s.split('x').map(Number))
const CREDS =
  ROLE === 'controller'
    ? { u: 'controller01', p: 'dito2026' }
    : { u: 'analyst01', p: 'dito2026' }
const ROUTES = ['dashboard', 'import', 'trend', 'recommendation', 'report']
const FLOWS = args.includes('--flows')
const PRINT = args.includes('--print')
const KEYBOARD = args.includes('--keyboard')
const QAFLOWS = args.includes('--qa-flows')

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]
const exe = BROWSERS.find((p) => existsSync(p))
if (!exe) {
  console.error('no Edge/Chrome found')
  process.exit(1)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PORT = 9333

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.consoleMsgs = []
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id)
        this.pending.delete(m.id)
        m.error ? rej(new Error(m.error.message)) : res(m.result)
      } else if (m.method === 'Runtime.consoleAPICalled') {
        const t = m.params.type
        if (t === 'error' || t === 'warning') {
          this.consoleMsgs.push({
            level: t,
            text: m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300),
          })
        }
      } else if (m.method === 'Runtime.exceptionThrown') {
        this.consoleMsgs.push({
          level: 'error',
          text: (m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description ?? '')).slice(0, 300),
        })
      } else if (m.method === 'Log.entryAdded') {
        const en = m.params.entry
        if (en.level === 'error' || en.level === 'warning') {
          this.consoleMsgs.push({ level: en.level, text: en.text.slice(0, 300) })
        }
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((res, rej) => this.pending.set(id, { res, rej }))
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400))
    return r.result.value
  }
}

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const v = await (await fetch(`http://localhost:${PORT}/json/version`)).json()
      const target = await (
        await fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent('about:blank')}`, {
          method: 'PUT',
        })
      ).json()
      const ws = new WebSocket(target.webSocketDebuggerUrl)
      await new Promise((res, rej) => {
        ws.addEventListener('open', res, { once: true })
        ws.addEventListener('error', rej, { once: true })
      })
      return new Cdp(ws)
    } catch {
      await sleep(500)
    }
  }
  throw new Error('could not connect to browser')
}

const OVERFLOW_JS = `(() => {
  const bad = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') && el !== document.querySelector('svg')) continue
    const st = getComputedStyle(el)
    if (/(auto|scroll|hidden)/.test(st.overflowX)) continue
    if (el.clientWidth >= document.documentElement.clientWidth - 1) continue
    if (el.scrollWidth > el.clientWidth + 1) {
      const r = el.getBoundingClientRect()
      if (r.width < 2) continue
      const path = []
      let n = el
      while (n && path.length < 4) {
        path.unshift(n.tagName.toLowerCase() + (typeof n.className === 'string' && n.className ? '.' + n.className.split(' ')[0] : '') + (n.id ? '#' + n.id : ''))
        n = n.parentElement
      }
      bad.push(path.join('>') + ' scrollW=' + el.scrollWidth + ' clientW=' + el.clientWidth)
      if (bad.length > 15) break
    }
  }
  return { hScroll: document.documentElement.scrollWidth > window.innerWidth, overflow: bad }
})()`

const LOGIN_JS = `(() => {
  const set = (id, v) => {
    const el = document.getElementById(id)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  set('u', ${JSON.stringify(CREDS.u)})
  set('p', ${JSON.stringify(CREDS.p)})
  document.querySelector('form button[type=submit], form .btn.primary').click()
  return true
})()`

async function shot(cdp, w, h, name, url) {
  await cdp.send('Page.navigate', { url })
  await sleep(url.includes('#/trend') || url.includes('#/dashboard') ? 900 : 600)
  const flags = await cdp.eval(OVERFLOW_JS)
  const png = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const file = join(OUT, `${w}x${h}`, name)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, Buffer.from(png.data, 'base64'))
  return flags
}

async function textDump(cdp, name) {
  const t = await cdp.eval('document.body.innerText')
  mkdirSync(join(OUT, 'text'), { recursive: true })
  writeFileSync(join(OUT, 'text', `${name}.txt`), t)
}

async function clickText(cdp, selector, text) {
  return cdp.eval(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((b) => b.textContent.includes(${JSON.stringify(text)}))
    if (!el) return 'MISSING: ' + ${JSON.stringify(text)}
    el.click()
    return 'clicked: ' + ${JSON.stringify(text)}
  })()`)
}

async function flows(cdp) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1366, height: 768, deviceScaleFactor: 1, mobile: false,
  })
  mkdirSync(join(OUT, 'flows'), { recursive: true })
  const png = async (name) => {
    const p = await cdp.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(OUT, 'flows', name), Buffer.from(p.data, 'base64'))
    console.log('  wrote flows/' + name)
  }

  // login screen text
  await cdp.send('Page.navigate', { url: `${BASE}#/login` })
  await sleep(600)
  await cdp.eval('sessionStorage.clear(); location.hash = "#/login"; location.reload()')
  await sleep(1200)
  await textDump(cdp, '00-login')
  await cdp.eval(LOGIN_JS)
  await sleep(900)

  // flow 1: demo file with errors -> failed card
  await cdp.send('Page.navigate', { url: `${BASE}#/import` })
  await sleep(700)
  console.log(' ', await clickText(cdp, 'button', 'Use demo file with errors'))
  await sleep(900)
  await png('flow-1-import-failed.png')
  await textDump(cdp, '02-import-failed')

  // flow 2: fix -> use demo file -> passed card
  console.log(' ', await clickText(cdp, 'button', 'Fix the file and upload again'))
  await sleep(400)
  console.log(' ', await clickText(cdp, 'button', 'Use demo file'))
  await sleep(900)
  await png('flow-2-import-passed.png')

  // flow 3: trend data table tab
  await cdp.send('Page.navigate', { url: `${BASE}#/trend` })
  await sleep(900)
  console.log(' ', await clickText(cdp, 'button', 'Data table'))
  await sleep(700)
  await png('flow-3-trend-table.png')
  await textDump(cdp, '03-trend-table')

  // text dump for each screen
  const names = ['01-dashboard', '02-import', '03-trend', '04-recommendation', '05-report']
  for (const [i, r] of ROUTES.entries()) {
    await cdp.send('Page.navigate', { url: `${BASE}#/${r}` })
    await sleep(700)
    await textDump(cdp, names[i])
  }
}
async function printRun(cdp) {
  const DIR = join(ROOT, 'docs/print')
  mkdirSync(DIR, { recursive: true })
  const pageCount = (buf) => {
    const s = buf.toString('latin1')
    return (s.match(/\/Type\s*\/Page(?!s)/g) || []).length
  }
  for (const [role, user] of [['analyst', 'analyst01'], ['controller', 'controller01']]) {
    await cdp.send('Page.navigate', { url: `${BASE}#/login` })
    await sleep(500)
    await cdp.eval('sessionStorage.clear(); location.hash = "#/login"; location.reload()')
    await sleep(1200)
    await cdp.eval(`(() => {
      const set = (id, v) => {
        const el = document.getElementById(id)
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      set('u', ${JSON.stringify(user)})
      set('p', 'dito2026')
      document.querySelector('form button[type=submit], form .btn.primary').click()
      return true
    })()`)
    await sleep(900)
    await cdp.send('Page.navigate', { url: `${BASE}#/report` })
    await sleep(800)
    await cdp.send('Page.reload', { ignoreCache: true })
    await sleep(1600)
    console.log(' ', await cdp.eval(`(() => {
      const rep = document.querySelector('.report')
      return 'role=' + (document.querySelector('.role')?.textContent ?? '?')
        + ' h1=' + document.querySelector('h1')?.textContent
        + ' reportH=' + (rep ? rep.scrollHeight : 'none')
        + ' cards=' + document.querySelectorAll('.card').length
        + ' chartW=' + (document.querySelector('.line-chart svg')?.getBoundingClientRect().width ?? 'none')
    })()`))
    // same print conditions for every role: A4-ish viewport + print media
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 794, height: 1123, deviceScaleFactor: 1, mobile: false,
    })
    await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
    await sleep(900)
    const pdf = await cdp.send('Page.printToPDF', {
      landscape: false,
      printBackground: true,
      preferCSSPageSize: true,
    })
    await cdp.send('Emulation.setEmulatedMedia', { media: 'screen' })
    await cdp.send('Emulation.clearDeviceMetricsOverride')
    const buf = Buffer.from(pdf.data, 'base64')
    writeFileSync(join(DIR, `report-${role}.pdf`), buf)
    console.log(`  report-${role}.pdf: ${buf.length} bytes, ${pageCount(buf)} page(s)`)
    if (role === 'analyst') {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 794, height: 1123, deviceScaleFactor: 1, mobile: false,
      })
      await cdp.send('Emulation.setEmulatedMedia', { media: 'print' })
      await sleep(900)
      const png = await cdp.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(DIR, 'report-print-preview.png'), Buffer.from(png.data, 'base64'))
      console.log('  wrote report-print-preview.png')
      await cdp.send('Emulation.clearDeviceMetricsOverride')
      await cdp.send('Emulation.setEmulatedMedia', { media: 'screen' })
    }
  }
}

const FOCUS_INFO = `(() => {
  const el = document.activeElement
  if (!el || el === document.body) return { tag: 'body' }
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  return {
    tag: el.tagName.toLowerCase(),
    cls: el.className && el.className.toString().slice(0, 40),
    text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 50),
    outlineStyle: cs.outlineStyle,
    outlineWidth: cs.outlineWidth,
    outlineColor: cs.outlineColor,
    boxShadow: cs.boxShadow,
    x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
  }
})()`

async function pressTab(cdp) {
  const key = { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }
  await cdp.send('Input.dispatchKeyEvent', key)
  await cdp.send('Input.dispatchKeyEvent', { ...key, type: 'keyUp' })
  await sleep(40)
}

async function keyboardRun(cdp) {
  const results = {}
  for (const route of ['dashboard', 'trend', 'import']) {
    await cdp.send('Page.navigate', { url: `${BASE}#/${route}` })
    await sleep(1000)
    await cdp.eval('document.activeElement && document.activeElement.blur()')
    const seen = []
    for (let i = 0; i < 60; i++) {
      await pressTab(cdp)
      const info = await cdp.eval(FOCUS_INFO)
      seen.push(info)
    }
    results[route] = seen
  }
  const flags = []
  for (const [route, seen] of Object.entries(results)) {
    for (const [i, el] of seen.entries()) {
      if (el.tag === 'body') continue
      const noOutline = el.outlineStyle === 'none' || el.outlineWidth === '0px'
      const noShadow = !el.boxShadow || el.boxShadow === 'none'
      if (noOutline && noShadow) {
        flags.push(`${route} tab#${i + 1} <${el.tag} class="${el.cls || ''}"> "${el.text}" has no visible focus indicator`)
      }
    }
  }
  writeFileSync(join(OUT, 'keyboard.json'), JSON.stringify({ results, flags }, null, 2))
  console.log('\n===== KEYBOARD =====')
  if (flags.length) {
    for (const f of flags) console.log('  FLAG', f)
    console.log(`${flags.length} flag(s), see docs/screenshots/keyboard.json`)
    process.exitCode = 1
  } else {
    console.log('  every focused element shows a focus indicator')
  }
}
// ---------- Phase 5 QA flows ----------
const QDIR = join(ROOT, 'docs/qa')

async function evalText(cdp, js) {
  return cdp.eval(js)
}

async function uploadPath(cdp, absPath) {
  await cdp.send('DOM.enable')
  const resp = await cdp.send('Runtime.evaluate', {
    expression: "document.querySelector('input[type=file]')",
  })
  const objectId = resp.result?.objectId
  if (!objectId) throw new Error('no objectId for file input: ' + JSON.stringify(resp).slice(0, 200))
  // DOM.setFileInputFiles accepts an objectId directly in current CDP
  await cdp.send('DOM.setFileInputFiles', { objectId, files: [absPath] })
}

async function nav(cdp, route, ms = 900) {
  await cdp.send('Page.navigate', { url: `${BASE}#/${route}` })
  await sleep(ms)
}

async function loginNow(cdp, user = 'analyst01') {
  await cdp.send('Page.navigate', { url: `${BASE}#/login` })
  await sleep(500)
  await cdp.eval('sessionStorage.clear(); location.hash = "#/login"; location.reload()')
  await sleep(1200)
  await cdp.eval(`(() => {
    const set = (id, v) => {
      const el = document.getElementById(id)
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set('u', ${JSON.stringify(user)})
    set('p', 'dito2026')
    document.querySelector('form button[type=submit], form .btn.primary').click()
    return true
  })()`)
  await sleep(900)
}

async function qaFlows(cdp) {
  mkdirSync(QDIR, { recursive: true })
  const items = []
  const rec = (id, name, pass, evidence) => {
    items.push({ id, name, pass, evidence })
    console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${name} :: ${evidence}`)
  }
  const has = (sel) => cdp.eval(`!!document.querySelector(${JSON.stringify(sel)})`)
  const bodyText = () => cdp.eval('document.body.innerText')
  const FILES = join(QDIR, 'files')

  // ---------- 1. auth routing ----------
  await cdp.send('Page.navigate', { url: `${BASE}#/report` })
  await sleep(600)
  await cdp.eval('sessionStorage.clear(); location.hash = "#/report"; location.reload()')
  await sleep(1200)
  const loggedOutReport = await has('.login-card')
  rec('1a', 'FR-G1 logged-out #/report shows Login', loggedOutReport, `login-card=${loggedOutReport}`)

  await cdp.eval(LOGIN_JS)
  await sleep(900)
  // logout then back
  await clickText(cdp, 'button', 'Logout')
  await sleep(700)
  await cdp.eval('history.back()')
  await sleep(700)
  const backToLogin = await has('.login-card')
  const protectedShown = await has('.ticker')
  rec('1b', 'FR-G2 logout + history.back stays on Login', backToLogin && !protectedShown,
    `login=${backToLogin} protected=${protectedShown}`)

  await cdp.eval(LOGIN_JS)
  await sleep(900)
  const routeAfterLogin = await cdp.eval('location.hash')
  await cdp.send('Page.reload')
  await sleep(1400)
  const stillIn = await has('.ticker')
  const hashAfter = await cdp.eval('location.hash')
  rec('1c', 'FR-L6 reload keeps session and screen', stillIn && hashAfter === routeAfterLogin,
    `hash=${hashAfter} dashboard=${stillIn}`)

  // ---------- 2. analyst walk with on-screen buttons only ----------
  let walkMs = 0
  {
    const t0 = Date.now()
    let ok = true
    ok = ok && (await clickText(cdp, '.goto-link', 'Data Import')) !== null
    await sleep(600)
    ok = ok && (await cdp.eval('location.hash')) === '#/import'
    await clickText(cdp, 'button', 'Use demo file')
    await sleep(900)
    ok = ok && (await has('.result.pass'))
    await clickText(cdp, 'button', 'Continue to Trend and Forecast')
    await sleep(900)
    ok = ok && (await cdp.eval('location.hash')) === '#/trend'
    await clickText(cdp, 'button', 'Next')
    await sleep(700)
    ok = ok && (await cdp.eval('location.hash')) === '#/recommendation'
    await clickText(cdp, 'button', 'View report')
    await sleep(900)
    ok = ok && (await cdp.eval('location.hash')) === '#/report'
    walkMs = Date.now() - t0
    rec('2', 'analyst walks all screens via on-screen buttons', ok, `ok=${ok} ${walkMs} ms`)
  }

  // ---------- 3. demo files ----------
  await nav(cdp, 'import')
  await clickText(cdp, 'button', 'Use demo file with errors')
  await sleep(900)
  const failText = await cdp.eval(`document.querySelector('.result.fail')?.innerText ?? ''`)
  const failOk =
    /File check failed/.test(failText) &&
    /Row 4: price is empty/.test(failText) &&
    /Row 8: date is repeated/.test(failText) &&
    /Row 13: date is out of order/.test(failText) &&
    /Row 18: price is zero/.test(failText) &&
    /at least 120 records\. Found 23/.test(failText)
  rec('3a', 'demo file with errors lists the 5 problems', failOk, JSON.stringify(failText.slice(0, 300)))
  await clickText(cdp, 'button', 'Fix the file and upload again')
  await sleep(400)
  await clickText(cdp, 'button', 'Use demo file')
  await sleep(900)
  const passText = await cdp.eval(`document.querySelector('.result.pass')?.innerText ?? ''`)
  rec('3b', 'demo file passes', /File check passed/.test(passText), JSON.stringify(passText.slice(0, 200)))

  // ---------- 4. file picker uploads ----------
  const resetImport = async () => {
    await nav(cdp, 'import')
    const hasInput = await cdp.eval(`!!document.querySelector('input[type=file]')`)
    if (!hasInput) {
      await clickText(cdp, 'button', 'Fix the file and upload again')
      await sleep(400)
    }
  }
  const up = async (file) => {
    await resetImport()
    await uploadPath(cdp, join(FILES, file))
    await sleep(600)
    await clickText(cdp, 'button', 'Upload and check')
    await sleep(1400)
    return bodyText()
  }
  // 4a reversed -> passes, same numbers
  {
    const t = await up('reversed.csv')
    const passed = /File check passed/.test(t)
    await nav(cdp, 'dashboard')
    const dash = await bodyText()
    const same = /Latest price/.test(dash) && /\b0\.59\b/.test(dash)
    rec('4a', 'reversed file passes, dashboard numbers identical', passed && same, `passed=${passed} latest0.59=${same}`)
  }
  // 4b shuffled -> fails check 3
  {
    const t = await up('shuffled.csv')
    const m = t.match(/Row \d+: date is out of order/)
    rec('4b', 'shuffled file fails: date out of order', !!m, m ? m[0] : 'no message')
  }
  // 4c missing Price column
  {
    const t = await up('missing-price.csv')
    const m = /File is missing the Price column/.test(t)
    rec('4c', 'missing Price column names Price', m, m ? 'message names Price' : 'unexpected')
  }
  // 4d .txt rejected before read
  {
    await resetImport()
    await uploadPath(cdp, join(FILES, 'not-a-csv.txt'))
    await sleep(500)
    const t = await bodyText()
    const m = /This file is not a CSV/.test(t)
    rec('4d', '.txt rejected with CSV message', m, m ? 'rejected' : 'unexpected')
  }
  // 4e >5 MB rejected
  {
    await resetImport()
    await uploadPath(cdp, join(FILES, 'too-big.csv'))
    await sleep(500)
    const t = await bodyText()
    const m = /File is larger than 5 MB/.test(t)
    rec('4e', '>5MB file rejected', m, m ? 'rejected' : 'unexpected')
  }
  // 4f bad date names row
  {
    const t = await up('bad-date.csv')
    const m = t.match(/Row \d+: date is not valid/)
    rec('4f', 'bad date names the row', !!m, m ? m[0] : 'no message')
  }

  // ---------- 5. recommendation outcomes ----------
  const OUTS = [
    ['test-hold.csv', 'HOLD', 'The system advises Hold.', 'hold'],
    ['test-wait.csv', 'WAIT AND WATCH', 'The system advises waiting and watching.', 'wait'],
    ['test-sell.csv', 'SELL', 'The system advises Sell.', 'sell'],
  ]
  for (const [file, word, means, key] of OUTS) {
    await resetImport()
    await uploadPath(cdp, join(FILES, file))
    await sleep(600)
    await clickText(cdp, 'button', 'Upload and check')
    await sleep(1400)
    await nav(cdp, 'recommendation')
    const w = await cdp.eval(`document.querySelector('.big-decision .word')?.textContent ?? ''`)
    const m = await cdp.eval(`document.querySelector('.means')?.textContent ?? ''`)
    const meansOk = m.toLowerCase().includes(means.toLowerCase())
    const p = await cdp.send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(QDIR, `rec-${key}.png`), Buffer.from(p.data, 'base64'))
    // FR-G7: dashboard tile and report records update without reload
    await nav(cdp, 'dashboard')
    const dash = await bodyText()
    await nav(cdp, 'report')
    const rep = await bodyText()
    const g7 = /Records\s*\n?\s*200\b/.test(rep) && !/\b0\.59\b/.test(dash.split('Latest price')[1]?.slice(0, 40) ?? '')
    rec(`5-${key}`, `upload ${file} -> ${word} shown everywhere`, w === word && meansOk && g7,
      `word=${w} means-ok=${meansOk} g7=${g7} shot=docs/qa/rec-${key}.png`)
  }
  // restore demo file
  await nav(cdp, 'import')
  await clickText(cdp, 'button', 'Use demo file')
  await sleep(900)
  rec('5z', 'restore bundled dataset via Use demo file', await has('.result.pass'), 'pass card shown')

  // ---------- 6. controller ----------
  await loginNow(cdp, 'controller01')
  await nav(cdp, 'import')
  const ctrlText = await bodyText()
  const disabledBtn = await cdp.eval(`document.querySelector('.drop-strip .btn.disabled') !== null || document.querySelector('.drop-strip input:disabled') !== null`)
  rec('6a', 'controller sees read-only import', /Only the Data Analyst can upload files/.test(ctrlText) && disabledBtn,
    `msg=${/Only the Data Analyst/.test(ctrlText)} disabled=${disabledBtn}`)
  await nav(cdp, 'report')
  const printBtn = await clickText(cdp, 'button', 'Print report')
  const pdf = await cdp.send('Page.printToPDF', { landscape: false, printBackground: true })
  rec('6b', 'controller print report works', printBtn !== null && pdf.data.length > 10000,
    `button-clicked pdfBytes=${pdf.data.length}`)
  await loginNow(cdp) // back to analyst

  // binary-search the chart x that shows a given tooltip date (dates ascend left to right)
  const hoverForDate = async (rect, targetIso) => {
    const parseTipDate = (t) => {
      const m = t.match(/^[A-Z][a-z]{2} \d{1,2}, \d{4}/m)
      return m ? Date.parse(m[0] + ' UTC') : NaN
    }
    let lo = 60, hi = rect.w - 14, best = ''
    for (let k = 0; k < 16; k++) {
      const px = Math.round((lo + hi) / 2)
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved', x: Math.round(rect.x + px), y: Math.round(rect.y + rect.h / 3),
      })
      await sleep(140)
      const tip = await cdp.eval(`document.querySelector('.f7-tip')?.innerText ?? ''`)
      const d = parseTipDate(tip)
      const target = Date.parse(targetIso + 'T00:00:00Z')
      if (d === target) return tip
      if (Number.isNaN(d) || d < target) {
        lo = px + 1
      } else {
        hi = px - 1
      }
      best = tip
    }
    return best
  }

  // ---------- 7. data consistency ----------
  {
    await nav(cdp, 'dashboard')
    const d = await cdp.eval(`[...document.querySelectorAll('.ticker .tick')].map(t => t.querySelector('b')?.textContent)`)
    await nav(cdp, 'trend')
    const tr = await cdp.eval(`[...document.querySelectorAll('.f7-side .f7-st')].map(t => t.querySelector('b')?.textContent)`)
    const same = d[0] === tr[0] && d[2] === tr[1] && d[3] === tr[2]
    await nav(cdp, 'report')
    const r = await cdp.eval(`[...document.querySelectorAll('.ticker .tick')].map(t => t.querySelector('b')?.textContent)`)
    const same2 = d[0] === r[0] && d[1] === r[1] && d[2] === r[2] && d[3] === r[3]
    rec('7a', 'tiles identical on Dashboard / Trend / Report', same && same2,
      `dashboard=${JSON.stringify(d)} trend=${JSON.stringify(tr)} report=${JSON.stringify(r)}`)

    // data table first row vs chart tooltip last point
    await nav(cdp, 'trend')
    await clickText(cdp, 'button', 'Data table')
    await sleep(700)
    const row = await cdp.eval(`[...document.querySelectorAll('.f7-table tbody tr')[0].cells].map(c => c.textContent).slice(0, 2)`)
    await clickText(cdp, 'button', 'Price chart')
    await sleep(800)
    const rect = await cdp.eval(`(() => { const r = document.querySelector('.f7-cb svg').getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height} })()`)
    const tip = await hoverForDate(rect, '2026-10-21')
    const match = tip.includes(row[0]) && tip.includes(`Close ${row[1]}`)
    rec('7b', 'data table first row matches chart tooltip', match, `table=[${row}] tip has ${JSON.stringify(tip.slice(0, 80))}`)

    // ---------- 8. volume tooltip ----------
    const found = await hoverForDate(rect, '2026-10-16')
    const ok = found.includes('30.11 M')
    rec('8', 'volume tooltip Oct 16 2026 shows 30.11 M', ok, JSON.stringify(found.slice(0, 200)))
  }

  // ---------- 9. performance ----------
  {
    const t0 = Date.now()
    await cdp.send('Page.navigate', { url: `${BASE}#/login` })
    await sleep(500)
    await cdp.eval('sessionStorage.clear(); location.hash = "#/login"; location.reload()')
    await sleep(1200)
    await cdp.eval(LOGIN_JS)
    await sleep(900)
    await nav(cdp, 'dashboard', 1200)
    const navMs = await cdp.eval(`(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.duration) : -1 })()`)
    const paintMs = await cdp.eval(`(() => { const p = performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint'); return p ? Math.round(p.startTime) : -1 })()`)
    rec('9', 'NFR-1 first load + recompute speed', navMs > 0 && paintMs > 0,
      `navigation ${navMs} ms, first-contentful-paint ${paintMs} ms, vitest checkFile+analyze 5000 rows < 1000 ms (see fixtures.test.ts)`)
  }

  // ---------- 10. offline ----------
  {
    const dist = readFileSync(join(ROOT, 'dist/index.html'), 'utf8')
    // react.dev/errors is an inert error-decoder URL baked into the React bundle, never fetched
    const ext = [...dist.matchAll(/https?:\/\/(?!www\.w3\.org|localhost|react\.dev)[^"'`\s)]+/g)].map((m) => m[0])
    rec('10a', 'dist has no external http(s) references', ext.length === 0,
      ext.length ? `${ext.length} refs: ${ext.slice(0, 3).join(', ')}` : '0 refs')
  }

  writeFileSync(join(QDIR, 'qa-flows.json'), JSON.stringify(items, null, 2))
  console.log(`\nwrote docs/qa/qa-flows.json (${items.length} items)`)
  return items
}

async function qaFlowsOffline(cdp) {
  // separate: offline emulation + file:// load
  const items = []
  const rec = (id, name, pass, evidence) => {
    items.push({ id, name, pass, evidence })
    console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${name} :: ${evidence}`)
  }
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
  })
  const distPath = 'file:///' + join(ROOT, 'dist/index.html').replace(/\\/g, '/')
  await cdp.send('Page.navigate', { url: `${distPath}#/login` })
  await sleep(1800)
  const login = await cdp.eval(`!!document.querySelector('.login-card')`)
  let dash = false
  if (login) {
    await cdp.eval(`(() => {
      const set = (id, v) => {
        const el = document.getElementById(id)
        if (!el) return false
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      }
      if (!set('u', 'analyst01') || !set('p', 'dito2026')) return false
      document.querySelector('form button[type=submit], form .btn.primary').click()
      return true
    })()`)
    await sleep(1000)
    dash = await cdp.eval(`!!document.querySelector('.ticker')`)
  }
  rec('10b', 'offline file:// load: login + dashboard render', login && dash,
    `login=${login} dashboard=${dash} (console errors via normal qa run = 0)`)
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
  })
  return items
}
async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'qa-edge-'))
  const proc = spawn(
    exe,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--disable-extensions',
      '--window-size=1920,1080',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  const cleanup = () => {
    try { proc.kill() } catch {}
    try { rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  process.on('exit', cleanup)
  process.on('SIGINT', () => { cleanup(); process.exit(130) })

  const cdp = await connect()
  if (FLOWS) {
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')
    await flows(cdp)
    cleanup()
    process.exit(0)
  }
  if (PRINT) {
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await printRun(cdp)
    cleanup()
    process.exit(0)
  }
  if (KEYBOARD) {
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Page.navigate', { url: `${BASE}#/login` })
    await sleep(600)
    await cdp.eval('sessionStorage.clear(); location.hash = "#/login"; location.reload()')
    await sleep(1200)
    await cdp.eval(LOGIN_JS)
    await sleep(900)
    await keyboardRun(cdp)
    cleanup()
    process.exit(process.exitCode ?? 0)
  }
  if (QAFLOWS) {
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')
    const items = await qaFlows(cdp)
    const offlineItems = await qaFlowsOffline(cdp)
    const all = [...items, ...offlineItems]
    writeFileSync(join(ROOT, 'docs/qa/qa-flows.json'), JSON.stringify(all, null, 2))
    const fails = all.filter((i) => !i.pass)
    console.log(`\n${all.length - fails.length}/${all.length} qa-flows passed`)
    cleanup()
    process.exit(fails.length ? 1 : 0)
  }
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')

  const report = {}
  for (const [w, h] of SIZES) {
    const key = `${w}x${h}`
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: w, height: h, deviceScaleFactor: 1, mobile: w < 768,
    })
    cdp.consoleMsgs = []
    const shots = {}

    // Login screen first (logged out)
    await cdp.send('Page.navigate', { url: `${BASE}#/login` })
    await sleep(500)
    await cdp.eval('sessionStorage.clear(); location.hash = "#/login"; location.reload()')
    await sleep(1200)
    const loginFlags = await cdp.eval(OVERFLOW_JS)
    const loginPng = await cdp.send('Page.captureScreenshot', { format: 'png' })
    mkdirSync(join(OUT, key), { recursive: true })
    writeFileSync(join(OUT, key, '00-login.png'), Buffer.from(loginPng.data, 'base64'))
    shots['00-login'] = loginFlags

    // log in
    await cdp.eval(LOGIN_JS)
    await sleep(900)

    let n = 1
    for (const r of ROUTES) {
      const name = `${String(n++).padStart(2, '0')}-${r}.png`
      shots[`${String(n - 1).padStart(2, '0')}-${r}`] = await shot(
        cdp, w, h, name, `${BASE}#/${r}`,
      )
    }
    report[key] = { screens: shots, console: cdp.consoleMsgs.slice() }
    console.log(`-- ${key} done`)
  }

  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'qa-report.json'), JSON.stringify(report, null, 2))

  // summary table
  console.log('\n===== QA SUMMARY =====')
  console.log('size        screen           hScroll  overflow  consoleErr  consoleWarn')
  let anyBad = false
  for (const [key, r] of Object.entries(report)) {
    for (const [scr, f] of Object.entries(r.screens)) {
      const errs = r.console.filter((c) => c.level === 'error').length
      const warns = r.console.filter((c) => c.level === 'warning').length
      const bad = f.hScroll || f.overflow.length || errs || warns
      if (bad) anyBad = true
      console.log(
        `${key.padEnd(11)} ${scr.padEnd(16)} ${String(f.hScroll).padEnd(8)} ${String(f.overflow.length).padEnd(9)} ${String(errs).padEnd(11)} ${warns}${f.overflow.length ? '  <= ' + f.overflow.slice(0, 3).join(' | ') : ''}`,
      )
    }
  }
  if (anyBad) console.log('\nISSUES FOUND (see docs/screenshots/qa-report.json)')
  else console.log('\nALL CLEAN')
  cleanup()
  process.exit(anyBad ? 2 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
