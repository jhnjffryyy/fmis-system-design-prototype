import type { ReactNode } from 'react'
import type { Session } from '../store'
import type { Route } from '../router'

const MENU: { route: Route; label: string }[] = [
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'import', label: 'Data Import' },
  { route: 'trend', label: 'Trend and Forecast' },
  { route: 'recommendation', label: 'Recommendation and Drivers' },
  { route: 'report', label: 'Report' },
]

export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3,17 9,11 13,14 21,5" />
        <polyline points="15,5 21,5 21,11" />
      </svg>
    </span>
  )
}

function TopBar({ session, onLogout, isSample }: {
  session: Session
  onLogout?: () => void
  isSample: boolean
}) {
  return (
    <div className="shell-top">
      <LogoMark />
      <div className="names">
        <div className="sys">Stock Trend Forecasting and Advisory Module</div>
        <div className="org">DITO CME Holdings Corp.</div>
      </div>
      <div className="top-right">
        {isSample && (
          <span className="badge-sample">
            <span className="full">Sample data</span>
            <span className="short">Sample</span>
          </span>
        )}
        <span className="role">Role: {session.role ?? '(not yet)'}</span>
        {session.role && (
          <span className="role-chip" title={`Role: ${session.role}`}>{session.role}</span>
        )}
        {session.user && onLogout && (
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Logout
          </button>
        )}
      </div>
    </div>
  )
}

export function Shell({
  session,
  route,
  onLogout,
  isSample,
  locked,
  children,
}: {
  session: Session
  route: Route | null
  onLogout?: () => void
  isSample: boolean
  locked?: boolean
  children: ReactNode
}) {
  return (
    <div className="shell">
      <TopBar session={session} onLogout={onLogout} isSample={isSample} />
      <div className="shell-body">
        <nav className={`shell-menu${locked ? ' locked' : ''}`} aria-label="Main menu">
          {MENU.map((m, i) => (
            <a
              key={m.route}
              href={`#/${m.route}`}
              className={route === m.route ? 'active' : ''}
              aria-current={route === m.route ? 'page' : undefined}
              aria-disabled={locked || undefined}
              tabIndex={locked ? -1 : undefined}
              onClick={locked ? (e) => e.preventDefault() : undefined}
            >
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="lbl">{m.label}</span>
            </a>
          ))}
          {locked && (
            <div className="locknote">
              <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11 V8 a4 4 0 0 1 8 0 v3" />
              </svg>
              Locked until login
            </div>
          )}
        </nav>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  )
}

export function ScreenTitle({ step, title, children }: {
  step?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="screen-title">
      <div className="st-head">
        {step && <div className="eyebrow">{step}</div>}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  )
}

export function Tag({ kind, text }: { kind: 'greentag' | 'sell' | 'wait' | 'hold'; text: string }) {
  return <span className={`tag ${kind}`}>{text}</span>
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 L9.5 18 L20 6.5" />
    </svg>
  )
}

export function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  )
}
