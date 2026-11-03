import { useEffect, useRef, useState, type ReactNode } from 'react'
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

const RAIL_KEY = 'stfa-menu-rail'

function useMatchMedia(query: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = (e: MediaQueryListEvent) => setM(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return m
}

export function LogoMark() {
  return (
    <span className="logo-mark" aria-hidden="true">
      <img src={logoUrl} alt="" />
    </span>
  )
}

function Hamburger() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 7 h16 M4 12 h16 M4 17 h16" />
    </svg>
  )
}

export function Shell({
  session,
  route,
  onLogout,
  noMenu = false,
  children,
}: {
  session: Session
  route: Route | null
  onLogout?: () => void
  /** header only, no sidebar (Login) */
  noMenu?: boolean
  children: ReactNode
}) {
  const wide = useMatchMedia('(min-width:1024px)')
  const [rail, setRail] = useState(
    () => sessionStorage.getItem(RAIL_KEY) === '1',
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)

  const toggleMenu = () => {
    if (wide) {
      setRail((r) => {
        sessionStorage.setItem(RAIL_KEY, r ? '0' : '1')
        return !r
      })
    } else {
      setDrawerOpen((o) => !o)
    }
  }

  // close the drawer when the screen changes
  useEffect(() => setDrawerOpen(false), [route])
  // drawer must not stay open when growing past the breakpoint
  useEffect(() => {
    if (wide) setDrawerOpen(false)
  }, [wide])

  // Esc closes the drawer; Tab cycles inside it while it is open
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        return
      }
      if (e.key !== 'Tab' || !navRef.current) return
      const focusables = Array.from(
        navRef.current.querySelectorAll<HTMLElement>('a, button, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled'))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [drawerOpen])

  // focus into drawer on open, back to the menu button on close
  const wasOpen = useRef(false)
  useEffect(() => {
    if (drawerOpen && !wasOpen.current) {
      navRef.current?.querySelector<HTMLElement>('a, [tabindex]')?.focus()
    } else if (!drawerOpen && wasOpen.current) {
      menuBtnRef.current?.focus()
    }
    wasOpen.current = drawerOpen
  }, [drawerOpen])

  const menuOpen = wide ? false : drawerOpen

  return (
    <div
      className={`shell${noMenu ? ' no-menu' : ''}${rail && wide ? ' rail' : ''}${menuOpen ? ' drawer-open' : ''}`}
    >
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <header className="shell-top">
        {!noMenu && <button
          ref={menuBtnRef}
          type="button"
          className="menu-btn"
          aria-label={wide ? (rail ? 'Expand menu' : 'Collapse menu') : menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={wide ? !rail : menuOpen}
          aria-controls="app-menu"
          onClick={toggleMenu}
        >
          <Hamburger />
        </button>}
        <LogoMark />
        <div className="names">
          <div className="sys">Stock Trend Forecasting and Advisory Module</div>
          <div className="org">DITO CME Holdings Corp.</div>
        </div>
        <div className="top-right">
          <span className="role">Role: {session.role ?? 'not signed in'}</span>
          {session.user && onLogout && (
            <button type="button" className="btn btn-ghost" onClick={onLogout}>
              Logout
            </button>
          )}
        </div>
      </header>
      <div className="shell-body">
        {!noMenu && <nav
          id="app-menu"
          ref={navRef}
          className="shell-menu"
          aria-label="Main menu"
        >
          {MENU.map((m, i) => {
            const num = String(i + 1).padStart(2, '0')
            return (
              <a
                key={m.route}
                href={`#/${m.route}`}
                className={route === m.route ? 'active' : ''}
                aria-current={route === m.route ? 'page' : undefined}
                title={m.label}
                aria-label={m.label}
              >
                <span className="idx">{num}</span>
                <span className={`lbl${rail && wide ? ' sr-only' : ''}`}>{m.label}</span>
              </a>
            )
          })}
        </nav>}
        {!noMenu && <button
          type="button"
          className="backdrop"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setDrawerOpen(false)}
        />}
        <main id="main" className="shell-content" tabIndex={-1}>
          <div className="page">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function ScreenTitle({ title, children }: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="screen-title">
      <div className="st-head">
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  )
}

export function Tag({ kind, text }: { kind: 'greentag' | 'sell' | 'wait' | 'hold' | 'demo'; text: string }) {
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

/** Shared empty state for screens that need a loaded dataset. */
export function EmptyState({ navigate }: { navigate: (r: Route) => void }) {
  return (
    <div className="card empty" role="status">
      <span>No price data yet. Open Data Import to load a file.</span>
      <button className="btn primary" onClick={() => navigate('import')}>
        Open Data Import
      </button>
    </div>
  )
}