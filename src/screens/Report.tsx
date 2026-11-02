import { useMemo } from 'react'
import { useStore } from '../store'
import { analyze } from '../lib/analysis'
import { recommend } from '../lib/recommend'
import { DRIVERS, OUTSIDE_FACTORS, DISCLAIMER } from '../data/drivers'
import { fmtDate, fmtMonth, fmtPrice, fmtPctPlain } from '../lib/format'
import { Shell, ScreenTitle, Tag, CheckIcon, CrossIcon } from '../components/Shell'
import { LineChart } from '../components/LineChart'
import { decisionTag } from './Dashboard'
import type { Route } from '../router'

const OPTS = ['SELL', 'WAIT AND WATCH', 'HOLD'] as const

const STEPS: { route: Route; label: string }[] = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'import', label: 'Data Import' },
  { route: 'trend', label: 'Trend and Forecast' },
  { route: 'recommendation', label: 'Recommendation and Drivers' },
]

export function Report({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const a = useMemo(
    () => (state.dataset ? analyze(state.dataset.rows) : null),
    [state.dataset],
  )
  if (!a || !state.dataset) return null
  const rec = recommend(a)
  const cls = rec.decision === 'SELL' ? 'sell' : rec.decision === 'HOLD' ? 'hold' : 'wait'

  return (
    <Shell
      session={state.session}
      route="report"
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle step="05 · Report" title="Stock Trend and Advisory Report">
        <span className="right">
          Report date: {fmtDate(a.latestIso)}{' '}
          <button className="btn primary" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 8 V3 h10 v5" />
              <rect x="4" y="8" width="16" height="8" rx="1" />
              <path d="M7 13 h10 v7 H7 Z" />
            </svg>
            Print Report
          </button>
        </span>
      </ScreenTitle>

      <div id="report-card" className="report">
        <div className="wf-box ticker">
          <div className="tick">
            <div className="eyebrow">Latest price</div>
            <b className="big">{fmtPrice(a.latest)}</b>
          </div>
          <div className="tick">
            <div className="eyebrow">Daily change</div>
            <b className={a.change < 0 ? 'neg' : ''}>
              {a.change < 0 && (
                <svg viewBox="0 0 10 8" width="10" height="8" aria-hidden="true" className="tri">
                  <path d="M5 8 L0 0 L10 0 Z" fill="currentColor" />
                </svg>
              )}
              {fmtPctPlain(a.change)}
            </b>
          </div>
          <div className="tick">
            <div className="eyebrow">30 day average</div>
            <b>{fmtPrice(a.avg30)}</b>
          </div>
          <div className="tick">
            <div className="eyebrow">90 day average</div>
            <b>{fmtPrice(a.avg90)}</b>
          </div>
        </div>

        <div className="report-stats">
          <div>First price <b>{fmtPrice(a.first)}</b> · {fmtDate(a.firstIso)}</div>
          <div>Total drop <b className="sell">approximately {Math.round(a.drop)}%</b></div>
          <div>Highest close <b>{fmtPrice(a.high.v)}</b> · {fmtDate(a.high.iso)}</div>
          <div>Lowest close <b>{fmtPrice(a.low.v)}</b> · {fmtDate(a.low.iso)}</div>
          <div>Records <b>{a.rows.length}</b> trading days</div>
        </div>

        <div className="dash-row">
          <div className="wf-box chart">
            <div className="chart-title">
              Closing Price and Forecast, {fmtMonth(a.firstIso)} to {fmtMonth(a.latestIso)}
              {' '}
              <Tag kind="greentag" text="Predictive" />
            </div>
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
          </div>
          <div className={`wf-box rec ${cls}`}>
            <div className="eyebrow">Current recommendation</div>
            <Tag kind="greentag" text="Prescriptive" />
            {decisionTag(rec.decision)}
            {rec.conditions.map((c) => (
              <div className="check" key={c.text}>
                <span className={c.yes ? 'yes' : 'no'}>
                  {c.yes ? <CheckIcon /> : <CrossIcon />} {c.yes ? 'yes' : 'no'}
                </span>
                <span>{c.text}</span>
              </div>
            ))}
            <div className="opts no-print" role="group" aria-label="Possible recommendations">
              {OPTS.map((d) => {
                const c = d === 'SELL' ? 'sell' : d === 'HOLD' ? 'hold' : 'wait'
                return (
                  <span
                    key={d}
                    className={`seg ${c}${rec.decision === d ? ' active' : ''}`}
                  >
                    {d === 'SELL' ? 'Sell' : d === 'HOLD' ? 'Hold' : 'Wait and watch'}
                  </span>
                )
              })}
            </div>
            <button className="btn btn-sm no-print" onClick={() => navigate('recommendation')}>
              View Recommendation
            </button>
          </div>
        </div>

        <div className="wf-box drivers-box">
          <h5>KEY FINANCIAL DRIVERS</h5>
          <ol className="drivers ledger">
            {DRIVERS.map((d, i) => (
              <li key={d}>
                <span className="idx">{i + 1}</span>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="note-row outside">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11 v6 M12 7 v.5" />
          </svg>
          <span><b>Outside factors (notes only):</b> {OUTSIDE_FACTORS}</span>
        </div>

        <div className="report-foot">
          <span>Forecast values are estimates, not guaranteed future prices.</span>
          <span className="chip">CFO: View-only access</span>
        </div>

        <span className="disclaimer">{DISCLAIMER}</span>
      </div>

      <div className="goto">
        <span className="eyebrow">Go to</span>
        {STEPS.map((s, i) => (
          <button key={s.route} className="goto-link" onClick={() => navigate(s.route)}>
            <span className="idx">{String(i + 1).padStart(2, '0')}</span>
            {s.label}
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12 h14 M13 6 l6 6 -6 6" />
            </svg>
          </button>
        ))}
      </div>
    </Shell>
  )
}
