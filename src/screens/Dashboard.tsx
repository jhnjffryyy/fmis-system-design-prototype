import { useMemo } from 'react'
import { useStore } from '../store'
import { analyze } from '../lib/analysis'
import { recommend, type Decision } from '../lib/recommend'
import { fmtDate, fmtMonth, fmtPrice, fmtPctPlain } from '../lib/format'
import { Shell, ScreenTitle, CheckIcon, CrossIcon } from '../components/Shell'
import { LineChart } from '../components/LineChart'
import type { Route } from '../router'

function decisionTag(d: Decision) {
  return <span className={`tag ${d === 'SELL' ? 'sell' : d === 'HOLD' ? 'hold' : 'wait'}`}>{d}</span>
}
export { decisionTag }

const STEPS: { route: Route; label: string }[] = [
  { route: 'import', label: 'Data Import' },
  { route: 'trend', label: 'Trend and Forecast' },
  { route: 'recommendation', label: 'Recommendation and Drivers' },
  { route: 'report', label: 'Report' },
]

export function Dashboard({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const a = useMemo(
    () => (state.dataset ? analyze(state.dataset.rows) : null),
    [state.dataset],
  )
  if (!a || !state.dataset) return null
  const rec = recommend(a)
  const lastRow = a.rows[a.rows.length - 1]

  return (
    <Shell
      session={state.session}
      route="dashboard"
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle step="01 · Dashboard" title="Dashboard">
        <span className="right">Last updated {fmtDate(a.latestIso)}</span>
      </ScreenTitle>
      <div className="wf-box ticker">
        <div className="tick">
          <div className="eyebrow">Latest price</div>
          <b className="big">{fmtPrice(a.latest)}</b>
        </div>
        <div className="tick">
          <div className="eyebrow">Change</div>
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
      <div className="dash-row">
        <div className="wf-box chart">
          <div className="chart-title">
            Closing price, {fmtMonth(a.firstIso)} to {fmtMonth(a.latestIso)}
          </div>
          <LineChart
            ariaLabel={`Closing price from ${fmtDate(a.firstIso)} to ${fmtDate(a.latestIso)}, falling from ${fmtPrice(a.first)} to ${fmtPrice(a.latest)}`}
            series={[
              {
                name: 'Closing price',
                className: 'price',
                stroke: 'var(--brand)',
                points: a.rows.map((r) => ({ t: r.t, v: r.price })),
                area: true,
              },
            ]}
            markers={[
              { t: Date.parse(`${a.high.iso}T00:00:00Z`), v: a.high.v, label: `Peak ${fmtPrice(a.high.v)}` },
              { t: lastRow.t, v: a.latest, label: fmtPrice(a.latest) },
            ]}
          />
        </div>
        <div className={`wf-box rec ${rec.decision === 'SELL' ? 'sell' : rec.decision === 'HOLD' ? 'hold' : 'wait'}`}>
          <div className="eyebrow">Current recommendation</div>
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
        <span className="eyebrow">Go to</span>
        {STEPS.map((s, i) => (
          <button key={s.route} className="goto-link" onClick={() => navigate(s.route)}>
            <span className="idx">{String(i + 2).padStart(2, '0')}</span>
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
