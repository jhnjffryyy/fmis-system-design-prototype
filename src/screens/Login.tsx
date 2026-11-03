import { useState } from 'react'
import { ACCOUNTS, useStore } from '../store'

export function Login({ onLogin }: { onLogin: () => void }) {
  const { dispatch } = useStore()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [fieldErr, setFieldErr] = useState<{ u?: boolean; p?: boolean }>({})

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const missing = { u: !user.trim(), p: !pass }
    if (missing.u || missing.p) {
      setFieldErr(missing)
      setError('')
      return
    }
    const account = ACCOUNTS.find((a) => a.user === user.trim() && a.pass === pass)
    if (account) {
      dispatch({ type: 'login', user: account.user, role: account.role })
      onLogin()
    } else {
      setFieldErr({})
      setError('Wrong username or password. Please try again.')
    }
  }

  return (
    <div className="login-center">
      <form className="login-card card" onSubmit={submit} noValidate>
        <div className="login-head">
          <h4>Login</h4>
          <div className="sub">Check the user and role</div>
        </div>
        <div className="login-body">
          <div className="fld">
            <label htmlFor="u">Username</label>
            <input
              id="u"
              className="in"
              autoComplete="username"
              value={user}
              onChange={(e) => {
                setUser(e.target.value)
                setFieldErr((f) => ({ ...f, u: false }))
              }}
              aria-invalid={fieldErr.u || undefined}
              aria-describedby={fieldErr.u ? 'u-err' : undefined}
              autoFocus
            />
            {fieldErr.u && (
              <div className="err-inline" id="u-err">This field is required.</div>
            )}
          </div>
          <div className="fld">
            <label htmlFor="p">Password</label>
            <div className="pass-wrap">
              <input
                id="p"
                className="in"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                value={pass}
                onChange={(e) => {
                  setPass(e.target.value)
                  setFieldErr((f) => ({ ...f, p: false }))
                }}
                aria-invalid={fieldErr.p || undefined}
                aria-describedby={fieldErr.p ? 'p-err' : undefined}
              />
              <button
                type="button"
                className="pass-toggle"
                aria-pressed={showPass}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                onClick={() => setShowPass((s) => !s)}
              >
                {showPass ? (
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12 s3.5 -6 10 -6 10 6 10 6 -3.5 6 -10 6 -10 -6 -10 -6 Z" />
                    <path d="M4 4 L20 20" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12 s3.5 -6 10 -6 10 6 10 6 -3.5 6 -10 6 -10 -6 -10 -6 Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErr.p && (
              <div className="err-inline" id="p-err">This field is required.</div>
            )}
          </div>
          <button className="btn primary" type="submit" style={{ width: '100%' }}>
            Login
          </button>
          <div aria-live="polite" aria-atomic="true" className="err-region">
            {error && <div className="err-box">{error}</div>}
          </div>
          <div className="roleline">
            Demo accounts for the prototype: analyst01 is the Data Analyst, controller01 is the
            Controller. Password for both: dito2026.
          </div>
        </div>
      </form>
    </div>
  )
}
