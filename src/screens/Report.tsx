import { useMemo } from 'react'
import { useStore } from '../store'
import { analyze } from '../lib/analysis'
import { recommend } from '../lib/recommend'
import { DRIVERS, LIMITATIONS } from '../data/drivers'
import { fmtDate, fmtPrice } from '../lib/format'
import { Shell, ScreenTitle } from '../components/Shell'
import { LineChart } from '../components/LineChart'
import { decisionTag } from './Dashboard'

export function Report() {
  const { state, dispatch } = useStore()
  const a = useMemo(
    () => (state.dataset ? analyze(state.dataset.rows) : null),
    [state.dataset],
  )
  if (!a || !state.dataset) return null
  const rec = recommend(a)

  return (
    <Shell
      session={state.session}
      route="report"
      isSample={state.dataset.source === 'sample'}
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle step="05 · Report" title="Report">
        <span className="right">
          <button className="btn primary" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 8 V3 h10 v5" />
              <rect x="4" y="8" width="16" height="8" rx="1" />
              <path d="M7 13 h10 v7 H7 Z" />
            </svg>
            Print
          </button>
        </span>
      </ScreenTitle>

      <div className="report" id="report-card">
        <div className="sheet-head">
          <h3>Stock Trend and Advisory Report</h3>
          <div className="rhead mono">
            <span>DITO CME Holdings Corp.</span>
            <span>Date: {fmtDate(a.latestIso)}</span>
          </div>
        </div>

        <h6>PRICE SUMMARY</h6>
        <div className="psum">
          <span><i>Latest price</i> <b>{fmtPrice(a.latest)}</b></span>
          <span><i>30 day avg</i> <b>{fmtPrice(a.avg30)}</b></span>
          <span><i>90 day avg</i> <b>{fmtPrice(a.avg90)}</b></span>
          <span><i>Total drop</i> <b>about {Math.round(a.drop)} percent</b></span>
        </div>

        <h6>TREND AND FORECAST CHART</h6>
        <LineChart
          ariaLabel={`Closing price, averages, and dashed forecast to ${fmtPrice(a.forecast30)}`}
          forecastFrom={a.forecast[0]?.t}
          series={[
            {
              name: 'Closing price',
              className: 'price',
              stroke: 'var(--brand)',
              points: a.rows.map((r) => ({ t: r.t, v: r.price })),
            },
            {
              name: '30 day average',
              className: 'a30',
              stroke: 'var(--sky)',
              width: 1.2,
              points: a.rows
                .map((r, i) => ({ t: r.t, v: a.ma30[i] }))
                .filter((p): p is { t: number; v: number } => p.v != null),
            },
            {
              name: '90 day average',
              className: 'a90',
              stroke: 'var(--brand-dk)',
              width: 1.2,
              dash: '1.5,2.5',
              points: a.rows
                .map((r, i) => ({ t: r.t, v: a.ma90[i] }))
                .filter((p): p is { t: number; v: number } => p.v != null),
            },
            {
              name: 'Forecast',
              className: 'fc',
              stroke: 'var(--brand-dk)',
              width: 2,
              dash: '4,3',
              points: a.forecast.map((f) => ({ t: f.t, v: f.v })),
            },
          ]}
        />

        <h6>RECOMMENDATION</h6>
        <div className="rec-line">
          {decisionTag(rec.decision)}
          <span>
            Reasons: {rec.conditions.map((c) => c.text).join('; ')}
          </span>
        </div>

        <h6>DRIVERS</h6>
        <ul className="drivers">
          {DRIVERS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>

        <h6>NOTES / LIMITATIONS</h6>
        <div className="notes-box">
          <ul className="drivers">
            {LIMITATIONS.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="cfo">CFO has view only access</div>
    </Shell>
  )
}
