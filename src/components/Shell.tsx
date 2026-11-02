import type { ReactNode } from 'react'
import type { Session } from '../store'
import type { Route } from '../router'
import logoUrl from '../assets/dito-logo.jpg'

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
      <img src={logoUrl} alt="" />
    </span>
  )
}

function TopBar({ session, onLogout }: {
  session: Session
  onLogout?: () => void
}) {
  return (
    <div className="shell-top">
      <LogoMark />
      <div className="names">
        <div className="sys">Stock Trend Forecasting and Advisory Module</div>
        <div className="org">DITO CME Holdings Corp.</div>
      </div>
      <div className="top-right">
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
  children,
}: {
  session: Session
  route: Route | null
  onLogout?: () => void
  children: ReactNode
}) {
  return (
    <div className="shell">
      <TopBar session={session} onLogout={onLogout} />
      <div className="shell-body">
        <nav className="shell-menu" aria-label="Main menu">
          {MENU.map((m, i) => (
            <a
              key={m.route}
              href={`#/${m.route}`}
              className={route === m.route ? 'active' : ''}
              aria-current={route === m.route ? 'page' : undefined}
            >
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              <span className="lbl">{m.label}</span>
            </a>
          ))}
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
