import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore, useAnalysis } from '../store'
import { fmtDate, fmtPrice, fmtPct, fmtPctAbs } from '../lib/format'
import { nearestEarlierIso, pageCount } from '../lib/paginate'
import { FIT_WINDOW, FORECAST_HORIZON } from '../config'
import { Shell, ScreenTitle, Tag, EmptyState } from '../components/Shell'
import type { Route } from '../router'

const PRESETS = [
  { label: '1M', days: 21 },
  { label: '3M', days: 63 },
  { label: '6M', days: 126 },
  { label: '1Y', days: 252 },
  { label: '2Y', days: 504 },
  { label: 'All', days: 0 },
] as const

type TabKey = 'chart' | 'table'
type SortKey = 't' | 'price' | 'open' | 'high' | 'low' | 'change' | 'vol' | 'ma30' | 'ma90'
const PAGE_SIZE = 25

export function Trend({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const { a } = useAnalysis()

  const rows = a?.rows ?? []
  const chg = a?.chg ?? []
  const vol = a?.vol ?? []
  const ma30 = a?.ma30 ?? []
  const ma90 = a?.ma90 ?? []
  const forecast = a?.forecast ?? []
  const N = rows.length

  const [activeTab, setActiveTab] = useState<TabKey>('chart')
  const [preset, setPreset] = useState<number | null>(0)
  const [startIndex, setStartIndex] = useState<number>(0)
  const [endIndex, setEndIndex] = useState<number>(Math.max(0, N - 1))

  // Chart customization toggles
  const [showMA30, setShowMA30] = useState(true)
  const [showMA90, setShowMA90] = useState(true)
  const [showForecast, setShowForecast] = useState(true)
  const [showVolume, setShowVolume] = useState(true)
  const [showHighLow, setShowHighLow] = useState(true)
  const [showYearLines, setShowYearLines] = useState(true)
  const [priceScale, setPriceScale] = useState<'lin' | 'log'>('lin')
  const [autoFit, setAutoFit] = useState(true)

  // Table controls
  const [sortKey, setSortKey] = useState<SortKey>('t')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [page, setPage] = useState(0)
  const [jumpIso, setJumpIso] = useState('')
  const [jumpTarget, setJumpTarget] = useState<string | null>(null)
  const [dateErr, setDateErr] = useState('')

  // Hover states for chart
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverClientPos, setHoverClientPos] = useState<{ x: number; y: number } | null>(null)

  // Measure chart container (width + height), debounced ~100ms
  const chartBoxRef = useRef<HTMLDivElement>(null)
  const [chartSize, setChartSize] = useState({ w: 780, h: 420 })
  // Customize panel starts collapsed at every width
  const [customizeOpen] = useState(false)

  useEffect(() => {
    const el = chartBoxRef.current
    if (!el) return
    let t = 0
    const ro = new ResizeObserver((entries) => {
      clearTimeout(t)
      t = window.setTimeout(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0) setChartSize({ w: width, h: height })
        }
      }, 100)
    })
    ro.observe(el)
    if (el.clientWidth > 0) setChartSize({ w: el.clientWidth, h: el.clientHeight || 420 })
    return () => {
      clearTimeout(t)
      ro.disconnect()
    }
  }, [])

  // Sync date range when dataset changes
  useEffect(() => {
    if (N > 0) {
      setStartIndex(0)
      setEndIndex(N - 1)
      setPreset(0)
    }
  }, [N])

  // Preset button click handler
  const handlePreset = (days: number) => {
    setPreset(days)
    if (days === 0) {
      setStartIndex(0)
      setEndIndex(N - 1)
    } else {
      setStartIndex(Math.max(0, N - days))
      setEndIndex(N - 1)
    }
  }

  // Date input change handlers
  const handleFromDateChange = (val: string) => {
    setPreset(null)
    if (val > rows[endIndex]?.iso) {
      setDateErr('To date must be on or after From date.')
      return
    }
    setDateErr('')
    const matchIdx = rows.findIndex((r) => r.iso >= val)
    if (matchIdx >= 0) {
      setStartIndex(Math.min(matchIdx, endIndex - 5 >= 0 ? endIndex - 5 : 0))
    }
  }

  const handleToDateChange = (val: string) => {
    setPreset(null)
    if (val < rows[startIndex]?.iso) {
      setDateErr('To date must be on or after From date.')
      return
    }
    setDateErr('')
    let matchIdx = -1
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].iso <= val) {
        matchIdx = i
        break
      }
    }
    if (matchIdx >= 0) {
      setEndIndex(Math.max(matchIdx, startIndex + 5 < N ? startIndex + 5 : N - 1))
    }
  }

  // Reset view handler
  const handleReset = () => {
    setShowMA30(true)
    setShowMA90(true)
    setShowForecast(true)
    setShowVolume(true)
    setShowHighLow(true)
    setShowYearLines(true)
    setPriceScale('lin')
    setAutoFit(true)
    setDateErr('')
    setPreset(0)
    setStartIndex(0)
    setEndIndex(N - 1)
  }

  // Segment statistics for the 6-tile ribbon
  const segStats = useMemo(() => {
    const slice = rows.slice(startIndex, endIndex + 1)
    if (!slice.length) return null
    const startP = slice[0].price
    const endP = slice[slice.length - 1].price
    const chgNum = (endP / startP - 1) * 100
    const prices = slice.map((r) => r.price)
    const hi = Math.max(...prices)
    const lo = Math.min(...prices)
    const avg = prices.reduce((acc, p) => acc + p, 0) / prices.length
    return {
      start: startP.toFixed(2),
      end: endP.toFixed(2),
      change: fmtPct(chgNum),
      changeNum: chgNum,
      high: hi.toFixed(2),
      low: lo.toFixed(2),
      avg: avg.toFixed(2),
    }
  }, [rows, startIndex, endIndex])

  // Chart layout geometry
  const isLog = priceScale === 'log'
  const showF = showForecast && endIndex === N - 1
  const x1 = endIndex + (showF ? 30 : 0)

  const W = chartSize.w
  const H = chartSize.h
  const L = 54
  const R = 20
  const T = 18
  const AX = H - 28
  const VB = showVolume ? AX - 8 : AX - 12
  const VT = showVolume ? VB - Math.max(40, Math.round(H * 0.18)) : VB
  const PB = showVolume ? VT - 14 : AX - 12
  const pw = W - L - R

  const X = (i: number) => L + (pw * (i - startIndex)) / Math.max(1, x1 - startIndex)

  // Price scaling
  const priceVals = useMemo(() => {
    if (!a || !rows.length) return [0.5, 1.0]
    const vals: number[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      vals.push(rows[i].price)
      if (showMA30 && ma30[i] != null) vals.push(ma30[i]!)
      if (showMA90 && ma90[i] != null) vals.push(ma90[i]!)
    }
    if (showF) {
      forecast.forEach((f) => {
        if (f.lower != null) vals.push(f.lower)
        if (f.upper != null) vals.push(f.upper)
        vals.push(f.v)
      })
    }
    return vals.length > 0 ? vals : [0.5, 1.0]
  }, [rows, startIndex, endIndex, showMA30, showMA90, showF, a])

  let lo = Math.min(...priceVals)
  let hi = Math.max(...priceVals)
  if (autoFit) {
    lo = Math.max(0.01, lo * 0.92)
    hi = hi * 1.06
  } else {
    lo = isLog ? 0.3 : 0
    hi = Math.ceil(hi)
  }

  const fLog = (v: number) => (isLog ? Math.log(Math.max(0.01, v)) : v)
  const Y = (v: number) =>
    T + (PB - T) * (1 - (fLog(v) - fLog(lo)) / (fLog(hi) - fLog(lo) || 1))

  // Y-axis tick grid
  const ticks = useMemo(() => {
    const list: { v: number; y: number }[] = []
    const nt = Math.max(2, Math.round((PB - T) / 50))
    for (let k = 0; k <= nt; k++) {
      const v = isLog
        ? Math.exp(fLog(lo) + ((fLog(hi) - fLog(lo)) * k) / 5)
        : lo + ((hi - lo) * k) / 5
      list.push({ v, y: Y(v) })
    }
    return list
  }, [lo, hi, isLog, PB, T])

  // High / Low markers
  const markers = useMemo(() => {
    if (!showHighLow || !a || !rows.length) return null
    let hiIdx = startIndex
    let loIdx = startIndex
    for (let i = startIndex; i <= endIndex; i++) {
      if (rows[i].price > rows[hiIdx].price) hiIdx = i
      if (rows[i].price < rows[loIdx].price) loIdx = i
    }
    return {
      high: { idx: hiIdx, price: rows[hiIdx].price, x: X(hiIdx), y: Y(rows[hiIdx].price) },
      low: { idx: loIdx, price: rows[loIdx].price, x: X(loIdx), y: Y(rows[loIdx].price) },
    }
  }, [rows, startIndex, endIndex, showHighLow, X, Y])

  // Year lines
  const yearLines = useMemo(() => {
    if (!showYearLines || !rows.length) return []
    const lines: { x: number; year: number }[] = []
    for (let i = startIndex + 1; i <= endIndex; i++) {
      const y1 = new Date(rows[i - 1].t).getUTCFullYear()
      const y2 = new Date(rows[i].t).getUTCFullYear()
      if (y1 !== y2) {
        lines.push({ x: X(i), year: y2 })
      }
    }
    return lines
  }, [rows, startIndex, endIndex, showYearLines, X])

  // Volume bars
  const volumeBars = useMemo(() => {
    if (!showVolume || !rows.length) return []
    const maxV = Math.max(...vol.slice(startIndex, endIndex + 1).map((v) => v ?? 0), 1)
    const bw = Math.max(1, (pw / Math.max(1, x1 - startIndex)) * 0.8)
    const bars: { x: number; y: number; w: number; h: number }[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      const v = vol[i]
      if (v == null) continue
      const h = Math.max(1, ((VB - VT) * v) / maxV)
      bars.push({
        x: X(i) - bw / 2,
        y: VB - h,
        w: bw,
        h,
      })
    }
    return bars
  }, [vol, startIndex, endIndex, showVolume, pw, x1, VB, VT, X])

  // Series points
  const pricePoints = useMemo(() => {
    if (!rows.length) return ''
    const pts: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      pts.push(`${X(i).toFixed(1)},${Y(rows[i].price).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [rows, startIndex, endIndex, X, Y])

  const ma30Points = useMemo(() => {
    if (!showMA30 || !rows.length) return ''
    const pts: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      if (ma30[i] != null) pts.push(`${X(i).toFixed(1)},${Y(ma30[i]!).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [ma30, startIndex, endIndex, showMA30, X, Y])

  const ma90Points = useMemo(() => {
    if (!showMA90 || !rows.length) return ''
    const pts: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      if (ma90[i] != null) pts.push(`${X(i).toFixed(1)},${Y(ma90[i]!).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [ma90, startIndex, endIndex, showMA90, X, Y])

  // Forecast path and range polygon
  const forecastPath = useMemo(() => {
    if (!showF || !a || !forecast.length || !rows.length) return null
    const endX = X(endIndex).toFixed(1)
    const endY = Y(rows[endIndex].price).toFixed(1)
    const linePts = [`${endX},${endY}`]
    const upPts = [`${endX},${endY}`]
    const dnPts = [`${endX},${endY}`]

    forecast.forEach((f, i) => {
      const fx = X(endIndex + 1 + i).toFixed(1)
      const fy = Y(f.v).toFixed(1)
      const uY = Y(f.upper ?? f.v + 0.02).toFixed(1)
      const lY = Y(f.lower ?? Math.max(0.01, f.v - 0.02)).toFixed(1)
      linePts.push(`${fx},${fy}`)
      upPts.push(`${fx},${uY}`)
      dnPts.unshift(`${fx},${lY}`)
    })

    const poly = `${upPts.join(' ')} ${dnPts.join(' ')}`
    const line = linePts.join(' ')
    const lastFc = forecast[forecast.length - 1]
    const lastX = X(endIndex + 30)
    const lastY = Y(lastFc.v)
    return { poly, line, lastX, lastY, lastVal: lastFc.v }
  }, [showF, forecast, rows, endIndex, X, Y])

  // Label placement with collision avoidance (year labels, High/Low, Day 30)
  const labelLayout = useMemo(() => {
    type Box = { x0: number; y0: number; x1: number; y1: number }
    const boxes: Box[] = []
    const TWL = 7 // approx px per char at 12px font
    const overlaps = (a: Box, b: Box) =>
      a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
    const free = (b: Box) => !boxes.some((o) => overlaps(b, o))
    // the "Next 30 days" zone label has priority over year labels
    if (showF) {
      const w = 'Next 30 days'.length * TWL
      boxes.push({ x0: W - R - w, y0: T + 3, x1: W - R, y1: T + 17 })
    }
    // year labels occupy the top strip; a colliding one is hidden
    const yearShow = yearLines.map((yl) => {
      const w = String(yl.year).length * TWL
      const b: Box = { x0: yl.x + 4, y0: T + 2, x1: yl.x + 4 + w, y1: T + 14 }
      const show = free(b)
      if (show) boxes.push(b)
      return show
    })
    const textBox = (cx: number, baseline: number, text: string): Box => {
      const w = text.length * TWL
      const x0 = Math.min(Math.max(cx - w / 2, L + 2), W - R - w - 2)
      return { x0, y0: baseline - 12, x1: x0 + w, y1: baseline + 4 }
    }
    const place = (cx: number, text: string, baselines: number[]) => {
      for (const bl of baselines) {
        const b = textBox(cx, bl, text)
        if (free(b)) {
          boxes.push(b)
          return { box: b as Box | null, baseline: bl, text, show: true }
        }
      }
      return { box: null as Box | null, baseline: 0, text, show: false }
    }
    const high = markers
      ? place(
          markers.high.x,
          `High ${fmtPrice(markers.high.price)}`,
          [markers.high.y - 8, markers.high.y + 20],
        )
      : null
    const low = markers
      ? place(
          markers.low.x,
          `Low ${fmtPrice(markers.low.price)}`,
          [markers.low.y + 20, markers.low.y - 8],
        )
      : null
    // Day 30 forecast label: above, then below; hidden when it collides or the
    // chart is narrower than 520px (the Forecast card shows the value).
    let day30: { x: number; y: number; text: string } | null = null
    if (forecastPath && W >= 520) {
      const text = `Day 30: ${fmtPrice(forecastPath.lastVal)}`
      const w = text.length * TWL
      const x1e = W - R
      const guideY = Y(rows[endIndex].price)
      const priceCollide = (b: Box) => {
        for (let i = startIndex; i <= endIndex; i++) {
          const px = X(i)
          if (px < b.x0 || px > b.x1) continue
          const py = Y(rows[i].price)
          if (py >= b.y0 && py <= b.y1) return true
        }
        return false
      }
      const hit = (b: Box) =>
        !free(b) ||
        priceCollide(b) ||
        (guideY >= b.y0 - 2 && guideY <= b.y1 + 2)
      for (const bl of [forecastPath.lastY - 14, forecastPath.lastY + 22]) {
        const b: Box = { x0: x1e - w, y0: bl - 12, x1: x1e, y1: bl + 4 }
        if (!hit(b)) {
          boxes.push(b)
          day30 = { x: x1e, y: bl, text }
          break
        }
      }
    }
    return { high, low, day30, yearShow }
  }, [markers, yearLines, forecastPath, rows, startIndex, endIndex, W, T, L, R, X, Y, showF])

  // X-axis date ticks
  const xDateTicks = useMemo(() => {
    const isShort = x1 - startIndex < 130
    const tn = Math.max(2, Math.floor(pw / 90))
    const list: { x: number; label: string; isForecast: boolean; anchor: 'start' | 'middle' | 'end' }[] = []
    const used = new Set<string>()

    for (let k = 0; k <= tn; k++) {
      const idx = Math.round(startIndex + ((x1 - startIndex) * k) / tn)
      const isFc = idx > endIndex
      const isoStr = isFc ? forecast[idx - endIndex - 1]?.iso : rows[idx]?.iso
      if (!isoStr) continue
      const d = new Date(`${isoStr}T00:00:00Z`)
      const label = d.toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
        ...(isShort ? { day: 'numeric' } : { year: 'numeric' }),
      })
      if (used.has(label)) continue
      used.add(label)
      const anchor = k === 0 ? 'start' : k === tn ? 'end' : 'middle'
      list.push({ x: X(idx), label, isForecast: isFc, anchor })
    }
    return list
  }, [startIndex, x1, pw, endIndex, forecast, rows, X])

  // Hover pointer move
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    let i = Math.round(startIndex + ((relX - L) / pw) * (x1 - startIndex))
    i = Math.max(startIndex, Math.min(x1, i))
    setHoverIndex(i)
    setHoverClientPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const handlePointerLeave = () => {
    setHoverIndex(null)
    setHoverClientPos(null)
  }

  // Active hover tooltip data
  const hoverData = useMemo(() => {
    if (hoverIndex === null || !a) return null
    if (hoverIndex <= endIndex) {
      const r = rows[hoverIndex]
      return {
        isForecast: false,
        date: fmtDate(r.iso),
        price: r.price,
        change: chg[hoverIndex],
        ma30: ma30[hoverIndex],
        ma90: ma90[hoverIndex],
        vol: vol[hoverIndex],
        x: X(hoverIndex),
        y: Y(r.price),
      }
    } else {
      const fcIdx = hoverIndex - endIndex - 1
      const f = forecast[fcIdx]
      if (!f) return null
      return {
        isForecast: true,
        date: fmtDate(f.iso),
        price: f.v,
        lower: f.lower,
        upper: f.upper,
        dayNum: fcIdx + 1,
        x: X(hoverIndex),
        y: Y(f.v),
      }
    }
  }, [hoverIndex, endIndex, rows, a, X, Y])

  // Data table: all rows of the dataset, sorted by the active column
  const tableData = useMemo(() => {
    if (!a || !rows.length) return []
    const list = rows.map((r, i) => ({
      i,
      iso: r.iso,
      t: r.t,
      price: r.price,
      open: r.open ?? null,
      high: r.high ?? null,
      low: r.low ?? null,
      change: chg[i],
      vol: vol[i],
      ma30: ma30[i],
      ma90: ma90[i],
    }))

    list.sort((x, y) => {
      const vx = x[sortKey]
      const vy = y[sortKey]
      if (vx == null) return 1
      if (vy == null) return -1
      return vx < vy ? -sortDir : vx > vy ? sortDir : 0
    })

    return list
  }, [chg, vol, ma30, ma90, rows, a, sortKey, sortDir])

  const pages = pageCount(tableData.length, PAGE_SIZE)
  const pageRows = tableData.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const jumpToDate = () => {
    if (!jumpIso || !tableData.length) return
    const target = nearestEarlierIso(rows.map((r) => r.iso), jumpIso)
    if (!target) return
    const idx = tableData.findIndex((r) => r.iso === target)
    if (idx < 0) return
    setJumpTarget(target)
    setPage(Math.floor(idx / PAGE_SIZE))
  }

  const toggleSort = (k: SortKey) => {
    setPage(0)
    if (sortKey === k) {
      setSortDir((d) => (d === 1 ? -1 : 1))
    } else {
      setSortKey(k)
      setSortDir(-1)
    }
  }

  if (!a || !state.dataset || N === 0) {
    return (
      <Shell
        session={state.session}
        route="trend"
        onLogout={() => dispatch({ type: 'logout' })}
      >
        <EmptyState navigate={navigate} />
      </Shell>
    )
  }

  return (
    <Shell
      session={state.session}
      route="trend"
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle title="Trend and Forecast">
        <Tag kind="greentag" text="Predictive" />
        <span className="q">What will the price do?</span>
      </ScreenTitle>

      <div className="method mut" style={{ margin: '-8px 0 14px' }}>
        Method: Time Series Analysis, using Simple Moving Average and Linear Trend Regression, with a 30 day forecast.
      </div>

      <div className="f7-cols">
        {/* Main Card */}
        <div className="card trend-card">
          <div
            className="f7-tabs"
            role="tablist"
            aria-label="Price data views"
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault()
                const next: TabKey = activeTab === 'chart' ? 'table' : 'chart'
                setActiveTab(next)
                document.getElementById(`tab-${next}`)?.focus()
              }
            }}
          >
            <button
              className={`f7-tab${activeTab === 'chart' ? ' on' : ''}`}
              onClick={() => setActiveTab('chart')}
              role="tab"
              id="tab-chart"
              aria-controls="pane-chart"
              aria-selected={activeTab === 'chart'}
              tabIndex={activeTab === 'chart' ? 0 : -1}
            >
              Price chart
            </button>
            <button
              className={`f7-tab${activeTab === 'table' ? ' on' : ''}`}
              onClick={() => setActiveTab('table')}
              role="tab"
              id="tab-table"
              aria-controls="pane-table"
              aria-selected={activeTab === 'table'}
              tabIndex={activeTab === 'table' ? 0 : -1}
            >
              Data table
            </button>
          </div>

          {/* Pane 1: Chart */}
          {activeTab === 'chart' && (
            <div className="f7-pane" role="tabpanel" id="pane-chart" aria-labelledby="tab-chart">
              <div className="f7-bar" role="group" aria-label="Range presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    className={`f7-pb${preset === p.days ? ' on' : ''}`}
                    onClick={() => handlePreset(p.days)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {segStats && (
                <div className="f7-rs">
                  <div>
                    Start<b>{segStats.start}</b>
                  </div>
                  <div>
                    End<b>{segStats.end}</b>
                  </div>
                  <div>
                    Change
                    <b style={{ color: segStats.changeNum < 0 ? 'var(--sell)' : 'var(--hold)' }}>
                      {segStats.change}
                    </b>
                  </div>
                  <div>
                    High<b>{segStats.high}</b>
                  </div>
                  <div>
                    Low<b>{segStats.low}</b>
                  </div>
                  <div>
                    Average<b>{segStats.avg}</b>
                  </div>
                </div>
              )}

              <div className="f7-cb" ref={chartBoxRef}>
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  onPointerMove={handlePointerMove}
                  onPointerLeave={handlePointerLeave}
                  role="img"
                  aria-label={`Closing price chart. Latest ${fmtPrice(a.latest)} on ${fmtDate(a.latestIso)}. Forecast day 30 ${fmtPrice(a.forecast30)}.`}
                >
                  {/* y-axis title, rotated, left of the tick labels */}
                  <text
                    transform={`rotate(-90, 8, ${T + PB / 2})`}
                    x={8}
                    y={T + PB / 2}
                    textAnchor="middle"
                    fontSize={12}
                    fill="var(--c-axis-text)"
                  >
                    Close, Php
                  </text>

                  {/* Y-axis grid and labels */}
                  {ticks.map((t) => (
                    <g key={t.y}>
                      <line x1={L} x2={W - R} y1={t.y} y2={t.y} stroke="var(--c-grid)" />
                      <text x={L - 8} y={t.y + 4} fontSize="12" fontWeight="500" textAnchor="end" fill="var(--c-axis-text)">
                        {t.v.toFixed(2)}
                      </text>
                    </g>
                  ))}

                  {/* Shaded forecast zone background */}
                  {showF && (
                    <g>
                      <rect
                        x={X(endIndex)}
                        y={T}
                        width={W - R - X(endIndex)}
                        height={PB - T}
                        fill="var(--c-fzone)"
                        opacity={0.65}
                      />
                      <text
                        x={W - R}
                        y={T + 14}
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="end"
                        fill="var(--c-price)"
                      >
                        Next 30 days
                      </text>
                    </g>
                  )}

                  {/* Year marker lines */}
                  {yearLines.map((yl, i) => labelLayout.yearShow[i] !== false && (
                    <g key={yl.year}>
                      <line
                        x1={yl.x}
                        x2={yl.x}
                        y1={T}
                        y2={VB}
                        stroke="var(--c-volume)"
                        strokeDasharray="3 3"
                      />
                      <text x={yl.x + 4} y={T + 13} fontSize="12" fontWeight="500" fill="var(--c-axis-text)">
                        {yl.year}
                      </text>
                    </g>
                  ))}

                  {/* Volume histogram bars */}
                  {showVolume && (
                    <g>
                      {volumeBars.map((b, i) => (
                        <rect
                          key={i}
                          x={b.x}
                          y={b.y}
                          width={b.w}
                          height={b.h}
                          fill="var(--c-volume)"
                        />
                      ))}
                      <text x={L - 8} y={VT + 12} fontSize="11" fontWeight="500" textAnchor="end" fill="var(--c-axis-text)">
                        Vol., M
                      </text>
                    </g>
                  )}

                  {/* 90-day moving average */}
                  {showMA90 && ma90Points && (
                    <polyline
                      fill="none"
                      stroke="var(--c-ma90)"
                      strokeWidth="2"
                      points={ma90Points}
                    />
                  )}

                  {/* 30-day moving average */}
                  {showMA30 && ma30Points && (
                    <polyline
                      fill="none"
                      stroke="var(--c-ma30)"
                      strokeWidth="2.2"
                      points={ma30Points}
                    />
                  )}

                  {/* Closing price series */}
                  <polyline
                    fill="none"
                    stroke="var(--c-price)"
                    strokeWidth="2"
                    points={pricePoints}
                  />

                  {/* 30-day forecast & confidence band */}
                  {forecastPath && (
                    <g>
                      <polygon points={forecastPath.poly} fill="var(--c-forecast)" opacity={0.1} />
                      <polyline
                        fill="none"
                        stroke="var(--c-forecast)"
                        strokeWidth="2.2"
                        strokeDasharray="5 4"
                        points={forecastPath.line}
                      />
                      {labelLayout.day30 && (
                        <text
                          x={labelLayout.day30.x}
                          y={labelLayout.day30.y}
                          fontSize="12"
                          fontWeight="600"
                          textAnchor="end"
                          fill="var(--c-forecast)"
                        >
                          {labelLayout.day30.text}
                        </text>
                      )}
                    </g>
                  )}

                  {/* Latest price horizontal dashed guide line */}
                  <line
                    x1={L}
                    x2={W - R}
                    y1={Y(rows[endIndex].price)}
                    y2={Y(rows[endIndex].price)}
                    stroke="var(--c-price)"
                    strokeDasharray="2 3"
                    opacity={0.6}
                  />

                  {/* High / Low markers */}
                  {markers && (
                    <g>
                      <circle
                        cx={markers.high.x}
                        cy={markers.high.y}
                        r="4.5"
                        fill="var(--white)"
                        stroke="var(--c-price)"
                        strokeWidth="2.2"
                      />
                      <text
                        x={labelLayout.high?.box ? (labelLayout.high.box.x0 + labelLayout.high.box.x1) / 2 : markers.high.x}
                        y={labelLayout.high?.baseline ?? markers.high.y - 8}
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="middle"
                        fill="var(--c-price)"
                        visibility={labelLayout.high?.show ? 'visible' : 'hidden'}
                      >
                        {labelLayout.high?.text ?? `High ${fmtPrice(markers.high.price)}`}
                      </text>

                      <circle
                        cx={markers.low.x}
                        cy={markers.low.y}
                        r="4.5"
                        fill="var(--white)"
                        stroke="var(--c-price)"
                        strokeWidth="2.2"
                      />
                      <text
                        x={labelLayout.low?.box ? (labelLayout.low.box.x0 + labelLayout.low.box.x1) / 2 : markers.low.x}
                        y={labelLayout.low?.baseline ?? markers.low.y + 18}
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="middle"
                        fill="var(--c-price)"
                        visibility={labelLayout.low?.show ? 'visible' : 'hidden'}
                      >
                        {labelLayout.low?.text ?? `Low ${fmtPrice(markers.low.price)}`}
                      </text>
                    </g>
                  )}

                  {/* X-axis date labels */}
                  {xDateTicks.map((xTick, idx) => (
                    <text
                      key={idx}
                      x={xTick.x}
                      y={AX + 18}
                      fontSize="12"
                      fontWeight="500"
                      textAnchor={xTick.anchor}
                      fill={xTick.isForecast ? 'var(--c-price)' : 'var(--c-axis-text)'}
                    >
                      {xTick.label}
                    </text>
                  ))}

                  {/* Crosshair & hover dot */}
                  {hoverData && (
                    <g>
                      <line
                        x1={hoverData.x}
                        x2={hoverData.x}
                        y1={T}
                        y2={VB}
                        stroke="var(--c-forecast)"
                        opacity={0.4}
                      />
                      <circle
                        cx={hoverData.x}
                        cy={hoverData.y}
                        r="4.5"
                        fill="var(--c-price)"
                        stroke="var(--white)"
                        strokeWidth="2"
                      />
                    </g>
                  )}
                </svg>
                <div className="sr-only">
                  Closing price from {fmtDate(a.firstIso)} at {fmtPrice(a.first)} to{' '}
                  {fmtDate(a.latestIso)} at {fmtPrice(a.latest)}. High{' '}
                  {fmtPrice(a.high.v)} on {fmtDate(a.high.iso)}. Low {fmtPrice(a.low.v)} on{' '}
                  {fmtDate(a.low.iso)}. Forecast day 30 {fmtPrice(a.forecast30)}. The Data
                  table tab shows the same numbers in text form.
                </div>

                {/* Floating hover tooltip */}
                {hoverData && hoverClientPos && (
                  <div
                    className="f7-tip"
                    style={{
                      display: 'block',
                      left: Math.min(
                        Math.max(10, hoverClientPos.x > W * 0.6 ? hoverClientPos.x - 220 : hoverClientPos.x + 14),
                        Math.max(10, W - 230),
                      ),
                      top: Math.min(Math.max(10, hoverClientPos.y - 40), Math.max(10, H - 100)),
                    }}
                  >
                    <b>{hoverData.date}</b>
                    <br />
                    {hoverData.isForecast ? (
                      <>
                        Day {hoverData.dayNum} forecast <b>{fmtPrice(hoverData.price)}</b>
                        <br />
                        95% range <b>{hoverData.lower != null ? fmtPrice(hoverData.lower) : '–'}</b>
                        {' to '}
                        <b>{hoverData.upper != null ? fmtPrice(hoverData.upper) : '–'}</b>
                      </>
                    ) : (
                      <>
                        Close <b>{fmtPrice(hoverData.price)}</b>
                        <br />
                        Change <b style={{ color: (hoverData.change ?? 0) < 0 ? 'var(--sell)' : 'var(--hold)' }}>
                          {fmtPct(hoverData.change ?? 0)}
                        </b>
                        <br />
                        30 day average <b>{hoverData.ma30 != null ? fmtPrice(hoverData.ma30) : '–'}</b>
                        <br />
                        90 day average <b>{hoverData.ma90 != null ? fmtPrice(hoverData.ma90) : '–'}</b>
                        <br />
                        Volume <b>{hoverData.vol != null ? `${hoverData.vol.toFixed(2)} M` : 'no data'}</b>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Chart Legend: items toggle their layers */}
              <div className="f7-lg">
                <span>
                  <i style={{ borderColor: 'var(--c-price)' }} />
                  Closing price
                </span>
                <button
                  type="button"
                  aria-pressed={showMA30}
                  onClick={() => setShowMA30((s) => !s)}
                >
                  <i style={{ borderColor: 'var(--c-ma30)' }} />
                  30 day average
                </button>
                <button
                  type="button"
                  aria-pressed={showMA90}
                  onClick={() => setShowMA90((s) => !s)}
                >
                  <i style={{ borderColor: 'var(--c-ma90)' }} />
                  90 day average
                </button>
                <button
                  type="button"
                  aria-pressed={showForecast}
                  onClick={() => setShowForecast((s) => !s)}
                >
                  <i style={{ borderColor: 'var(--c-forecast)', borderTopStyle: 'dashed' }} />
                  Forecast and 95% range
                </button>
                <button
                  type="button"
                  aria-pressed={showVolume}
                  onClick={() => setShowVolume((s) => !s)}
                >
                  <i style={{ borderColor: 'var(--c-volume)' }} />
                  Volume
                </button>
              </div>
            </div>
          )}

          {/* Pane 2: Data Table */}
          {activeTab === 'table' && (
            <div className="f7-pane" role="tabpanel" id="pane-table" aria-labelledby="tab-table">
              <div className="pager">
                <label htmlFor="f7-jump" className="mut">Jump to date</label>
                <input
                  type="date"
                  id="f7-jump"
                  value={jumpIso}
                  min={rows[0]?.iso ?? ''}
                  max={rows[N - 1]?.iso ?? ''}
                  onChange={(e) => setJumpIso(e.target.value)}
                />
                <button type="button" className="btn btn-sm" onClick={jumpToDate}>
                  Jump
                </button>
                <span style={{ marginLeft: 'auto' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={page >= pages - 1}
                    onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                  >
                    Next
                  </button>{' '}
                  Page {page + 1} of {pages}
                </span>
              </div>

              <div className="f7-tw">
                <table className="f7-table">
                  <thead>
                    <tr>
                      {(
                        [
                          ['t', 'Date'],
                          ['price', 'Close'],
                          ['open', 'Open'],
                          ['high', 'High'],
                          ['low', 'Low'],
                          ['vol', 'Volume'],
                          ['change', 'Change %'],
                          ['ma30', '30 day average'],
                          ['ma90', '90 day average'],
                        ] as [SortKey, string][]
                      ).map(([k, lbl]) => (
                        <th
                          key={k}
                          aria-sort={
                            sortKey === k
                              ? sortDir === 1
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                          }
                        >
                          <button
                            type="button"
                            className="sort-btn"
                            onClick={() => toggleSort(k)}
                          >
                            {lbl} {sortKey === k ? (sortDir === 1 ? '↑' : '↓') : ''}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.iso} className={row.iso === jumpTarget ? 'hl' : undefined}>
                        <td>{fmtDate(row.iso)}</td>
                        <td>{fmtPrice(row.price)}</td>
                        <td>{row.open != null ? fmtPrice(row.open) : '–'}</td>
                        <td>{row.high != null ? fmtPrice(row.high) : '–'}</td>
                        <td>{row.low != null ? fmtPrice(row.low) : '–'}</td>
                        <td>{row.vol != null ? `${row.vol.toFixed(2)} M` : '–'}</td>
                        <td
                          style={{
                            color: row.change < 0 ? 'var(--sell)' : row.change > 0 ? 'var(--hold)' : 'inherit',
                          }}
                        >
                          {fmtPct(row.change)}
                        </td>
                        <td>{row.ma30 != null ? fmtPrice(row.ma30) : '–'}</td>
                        <td>{row.ma90 != null ? fmtPrice(row.ma90) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar */}
        <div className="f7-side">
          {/* Card: Summary */}
          <div className="card f7-sb">
            <h4>Summary</h4>
            <div className="f7-st">
              <span>Latest price</span>
              <b>{fmtPrice(a.latest)}</b>
            </div>
            <div className="f7-st">
              <span>30 day average</span>
              <b>{fmtPrice(a.avg30)}</b>
            </div>
            <div className="f7-st">
              <span>90 day average</span>
              <b>{fmtPrice(a.avg90)}</b>
            </div>
            <div className="f7-st">
              <span>Trend</span>
              <b style={{ color: a.trend === 'Downward' ? 'var(--sell)' : 'inherit', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {a.trend}
                {a.trend === 'Downward' && (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 4 v14 M6 12 l6 6 6 -6" />
                  </svg>
                )}
              </b>
            </div>
          </div>

          {/* Card: Forecast */}
          <div className="card f7-sb">
            <h4>Forecast, next 30 days</h4>
            <div className="f7-fb">{fmtPrice(a.forecast30)}</div>
            <div className="sub" style={{ color: a.forecastPct < 0 ? 'var(--sell)' : 'var(--hold)' }}>
              {fmtPct(a.forecastPct)} against the latest price
            </div>
            <div className="sub" style={{ marginTop: '8px' }}>
              Method: a straight line fitted to the last {FIT_WINDOW} closing prices, projected{' '}
              {FORECAST_HORIZON} trading days ahead. Weekends are skipped. Holidays are not.
            </div>
          </div>

          {/* Card: Accuracy check */}
          <div className="card f7-sb">
            <h4>Accuracy check</h4>
            <div className="sub" style={{ marginBottom: '6px' }}>
              Forecast of the last 30 known prices using only earlier data, compared with the
              real prices.
            </div>
            {a.mae == null ? (
              <div className="sub">Not enough data</div>
            ) : (
              <>
                <div className="f7-st">
                  <span>
                    Average difference
                    <InfoTip
                      id="tip-mae"
                      text="The average gap between the forecast and the real price over the last 30 known days."
                    />
                  </span>
                  <b>{fmtPrice(a.mae)}</b>
                </div>
                <div className="f7-st">
                  <span>
                    Largest difference
                    <InfoTip
                      id="tip-maxerr"
                      text="The biggest single day gap in that test."
                    />
                  </span>
                  <b>{fmtPrice(a.maxError!)}</b>
                </div>
                <div className="f7-st">
                  <span>
                    MAPE
                    <InfoTip
                      id="tip-mape"
                      text="The average gap as a percent of the real price. Lower is better."
                    />
                  </span>
                  <b>{fmtPctAbs(a.mape!)}</b>
                </div>
              </>
            )}
          </div>

          {/* Card: Customize chart */}
          <details className="card f7-sb" open={customizeOpen}>
            <summary>Customize chart</summary>
            <div className="f7-fp">
              <label className="f" htmlFor="f7-d1">From date</label>
              <input
                type="date"
                id="f7-d1"
                value={rows[startIndex]?.iso ?? ''}
                min={rows[0]?.iso ?? ''}
                max={rows[endIndex]?.iso ?? ''}
                onChange={(e) => handleFromDateChange(e.target.value)}
              />

              <label className="f" htmlFor="f7-d2">To date</label>
              <input
                type="date"
                id="f7-d2"
                value={rows[endIndex]?.iso ?? ''}
                min={rows[startIndex]?.iso ?? ''}
                max={rows[N - 1]?.iso ?? ''}
                onChange={(e) => handleToDateChange(e.target.value)}
              />
              {dateErr && <div className="err-inline" role="alert">{dateErr}</div>}

              <label className="f" style={{ marginTop: '10px' }}>Show on chart</label>
              <label className="f7-chk">
                <input
                  type="checkbox"
                  checked={showMA30}
                  onChange={(e) => setShowMA30(e.target.checked)}
                />
                30 day average
              </label>
              <label className="f7-chk">
                <input
                  type="checkbox"
                  checked={showMA90}
                  onChange={(e) => setShowMA90(e.target.checked)}
                />
                90 day average
              </label>
              <label className="f7-chk">
                <input
                  type="checkbox"
                  checked={showForecast}
                  onChange={(e) => setShowForecast(e.target.checked)}
                />
                30 day forecast
              </label>
              <label className="f7-chk">
                <input
                  type="checkbox"
                  checked={showVolume}
                  onChange={(e) => setShowVolume(e.target.checked)}
                />
                Volume bars
              </label>
              <label className="f7-chk">
                <input
                  type="checkbox"
                  checked={showHighLow}
                  onChange={(e) => setShowHighLow(e.target.checked)}
                />
                High and low markers
              </label>
              <label className="f7-chk">
                <input
                  type="checkbox"
                  checked={showYearLines}
                  onChange={(e) => setShowYearLines(e.target.checked)}
                />
                Year lines
              </label>

              <label className="f" htmlFor="f7-scale" style={{ marginTop: '10px' }}>Price scale</label>
              <select
                id="f7-scale"
                value={priceScale}
                onChange={(e) => setPriceScale(e.target.value as 'lin' | 'log')}
              >
                <option value="lin">Linear</option>
                <option value="log">Log</option>
              </select>

              <label className="f7-chk" style={{ marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={autoFit}
                  onChange={(e) => setAutoFit(e.target.checked)}
                />
                Auto fit price axis
              </label>

              <button
                type="button"
                className="btn"
                style={{ marginTop: '10px', width: '100%' }}
                onClick={handleReset}
              >
                Reset view
              </button>
            </div>
          </details>
        </div>
      </div>

      {/* Action navigation */}
      <div className="row-end" style={{ marginTop: '14px' }}>
        <button
          className="btn primary"
          onClick={() => navigate('recommendation')}
        >
          Next →
        </button>
      </div>
    </Shell>
  )
}

/** Small info button with a tooltip: hover, focus, or tap to open, Esc closes. */
function InfoTip({ id, text }: { id: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="info">
      <button
        type="button"
        aria-label="What is this?"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
        }}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span className="tip" role="tooltip" id={id}>
          {text}
        </span>
      )}
    </span>
  )
}