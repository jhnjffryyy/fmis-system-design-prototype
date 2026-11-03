import { useStore, useAnalysis } from '../store'
import { DRIVERS, OUTSIDE_FACTORS, DISCLAIMER } from '../data/drivers'
import { Shell, ScreenTitle, Tag, CheckIcon, CrossIcon, EmptyState } from '../components/Shell'
import type { Route } from '../router'

const OPTS = ['SELL', 'WAIT AND WATCH', 'HOLD'] as const

export function Recommend({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const { a, rec } = useAnalysis()
  if (!a || !rec || !state.dataset) {
    return (
      <Shell
        session={state.session}
        route="recommendation"
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
      route="recommendation"
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle title="Recommendation and Drivers">
        <Tag kind="greentag" text="Prescriptive" />
        <span className="q">What should we do?</span>
      </ScreenTitle>

      <div className={`card big-decision ${cls}`}>
        <div className="label">System recommendation</div>
        <div className="word">{rec.decision}</div>
      </div>
      <div className="opts" role="group" aria-label="Possible recommendations">
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

      <div className="card rules-box">
        <b>The three rules:</b>
        <ol>
          <li><b>Sell:</b> the 30 day average is below the 90 day average and the forecast is lower than the latest price.</li>
          <li><b>Wait and watch:</b> only one of those two conditions is true, so the signals are mixed.</li>
          <li><b>Hold:</b> the 30 day average is above the 90 day average and the forecast is higher than the latest price.</li>
        </ol>
      </div>

      <div className="f8-cols">
        <div className="card">
          <h5>Why</h5>
          {rec.conditions.map((c) => (
            <div className="check" key={c.text}>
              <span className={c.yes ? 'yes' : 'no'}>
                {c.yes ? <CheckIcon /> : <CrossIcon />} {c.yes ? 'yes' : 'no'}
              </span>
              <span>{c.text}</span>
            </div>
          ))}
          <div className="means">
            <b>What this means:</b>{' '}
            {rec.decision === 'SELL'
              ? 'Recent prices are below the longer trend and the forecast is still lower. The system advises Sell.'
              : rec.decision === 'HOLD'
              ? 'Recent prices are above the longer trend and the forecast is higher. The system advises Hold.'
              : 'The signals do not agree, so the system advises waiting and watching.'}
          </div>
        </div>
        <div className="card">
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
      </div>

      <div className="note-row outside">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11 v6 M12 7 v.5" />
        </svg>
        <span><b>Outside factors, notes only:</b>{OUTSIDE_FACTORS.slice('Outside factors, notes only:'.length)}</span>
      </div>

      <div className="row-between">
        <span className="disclaimer">{DISCLAIMER}</span>
        <button className="btn primary" onClick={() => navigate('report')}>View report →</button>
      </div>
    </Shell>
  )
}
