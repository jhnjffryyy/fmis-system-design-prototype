import { useStore, useAnalysis } from '../store'
import { DRIVERS, OUTSIDE_FACTORS, limitations } from '../data/drivers'
import { fmtDate, fmtMonth, fmtPrice, fmtPct, fmtPctAbs } from '../lib/format'
import { Shell, ScreenTitle, Tag, CheckIcon, CrossIcon, EmptyState } from '../components/Shell'
import { LineChart } from '../components/LineChart'
import { decisionTag, ChangeValue } from './Dashboard'
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
  const { a, rec } = useAnalysis()
  if (!a || !rec || !state.dataset) {
    return (
      <Shell
        session={state.session}
        route="report"
        onLogout={() => dispatch({ type: 'logout' })}
      >
        <EmptyState navigate={navigate} />
      </Shell>
    )
  }
  const cls = rec.decision === 'SELL' ? 'sell' : rec.decision === 'HOLD' ? 'hold' : 'wait'

  return (
    <Shell
      session={state.session}
      route="report"
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle title="Stock Trend and Advisory Report">
        <span className="q">DITO CME Holdings Corp.</span>
        <span className="right">
          Data as of {fmtDate(a.latestIso)}{' '}
          <button className="btn primary" onClick={() => window.print()}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 8 V3 h10 v5" />
              <rect x="4" y="8" width="16" height="8" rx="1" />
              <path d="M7 13 h10 v7 H7 Z" />
            </svg>
            Print report
          </button>
        </span>
      </ScreenTitle>

      <div id="report-card" className="report">
        <div className="card ticker">
          <div className="tick">
            <div className="label">Latest price</div>
            <b className="big">{fmtPrice(a.latest)}</b>
          </div>
          <div className="tick">
            <div className="label">Daily change</div>
            <ChangeValue v={a.change} />
          </div>
          <div className="tick">
            <div className="label">30 day average</div>
            <b>{fmtPrice(a.avg30)}</b>
          </div>
          <div className="tick">
            <div className="label">90 day average</div>
            <b>{fmtPrice(a.avg90)}</b>
          </div>
        </div>

        <div className="report-stats">
          <div>First price <b>{fmtPrice(a.first)}</b> on {fmtDate(a.firstIso)}</div>
          <div>Total change <b className="sell">{fmtPct(a.totalChange)}</b></div>
          <div>Highest close <b>{fmtPrice(a.high.v)}</b> on {fmtDate(a.high.iso)}</div>
          <div>Lowest close <b>{fmtPrice(a.low.v)}</b> on {fmtDate(a.low.iso)}</div>
          <div>Records <b>{a.rows.length}</b></div>
        </div>

        <div className="dash-row">
          <div className="card chart">
            <div className="chart-title">
              Closing price and forecast, {fmtMonth(a.firstIso)} to {fmtMonth(a.latestIso)}
              {' '}
              <Tag kind="greentag" text="Predictive" />
            </div>
            <LineChart
              ariaLabel={`Closing price, averages, and dashed forecast to ${fmtPrice(a.forecast30)}`}
              summary={`Closing price from ${fmtDate(a.firstIso)} at ${fmtPrice(a.first)} to ${fmtDate(a.latestIso)} at ${fmtPrice(a.latest)}. High ${fmtPrice(a.high.v)} on ${fmtDate(a.high.iso)}. Low ${fmtPrice(a.low.v)} on ${fmtDate(a.low.iso)}. Forecast day 30 ${fmtPrice(a.forecast30)}.`}
              forecastFrom={a.forecast[0]?.t}
              band={a.forecast.map((f) => ({
                t: f.t,
                lo: f.lower ?? f.v,
                hi: f.upper ?? f.v,
              }))}
              series={[
                {
                  name: 'Closing price',
                  className: 'price',
                  stroke: 'var(--c-price)',
                  hoverable: true,
                  points: a.rows.map((r) => ({ t: r.t, v: r.price })),
                },
                {
                  name: '30 day average',
                  className: 'a30',
                  stroke: 'var(--c-ma30)',
                  width: 1.8,
                  points: a.rows
                    .map((r, i) => ({ t: r.t, v: a.ma30[i] }))
                    .filter((p): p is { t: number; v: number } => p.v != null),
                },
                {
                  name: '90 day average',
                  className: 'a90',
                  stroke: 'var(--c-ma90)',
                  width: 1.8,
                  dash: '2 3',
                  points: a.rows
                    .map((r, i) => ({ t: r.t, v: a.ma90[i] }))
                    .filter((p): p is { t: number; v: number } => p.v != null),
                },
                {
                  name: 'Forecast',
                  className: 'fc',
                  stroke: 'var(--c-forecast)',
                  width: 2,
                  dash: '5 4',
                  points: a.forecast.map((f) => ({ t: f.t, v: f.v })),
                },
              ]}
            />
            {/* static legend: same items and swatches as Trend, readable in black and white */}
            <div className="f7-lg">
              <span>
                <i style={{ borderColor: 'var(--c-price)' }} />
                Closing price
              </span>
              <span>
                <i style={{ borderColor: 'var(--c-ma30)' }} />
                30 day average
              </span>
              <span>
                <i style={{ borderColor: 'var(--c-ma90)', borderTopStyle: 'dotted' }} />
                90 day average
              </span>
              <span>
                <i style={{ borderColor: 'var(--c-forecast)', borderTopStyle: 'dashed' }} />
                Forecast and 95% range
              </span>
            </div>
          </div>
          <div className={`card rec ${cls}`}>
            <div className="label">Current recommendation</div>
            <div className="tagrow">
              <Tag kind="greentag" text="Prescriptive" />
              {decisionTag(rec.decision)}
            </div>
            {rec.conditions.map((c) => (
              <div className="check" key={c.text}>
                <span className={c.yes ? 'yes' : 'no'}>
                  {c.yes ? <CheckIcon /> : <CrossIcon />} {c.yes ? 'yes' : 'no'}
                </span>
                <span>{c.text}</span>
              </div>
            ))}
            <div className="means">
              Forecast day 30: {fmtPrice(a.forecast30)}, {fmtPct(a.forecastPct)} against the
              latest price
            </div>
            <div className="means">
              {a.mae != null && a.maxError != null && a.mape != null
                ? `Accuracy check: average difference ${fmtPrice(a.mae)}, largest difference ${fmtPrice(a.maxError)}, MAPE ${fmtPctAbs(a.mape)}`
                : 'Accuracy check: not enough data'}
            </div>
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
              View recommendation
            </button>
          </div>
        </div>

        <div className="card drivers-box">
          <h5>Drivers</h5>
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
          <span><b>Outside factors, notes only:</b>{OUTSIDE_FACTORS.slice('Outside factors, notes only:'.length)}</span>
        </div>

        <div className="card drivers-box">
          <h5>Notes and limitations</h5>
          <ol className="drivers ledger">
            {limitations(a.firstIso, a.latestIso).map((d) => (
              <li key={d}>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="report-foot">
          <span className="chip">CFO: view only access.</span>
        </div>
      </div>

      <div className="goto no-print">
        <span className="label">Go to</span>
        {STEPS.map((s) => (
          <button key={s.route} className="goto-link" onClick={() => navigate(s.route)}>
            {s.label}
          </button>
        ))}
      </div>
    </Shell>
  )
}
