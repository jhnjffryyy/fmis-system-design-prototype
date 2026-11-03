import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fmtDate, fmtPrice } from '../lib/format'

export interface SeriesPoint {
  /** ms since epoch (UTC) */
  t: number
  v: number
}

export interface Series {
  name: string
  points: SeriesPoint[]
  className?: string
  stroke?: string
  width?: number
  dash?: string
  opacity?: number
  area?: boolean
  /** draw a hover dot on this series only (the price line) */
  hoverable?: boolean
}

export interface ChartMarker {
  t: number
  v: number
  label: string
}

const PAD = { l: 46, r: 14, t: 16, b: 30 }
const FS = 11 // chart text >= 11px

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1
  const step0 = span / count
  const mag = Math.pow(10, Math.floor(Math.log10(step0)))
  const norm = step0 / mag
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6))
  return out
}

export interface BandPoint {
  t: number
  lo: number
  hi: number
}

export function LineChart({ series, ariaLabel, forecastFrom, markers, band, summary }: {
  series: Series[]
  ariaLabel: string
  /** time at which the shaded forecast zone begins */
  forecastFrom?: number
  markers?: ChartMarker[]
  /** optional confidence band rendered as a filled polygon */
  band?: BandPoint[]
  /** visually hidden text alternative rendered next to the svg */
  summary?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 640, h: 300 })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measureNow = () => {
      if (el.clientWidth > 0) setSize({ w: el.clientWidth, h: el.clientHeight || 300 })
    }
    let t = 0
    const ro = new ResizeObserver((entries) => {
      clearTimeout(t)
      t = window.setTimeout(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect
          if (width > 0 && height > 0) setSize({ w: width, h: height })
        }
      }, 100)
    })
    ro.observe(el)
    measureNow()
    // print layout differs from screen layout: re-measure synchronously
    window.addEventListener('beforeprint', measureNow)
    window.addEventListener('afterprint', measureNow)
    const pm = window.matchMedia('print')
    pm.addEventListener('change', measureNow)
    return () => {
      clearTimeout(t)
      ro.disconnect()
      window.removeEventListener('beforeprint', measureNow)
      window.removeEventListener('afterprint', measureNow)
      pm.removeEventListener('change', measureNow)
    }
  }, [])

  const W = Math.round(size.w)
  const H = Math.round(size.h)

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    if (!all.length) return null
    const t0 = Math.min(...all.map((p) => p.t))
    const t1 = Math.max(...all.map((p) => p.t))
    let v0 = Math.min(...all.map((p) => p.v), ...(band ?? []).map((p) => p.lo))
    let v1 = Math.max(...all.map((p) => p.v), ...(band ?? []).map((p) => p.hi))
    const padV = (v1 - v0) * 0.06 || 0.1
    v0 -= padV
    v1 += padV
    const X = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r)
    const Y = (v: number) => PAD.t + (1 - (v - v0) / (v1 - v0)) * (H - PAD.t - PAD.b)
    // about one y tick per 50px of plot height
    const ticks = niceTicks(v0, v1, Math.max(2, Math.round((H - PAD.t - PAD.b) / 50)))
    // about one x label per 90px
    const base = series[0].points
    const xi: number[] = []
    const nLab = Math.min(Math.max(2, Math.floor((W - PAD.l - PAD.r) / 90)), base.length)
    for (let i = 0; i < nLab; i++) xi.push(Math.round((i * (base.length - 1)) / (nLab - 1)))
    const xLabels = [...new Set(xi)].map((i) => base[i])
    return { t0, t1, v0, v1, X, Y, ticks, xLabels, base }
  }, [series, band, W, H])

  // keep the tooltip inside the chart box
  const [tipW, setTipW] = useState(0)
  useLayoutEffect(() => {
    if (tipRef.current) setTipW(tipRef.current.offsetWidth)
  }, [hover])

  if (!model) return <div className="chart-empty">No data</div>
  const { X, Y, ticks, xLabels, base } = model

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const t = model.t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (model.t1 - model.t0)
    let best = 0
    let bd = Infinity
    base.forEach((p, i) => {
      const d = Math.abs(p.t - t)
      if (d < bd) {
        bd = d
        best = i
      }
    })
    setHover(best)
  }

  const hp = hover !== null ? base[hover] : null
  const hoverVals = hp
    ? series.map((s) => ({
        name: s.name,
        v: s.points.find((p) => p.t === hp.t)?.v,
      }))
    : []

  const fzX = forecastFrom != null ? X(forecastFrom) : null
  const tipLeft = hp ? Math.min(Math.max(8, X(hp.t) + 10), Math.max(8, W - tipW - 8)) : 8

  return (
    <div className="line-chart" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {fzX !== null && fzX < W - PAD.r && (
          <g className="fzone">
            <rect x={fzX} y={PAD.t} width={W - PAD.r - fzX} height={H - PAD.t - PAD.b} />
            <text x={Math.min(fzX + 6, W - PAD.r - 62)} y={PAD.t + FS + 2} fontSize={FS}>
              Next 30 days
            </text>
          </g>
        )}
        {/* y-axis title, rotated, left of the tick labels */}
        <text
          className="clbl"
          transform={`rotate(-90, 12, ${PAD.t + (H - PAD.t - PAD.b) / 2})`}
          x={12}
          y={PAD.t + (H - PAD.t - PAD.b) / 2}
          textAnchor="middle"
          fontSize={FS}
        >
          Close, Php
        </text>
        {ticks.map((v) => (
          <g key={v}>
            <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={Y(v)} y2={Y(v)} />
            {Y(v) < H - PAD.b - 4 && (
              <text className="clbl" x={PAD.l - 6} y={Y(v) + 3.5} textAnchor="end" fontSize={FS}>
                {v % 1 === 0 ? v : v.toFixed(2)}
              </text>
            )}
          </g>
        ))}
        <line className="ax" x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        <line className="ax" x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} />
        {xLabels.map((p, i) => {
          const edge = i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'
          const lx = i === 0 ? X(p.t) : i === xLabels.length - 1 ? X(p.t) : X(p.t)
          return (
            <text key={p.t} className="clbl" x={lx} y={H - 8} textAnchor={edge} fontSize={FS}>
              {fmtDate(new Date(p.t).toISOString().slice(0, 10))}
            </text>
          )
        })}
        {band && band.length > 1 && (
          <polygon
            className="band"
            points={`${band.map((p) => `${X(p.t)},${Y(p.hi)}`).join(' ')} ${[...band]
              .reverse()
              .map((p) => `${X(p.t)},${Y(p.lo)}`)
              .join(' ')}`}
          />
        )}
        {series.map((s) => (
          <g key={s.name}>
            {s.area && (
              <polygon
                className="area"
                points={`${s.points.map((p) => `${X(p.t)},${Y(p.v)}`).join(' ')} ${X(s.points[s.points.length - 1].t)},${H - PAD.b} ${X(s.points[0].t)},${H - PAD.b}`}
              />
            )}
            <polyline
              className={s.className}
              fill="none"
              stroke={s.stroke}
              strokeWidth={s.width ?? 2}
              strokeDasharray={s.dash}
              opacity={s.opacity}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.points.map((p) => `${X(p.t)},${Y(p.v)}`).join(' ')}
            />
          </g>
        ))}
        {(() => {
          const used: { x: number; y: number }[] = []
          return markers?.map((m) => {
            const x = X(m.t)
            const y = Y(m.v)
            const anchor = x > W - PAD.r - 60 ? 'end' : 'start'
            const tx = anchor === 'end' ? x - 7 : x + 7
            let ly = Math.max(PAD.t + FS, y - FS - 2)
            if (used.some((u) => Math.abs(u.x - x) < 90 && Math.abs(u.y - ly) < FS + 4)) {
              ly = Math.min(H - PAD.b - 2, y + FS + 8)
            }
            used.push({ x, y: ly })
            return (
              <g key={`${m.t}-${m.label}`} className="marker">
                <circle cx={x} cy={y} r="4" />
                <text x={tx} y={ly} textAnchor={anchor} fontSize={FS}>{m.label}</text>
              </g>
            )
          })
        })()}
        {hp && (
          <line
            className="crosshair"
            x1={X(hp.t)}
            x2={X(hp.t)}
            y1={PAD.t}
            y2={H - PAD.b}
          />
        )}
        {hp &&
          series.map((s) => {
            if (!s.hoverable) return null
            const p = s.points.find((q) => q.t === hp.t)
            return p ? <circle key={s.name} className="pt-hover" cx={X(p.t)} cy={Y(p.v)} r="3.5" /> : null
          })}
      </svg>
      {hp && (
        <div className="chart-tip" role="status" ref={tipRef} style={{ left: tipLeft }}>
          <b>{fmtDate(new Date(hp.t).toISOString().slice(0, 10))}</b>
          {hoverVals.map(
            (h) =>
              h.v !== undefined && (
                <span key={h.name}>
                  {h.name}: <b>{fmtPrice(h.v)}</b>
                </span>
              ),
          )}
        </div>
      )}
      {summary && <div className="sr-only">{summary}</div>}
    </div>
  )
}
