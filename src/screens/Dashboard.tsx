import { useStore, useAnalysis } from '../store'
import type { Decision } from '../lib/recommend'
import { fmtDate, fmtMonth, fmtPrice, fmtPct } from '../lib/format'
import { Shell, ScreenTitle, CheckIcon, CrossIcon, EmptyState } from '../components/Shell'
import { LineChart } from '../components/LineChart'
import type { Route } from '../router'

function decisionTag(d: Decision) {
  return <span className={`tag ${d === 'SELL' ? 'sell' : d === 'HOLD' ? 'hold' : 'wait'}`}>{d}</span>
}
export { decisionTag }

/** Daily change value: red + down triangle, green + up triangle, gray at zero. */
export function ChangeValue({ v }: { v: number }) {
  const zero = v.toFixed(2) === '0.00'
  const neg = !zero && v < 0
  return (
    <b className={zero ? '' : neg ? 'neg' : 'pos'}>
      {!zero && (
        <svg viewBox="0 0 10 8" width="10" height="8" aria-hidden="true" className="tri">
          <path d={neg ? 'M5 8 L0 0 L10 0 Z' : 'M5 0 L0 8 L10 8 Z'} fill="currentColor" />
        </svg>
      )}
      {fmtPct(v)}
    </b>
  )
}

const STEPS: { route: Route; label: string }[] = [
  { route: 'import', label: 'Data Import' },
  { route: 'trend', label: 'Trend and Forecast' },
  { route: 'recommendation', label: 'Recommendation and Drivers' },
  { route: 'report', label: 'Report' },
]

export function Dashboard({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const { a, rec } = useAnalysis()
  if (!a || !rec || !state.dataset) {
    return (
      <Shell
        session={state.session}
        route="dashboard"
        onLogout={() => dispatch({ type: 'logout' })}
      >
        <EmptyState navigate={navigate} />
      </Shell>
    )
  }
  const lastRow = a.rows[a.rows.length - 1]

  return (
    <Shell
      session={state.session}
      route="dashboard"
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle title="Dashboard">
        <span className="right">Last updated {fmtDate(a.latestIso)}</span>
      </ScreenTitle>
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
      <div className="dash-row">
        <div className="card chart">
          <div className="chart-title">
            Closing price, {fmtMonth(a.firstIso)} to {fmtMonth(a.latestIso)}
          </div>
          <LineChart
            ariaLabel={`Closing price from ${fmtDate(a.firstIso)} to ${fmtDate(a.latestIso)}, falling from ${fmtPrice(a.first)} to ${fmtPrice(a.latest)}`}
            summary={`Closing price from ${fmtDate(a.firstIso)} at ${fmtPrice(a.first)} to ${fmtDate(a.latestIso)} at ${fmtPrice(a.latest)}. High ${fmtPrice(a.high.v)} on ${fmtDate(a.high.iso)}. Low ${fmtPrice(a.low.v)} on ${fmtDate(a.low.iso)}.`}
            series={[
              {
                name: 'Closing price',
                className: 'price',
                stroke: 'var(--c-price)',
                hoverable: true,
                points: a.rows.map((r) => ({ t: r.t, v: r.price })),
                area: true,
              },
            ]}
            markers={[
              { t: Date.parse(`${a.high.iso}T00:00:00Z`), v: a.high.v, label: `High ${fmtPrice(a.high.v)}` },
              { t: Date.parse(`${a.low.iso}T00:00:00Z`), v: a.low.v, label: `Low ${fmtPrice(a.low.v)}` },
              { t: lastRow.t, v: a.latest, label: `Latest ${fmtPrice(a.latest)}` },
            ]}
          />
        </div>
        <div className={`card rec ${rec.decision === 'SELL' ? 'sell' : rec.decision === 'HOLD' ? 'hold' : 'wait'}`}>
          <div className="label">Current recommendation</div>
          {decisionTag(rec.decision)}
          {rec.conditions.map((c) => (
            <div className="check" key={c.text}>
              <span className={c.yes ? 'yes' : 'no'}>
                {c.yes ? <CheckIcon /> : <CrossIcon />} {c.yes ? 'yes' : 'no'}
              </span>
              <span>{c.text}</span>
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => navigate('recommendation')}>
            View recommendation
          </button>
        </div>
      </div>
      <div className="goto">
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
