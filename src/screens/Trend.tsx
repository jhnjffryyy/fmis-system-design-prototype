import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { analyze } from '../lib/analysis'
import { fmtPrice } from '../lib/format'
import { Shell, ScreenTitle, Tag } from '../components/Shell'
import { LineChart, type Series } from '../components/LineChart'
import type { Route } from '../router'

const RANGES = [
  { id: 'all', label: 'All', days: Infinity },
  { id: '1y', label: '1Y', days: 365 },
  { id: '6m', label: '6M', days: 183 },
  { id: '3m', label: '3M', days: 92 },
] as const

export function Trend({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('all')
  const a = useMemo(
    () => (state.dataset ? analyze(state.dataset.rows) : null),
    [state.dataset],
  )
  if (!a || !state.dataset) return null

  const r = RANGES.find((x) => x.id === range)!
  const cutoff = a.rows[a.rows.length - 1].t - r.days * 86400000
  const vis = a.rows.map((row, i) => ({ row, i })).filter(({ row }) => row.t >= cutoff)
  const price: Series = {
    name: 'Closing price',
    className: 'price',
    stroke: 'var(--brand)',
    area: true,
    points: vis.map(({ row }) => ({ t: row.t, v: row.price })),
  }
  const ma30: Series = {
    name: '30 day average',
    className: 'a30',
    stroke: 'var(--sky)',
    width: 1.75,
    points: vis.filter(({ i }) => a.ma30[i] != null).map(({ row, i }) => ({ t: row.t, v: a.ma30[i]! })),
  }
  const ma90: Series = {
    name: '90 day average',
    className: 'a90',
    stroke: 'var(--brand-dk)',
    width: 1.5,
    dash: '1.5,2.5',
    points: vis.filter(({ i }) => a.ma90[i] != null).map(({ row, i }) => ({ t: row.t, v: a.ma90[i]! })),
  }
  const fc: Series = {
    name: 'Forecast',
    className: 'fc',
    stroke: 'var(--brand-dk)',
    width: 2,
    dash: '5,4',
    points: a.forecast.map((f) => ({ t: f.t, v: f.v })),
  }
  const lastRow = a.rows[a.rows.length - 1]
  const fcEnd = a.forecast[a.forecast.length - 1]

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
      <div className="method mut">
        Method: Time Series Analysis (30 and 90 day moving averages, 30 day forecast)
      </div>
      <div className="f7-row">
        <div className="wf-box chart">
          <div className="range-btns" role="group" aria-label="Chart range">
            {RANGES.map((x) => (
              <button
                key={x.id}
                className={`seg${range === x.id ? ' active' : ''}`}
                onClick={() => setRange(x.id)}
              >
                {x.label}
              </button>
            ))}
          </div>
          <LineChart
            ariaLabel={`Closing price, 30 and 90 day averages, and a dashed 30 day forecast ending at ${fmtPrice(a.forecast30)}`}
            series={[price, ma30, ma90, fc]}
            forecastFrom={a.forecast[0]?.t}
            markers={[
              { t: lastRow.t, v: a.latest, label: fmtPrice(a.latest) },
              ...(fcEnd ? [{ t: fcEnd.t, v: fcEnd.v, label: `Day 30 ${fmtPrice(fcEnd.v)}` }] : []),
            ]}
          />
          <div className="chart-legend">
            <span><i className="sw" />Closing price</span>
            <span><i className="sw a30" />30 day average</span>
            <span><i className="sw a90" />90 day average</span>
            <span><i className="sw fc" />Forecast (dashed)</span>
          </div>
        </div>
        <div className="wf-box side">
          <div className="kv"><span>Latest price</span><b>{fmtPrice(a.latest)}</b></div>
          <div className="kv"><span>30 day avg</span><b>{fmtPrice(a.avg30)}</b></div>
          <div className="kv"><span>90 day avg</span><b>{fmtPrice(a.avg90)}</b></div>
          <div className="kv trend">
            <span>Trend</span>
            <b>
              {a.trend}
              {a.trend === 'Downward' && (
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="down-arrow">
                  <path d="M12 4 v14 M6 12 l6 6 6 -6" />
                </svg>
              )}
            </b>
          </div>
        </div>
      </div>
      <div className="f7-boxes">
        <div className="wf-box">
          <h5>Forecast, next 30 days</h5>
          <b className="num">Day 30: {fmtPrice(a.forecast30)}</b>
          <div className="subnote">Linear trend of the last 90 trading days</div>
        </div>
        <div className="wf-box">
          <h5>Accuracy check</h5>
          {a.mape != null ? (
            <>
              <div className="mut">Forecast vs last 30 real prices:</div>
              <b className="num">avg error {a.mape.toFixed(1)}%</b>
            </>
          ) : (
            <b className="num">Not enough data for an accuracy check</b>
          )}
        </div>
      </div>
      <div className="row-end">
        <button className="btn primary" onClick={() => navigate('recommendation')}>
          Next
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12 h14 M13 6 l6 6 -6 6" />
          </svg>
        </button>
      </div>
    </Shell>
  )
}
