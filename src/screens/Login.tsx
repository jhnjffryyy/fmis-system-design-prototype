import { useState } from 'react'
import { ACCOUNTS, useStore } from '../store'

export function Login({ onLogin }: { onLogin: () => void }) {
  const { dispatch } = useStore()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const account = ACCOUNTS.find((a) => a.user === user.trim() && a.pass === pass)
    if (account) {
      dispatch({ type: 'login', user: account.user, role: account.role })
      onLogin()
    } else {
      setError('Wrong username or password')
    }
  }

  return (
    <div className="login-center">
      <form className="login-card wf-box" onSubmit={submit}>
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
              onChange={(e) => setUser(e.target.value)}
              autoFocus
            />
          </div>
          <div className="fld">
            <label htmlFor="p">Password</label>
            <input
              id="p"
              className="in"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </div>
          <button className="btn primary" type="submit" style={{ width: '100%' }}>
            Login
          </button>
          <div aria-live="polite" aria-atomic="true" className="err-region">
            {error && <div className="err-box">{error}</div>}
          </div>
          <div className="roleline">
            After login: Role: Data Analyst or Controller
          </div>
          <div className="roleline">
            Demo accounts: <b className="mono">analyst01</b> (Data Analyst),{' '}
            <b className="mono">controller01</b> (Controller)
          </div>
          <div className="roleline">
            Password: <b className="mono">dito2026</b>
          </div>
        </div>
      </form>
    </div>
  )
}
