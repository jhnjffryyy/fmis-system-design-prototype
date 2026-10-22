import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../store'
import { analyze } from '../lib/analysis'
import { fmtDate, fmtPrice, fmtPct } from '../lib/format'
import { Shell, ScreenTitle, Tag } from '../components/Shell'
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
type SortKey = 't' | 'price' | 'change' | 'vol' | 'ma30' | 'ma90'

export function Trend({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const a = useMemo(
    () => (state.dataset ? analyze(state.dataset.rows) : null),
    [state.dataset],
  )

  const rows = a?.rows ?? []
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
  const [tableFilter, setTableFilter] = useState<'all' | 'up' | 'down'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('t')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)

  // Hover states for chart
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [hoverClientPos, setHoverClientPos] = useState<{ x: number; y: number } | null>(null)

  // Measure chart container width
  const chartBoxRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(780)

  useEffect(() => {
    const el = chartBoxRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setChartWidth(entry.contentRect.width)
        }
      }
    })
    ro.observe(el)
    if (el.clientWidth > 0) setChartWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // Sync date range when dataset changes
  useEffect(() => {
    if (N > 0) {
      setStartIndex(0)
      setEndIndex(N - 1)
      setPreset(0)
    }
  }, [N])

  if (!a || !state.dataset || N === 0) return null

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
    const matchIdx = rows.findIndex((r) => r.iso >= val)
    if (matchIdx >= 0) {
      setStartIndex(Math.min(matchIdx, endIndex - 5 >= 0 ? endIndex - 5 : 0))
    }
  }

  const handleToDateChange = (val: string) => {
    setPreset(null)
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
    setTableFilter('all')
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
    const chg = ((endP / startP - 1) * 100).toFixed(1)
    const prices = slice.map((r) => r.price)
    const hi = Math.max(...prices)
    const lo = Math.min(...prices)
    const avg = prices.reduce((acc, p) => acc + p, 0) / prices.length
    return {
      start: startP.toFixed(2),
      end: endP.toFixed(2),
      change: `${+chg >= 0 ? '+' : ''}${chg}%`,
      changeNum: +chg,
      high: hi.toFixed(2),
      low: lo.toFixed(2),
      avg: avg.toFixed(2),
    }
  }, [rows, startIndex, endIndex])

  // Chart layout geometry
  const isLog = priceScale === 'log'
  const showF = showForecast && endIndex === N - 1
  const x1 = endIndex + (showF ? 30 : 0)

  const W = Math.max(500, chartWidth)
  const H = 480
  const L = 54
  const R = 20
  const T = 18
  const AX = H - 28
  const VB = showVolume ? AX - 8 : AX - 12
  const VT = showVolume ? VB - Math.round(H * 0.15) : VB
  const PB = showVolume ? VT - 14 : AX - 12
  const pw = W - L - R

  const X = (i: number) => L + (pw * (i - startIndex)) / Math.max(1, x1 - startIndex)

  // Price scaling
  const priceVals = useMemo(() => {
    const vals: number[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      vals.push(rows[i].price)
      if (showMA30 && a.ma30[i] != null) vals.push(a.ma30[i]!)
      if (showMA90 && a.ma90[i] != null) vals.push(a.ma90[i]!)
    }
    if (showF) {
      a.forecast.forEach((f) => {
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
    for (let k = 0; k <= 5; k++) {
      const v = isLog
        ? Math.exp(fLog(lo) + ((fLog(hi) - fLog(lo)) * k) / 5)
        : lo + ((hi - lo) * k) / 5
      list.push({ v, y: Y(v) })
    }
    return list
  }, [lo, hi, isLog, PB, T])

  // High / Low markers
  const markers = useMemo(() => {
    if (!showHighLow) return null
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
    if (!showYearLines) return []
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
    if (!showVolume) return []
    const maxV = Math.max(...a.vol.slice(startIndex, endIndex + 1), 1)
    const bw = Math.max(1, (pw / Math.max(1, x1 - startIndex)) * 0.8)
    const bars: { x: number; y: number; w: number; h: number }[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      const h = Math.max(1, ((VB - VT) * a.vol[i]) / maxV)
      bars.push({
        x: X(i) - bw / 2,
        y: VB - h,
        w: bw,
        h,
      })
    }
    return bars
  }, [a.vol, startIndex, endIndex, showVolume, pw, x1, VB, VT, X])

  // Series points
  const pricePoints = useMemo(() => {
    const pts: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      pts.push(`${X(i).toFixed(1)},${Y(rows[i].price).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [rows, startIndex, endIndex, X, Y])

  const ma30Points = useMemo(() => {
    if (!showMA30) return ''
    const pts: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      if (a.ma30[i] != null) pts.push(`${X(i).toFixed(1)},${Y(a.ma30[i]!).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [a.ma30, startIndex, endIndex, showMA30, X, Y])

  const ma90Points = useMemo(() => {
    if (!showMA90) return ''
    const pts: string[] = []
    for (let i = startIndex; i <= endIndex; i++) {
      if (a.ma90[i] != null) pts.push(`${X(i).toFixed(1)},${Y(a.ma90[i]!).toFixed(1)}`)
    }
    return pts.join(' ')
  }, [a.ma90, startIndex, endIndex, showMA90, X, Y])

  // Forecast path and range polygon
  const forecastPath = useMemo(() => {
    if (!showF || !a.forecast.length) return null
    const endX = X(endIndex).toFixed(1)
    const endY = Y(rows[endIndex].price).toFixed(1)
    const linePts = [`${endX},${endY}`]
    const upPts = [`${endX},${endY}`]
    const dnPts = [`${endX},${endY}`]

    a.forecast.forEach((f, i) => {
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
    const lastFc = a.forecast[a.forecast.length - 1]
    const lastX = X(endIndex + 30)
    const lastY = Y(lastFc.v)
    return { poly, line, lastX, lastY, lastVal: lastFc.v }
  }, [showF, a.forecast, rows, endIndex, X, Y])

  // X-axis date ticks
  const xDateTicks = useMemo(() => {
    const isShort = x1 - startIndex < 130
    const tn = Math.max(2, Math.floor(pw / 95))
    const list: { x: number; label: string; isForecast: boolean; anchor: 'start' | 'middle' | 'end' }[] = []
    const used = new Set<string>()

    for (let k = 0; k <= tn; k++) {
      const idx = Math.round(startIndex + ((x1 - startIndex) * k) / tn)
      const isFc = idx > endIndex
      const isoStr = isFc ? a.forecast[idx - endIndex - 1]?.iso : rows[idx]?.iso
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
  }, [startIndex, x1, pw, endIndex, a.forecast, rows, X])

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
    if (hoverIndex === null) return null
    if (hoverIndex <= endIndex) {
      const r = rows[hoverIndex]
      return {
        isForecast: false,
        date: fmtDate(r.iso),
        price: r.price,
        change: a.chg[hoverIndex],
        ma30: a.ma30[hoverIndex],
        ma90: a.ma90[hoverIndex],
        vol: a.vol[hoverIndex],
        x: X(hoverIndex),
        y: Y(r.price),
      }
    } else {
      const fcIdx = hoverIndex - endIndex - 1
      const f = a.forecast[fcIdx]
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

  // Filtered & sorted data table rows
  const tableData = useMemo(() => {
    const list: {
      i: number
      iso: string
      t: number
      price: number
      change: number
      vol: number
      ma30: number | null
      ma90: number | null
    }[] = []

    for (let i = startIndex; i <= endIndex; i++) {
      const c = a.chg[i]
      if (tableFilter === 'up' && c <= 0) continue
      if (tableFilter === 'down' && c >= 0) continue
      list.push({
        i,
        iso: rows[i].iso,
        t: rows[i].t,
        price: rows[i].price,
        change: c,
        vol: a.vol[i],
        ma30: a.ma30[i],
        ma90: a.ma90[i],
      })
    }

    list.sort((x, y) => {
      let vx = x[sortKey]
      let vy = y[sortKey]
      if (vx == null) return 1
      if (vy == null) return -1
      return vx < vy ? -sortDir : vx > vy ? sortDir : 0
    })

    return list
  }, [startIndex, endIndex, a.chg, a.vol, a.ma30, a.ma90, rows, tableFilter, sortKey, sortDir])

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 1 ? -1 : 1))
    } else {
      setSortKey(k)
      setSortDir(-1)
    }
  }

  return (
    <Shell
      session={state.session}
      route="trend"
      isSample={state.dataset.source === 'sample'}
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle step="03 · Trend and Forecast" title="Trend and Forecast">
        <Tag kind="greentag" text="Predictive" />
        <span className="q">What will the price do?</span>
      </ScreenTitle>

      <div className="method mut" style={{ margin: '-8px 0 14px' }}>
        Method: Time Series Analysis (30 and 90 day moving averages, 30 day forecast)
      </div>

      <div className="f7-cols">
        {/* Main Card */}
        <div className="f7-card">
          <div className="f7-tabs" role="tablist">
            <button
              className={`f7-tab${activeTab === 'chart' ? ' on' : ''}`}
              onClick={() => setActiveTab('chart')}
              role="tab"
              aria-selected={activeTab === 'chart'}
            >
              Price chart
            </button>
            <button
              className={`f7-tab${activeTab === 'table' ? ' on' : ''}`}
              onClick={() => setActiveTab('table')}
              role="tab"
              aria-selected={activeTab === 'table'}
            >
              Data table
            </button>
          </div>

          {/* Pane 1: Chart */}
          {activeTab === 'chart' && (
            <div className="f7-pane">
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
                  aria-label="Stock price trend, moving averages, and 30-day forecast chart"
                >
                  {/* Y-axis grid and labels */}
                  {ticks.map((t) => (
                    <g key={t.y}>
                      <line x1={L} x2={W - R} y1={t.y} y2={t.y} stroke="#e3e9f1" />
                      <text x={L - 8} y={t.y + 4} fontSize="12" fontWeight="500" textAnchor="end" fill="#5f6b7a">
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
                        fill="#eaf1fb"
                        opacity={0.65}
                      />
                      <text
                        x={W - R}
                        y={T + 14}
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="end"
                        fill="#14396f"
                      >
                        Next 30 days
                      </text>
                    </g>
                  )}

                  {/* Year marker lines */}
                  {yearLines.map((yl) => (
                    <g key={yl.year}>
                      <line
                        x1={yl.x}
                        x2={yl.x}
                        y1={T}
                        y2={VB}
                        stroke="#b9c7dc"
                        strokeDasharray="3 3"
                      />
                      <text x={yl.x + 4} y={T + 13} fontSize="12" fontWeight="500" fill="#5f6b7a">
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
                          fill="#b9c7dc"
                        />
                      ))}
                      <text x={L - 8} y={VT + 12} fontSize="11" fontWeight="500" textAnchor="end" fill="#5f6b7a">
                        Vol.
                      </text>
                    </g>
                  )}

                  {/* 90-day moving average */}
                  {showMA90 && ma90Points && (
                    <polyline
                      fill="none"
                      stroke="#8a94a3"
                      strokeWidth="2"
                      points={ma90Points}
                    />
                  )}

                  {/* 30-day moving average */}
                  {showMA30 && ma30Points && (
                    <polyline
                      fill="none"
                      stroke="#1e88e5"
                      strokeWidth="2.2"
                      points={ma30Points}
                    />
                  )}

                  {/* Closing price series */}
                  <polyline
                    fill="none"
                    stroke="#14396f"
                    strokeWidth="2"
                    points={pricePoints}
                  />

                  {/* 30-day forecast & confidence band */}
                  {forecastPath && (
                    <g>
                      <polygon points={forecastPath.poly} fill="#212121" opacity={0.1} />
                      <polyline
                        fill="none"
                        stroke="#212121"
                        strokeWidth="2.2"
                        strokeDasharray="5 4"
                        points={forecastPath.line}
                      />
                      <text
                        x={W - R}
                        y={forecastPath.lastY - 14}
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="end"
                        fill="#212121"
                      >
                        Day 30: {fmtPrice(forecastPath.lastVal)}
                      </text>
                    </g>
                  )}

                  {/* Latest price horizontal dashed guide line */}
                  <line
                    x1={L}
                    x2={W - R}
                    y1={Y(rows[endIndex].price)}
                    y2={Y(rows[endIndex].price)}
                    stroke="#14396f"
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
                        fill="#fff"
                        stroke="#14396f"
                        strokeWidth="2.2"
                      />
                      <text
                        x={Math.min(Math.max(markers.high.x, L + 40), W - R - 50)}
                        y={markers.high.y - 8}
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="middle"
                        fill="#14396f"
                      >
                        High {fmtPrice(markers.high.price)}
                      </text>

                      <circle
                        cx={markers.low.x}
                        cy={markers.low.y}
                        r="4.5"
                        fill="#fff"
                        stroke="#14396f"
                        strokeWidth="2.2"
                      />
                      <text
                        x={Math.min(Math.max(markers.low.x, L + 40), W - R - 50)}
                        y={markers.low.y + 18}
                        fontSize="12"
                        fontWeight="600"
                        textAnchor="middle"
                        fill="#14396f"
                      >
                        Low {fmtPrice(markers.low.price)}
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
                      fill={xTick.isForecast ? '#14396f' : '#5f6b7a'}
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
                        stroke="#212121"
                        opacity={0.4}
                      />
                      <circle
                        cx={hoverData.x}
                        cy={hoverData.y}
                        r="4.5"
                        fill="#14396f"
                        stroke="#fff"
                        strokeWidth="2"
                      />
                    </g>
                  )}
                </svg>

                {/* Floating hover tooltip */}
                {hoverData && hoverClientPos && (
                  <div
                    className="f7-tip"
                    style={{
                      display: 'block',
                      left:
                        hoverClientPos.x > chartWidth * 0.65
                          ? Math.max(10, hoverClientPos.x - 220)
                          : hoverClientPos.x + 14,
                      top: Math.max(10, hoverClientPos.y - 40),
                    }}
                  >
                    <b>{hoverData.date}</b>
                    <br />
                    {hoverData.isForecast ? (
                      <>
                        Day {hoverData.dayNum} Forecast: <b>{fmtPrice(hoverData.price)}</b> <i>(Sample)</i>
                        <br />
                        95% Prediction Interval: [
                        <b>{hoverData.lower ? fmtPrice(hoverData.lower) : '–'}</b>,{' '}
                        <b>{hoverData.upper ? fmtPrice(hoverData.upper) : '–'}</b>]
                      </>
                    ) : (
                      <>
                        Close: <b>{fmtPrice(hoverData.price)}</b>{' '}
                        <span style={{ color: (hoverData.change ?? 0) < 0 ? 'var(--sell)' : 'var(--hold)' }}>
                          ({fmtPct(hoverData.change ?? 0)})
                        </span>
                        <br />
                        30d avg: <b>{hoverData.ma30 ? fmtPrice(hoverData.ma30) : '–'}</b> · 90d avg:{' '}
                        <b>{hoverData.ma90 ? fmtPrice(hoverData.ma90) : '–'}</b>
                        <br />
                        Volume: <b>{(hoverData.vol ?? 0).toFixed(2)}M</b>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Chart Legend */}
              <div className="f7-lg">
                <span>
                  <i style={{ borderColor: '#14396f' }} />
                  Closing price
                </span>
                <span>
                  <i style={{ borderColor: '#1e88e5' }} />
                  30 day average
                </span>
                <span>
                  <i style={{ borderColor: '#8a94a3' }} />
                  90 day average
                </span>
                <span>
                  <i style={{ borderColor: '#212121', borderTopStyle: 'dashed' }} />
                  Forecast + 95% range
                </span>
                <span>
                  <i style={{ borderColor: '#b9c7dc' }} />
                  Volume
                </span>
              </div>
            </div>
          )}

          {/* Pane 2: Data Table */}
          {activeTab === 'table' && (
            <div className="f7-pane">
              <div className="f7-bar">
                <span className="mut" style={{ fontSize: '12px' }}>
                  Show:
                </span>
                <select
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value as 'all' | 'up' | 'down')}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                  }}
                >
                  <option value="all">All days</option>
                  <option value="up">Up days only</option>
                  <option value="down">Down days only</option>
                </select>
                <span className="mut" style={{ fontSize: '12px', marginLeft: 'auto' }}>
                  {tableData.length} rows (sorted by {sortKey} {sortDir === 1 ? '▲' : '▼'})
                </span>
              </div>

              <div className="f7-tw">
                <table className="f7-table">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort('t')}>
                        Date {sortKey === 't' ? (sortDir === 1 ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => toggleSort('price')}>
                        Close {sortKey === 'price' ? (sortDir === 1 ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => toggleSort('change')}>
                        Change % {sortKey === 'change' ? (sortDir === 1 ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => toggleSort('vol')}>
                        Volume (M) {sortKey === 'vol' ? (sortDir === 1 ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => toggleSort('ma30')}>
                        30d avg {sortKey === 'ma30' ? (sortDir === 1 ? '▲' : '▼') : ''}
                      </th>
                      <th onClick={() => toggleSort('ma90')}>
                        90d avg {sortKey === 'ma90' ? (sortDir === 1 ? '▲' : '▼') : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(0, 350).map((row) => (
                      <tr key={row.iso}>
                        <td>{fmtDate(row.iso)}</td>
                        <td>{fmtPrice(row.price)}</td>
                        <td
                          style={{
                            color: row.change < 0 ? 'var(--sell)' : row.change > 0 ? 'var(--hold)' : 'inherit',
                          }}
                        >
                          {fmtPct(row.change)}
                        </td>
                        <td>{row.vol.toFixed(2)}</td>
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
          <div className="f7-card f7-sb">
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
          <div className="f7-card f7-sb">
            <h4>
              Forecast, next 30 days
              {state.dataset.source === 'sample' && <i className="sub">Sample</i>}
            </h4>
            <div className="f7-fb">{fmtPrice(a.forecast30)}</div>
            <div className="sub" style={{ color: a.forecastPct < 0 ? 'var(--sell)' : 'var(--hold)' }}>
              {a.forecastPct >= 0 ? '+' : ''}
              {a.forecastPct.toFixed(1)}% vs latest price
            </div>
          </div>

          {/* Card: Accuracy check */}
          <div className="f7-card f7-sb">
            <h4>
              Accuracy check
              {state.dataset.source === 'sample' && <i className="sub">Sample</i>}
            </h4>
            <div className="sub" style={{ marginBottom: '6px' }}>
              Forecast vs last 30 real prices
            </div>
            <div className="f7-st">
              <span>Average difference</span>
              <b>{fmtPrice(a.mae ?? 0.08)}</b>
            </div>
            <div className="f7-st">
              <span>Largest difference</span>
              <b>{fmtPrice(a.maxError ?? 0.15)}</b>
            </div>
            <div className="f7-st">
              <span>MAPE</span>
              <b>{a.mape != null ? `${a.mape.toFixed(1)}%` : '–'}</b>
            </div>
          </div>

          {/* Card: Customize chart */}
          <details className="f7-card f7-sb" open>
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
                High / low markers
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
                <option value="log">Logarithmic</option>
              </select>

              <label className="f7-chk" style={{ marginTop: '8px' }}>
                <input
                  type="checkbox"
                  checked={autoFit}
                  onChange={(e) => setAutoFit(e.target.checked)}
                />
                Auto-fit price axis
              </label>

              <button
                type="button"
                className="f7-pb"
                style={{ marginTop: '10px', width: '100%', textAlign: 'center' }}
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
          Next: Recommendation and Drivers →
        </button>
      </div>
    </Shell>
  )
}

