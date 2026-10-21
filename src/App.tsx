import { useEffect } from 'react'
import { useStore } from './store'
import { useHashRoute } from './router'
import { Login } from './screens/Login'
import { Dashboard } from './screens/Dashboard'
import { DataImport } from './screens/DataImport'
import { Trend } from './screens/Trend'
import { Recommend } from './screens/Recommend'
import { Report } from './screens/Report'

export default function App() {
  const { state } = useStore()
  const [route, navigate] = useHashRoute()
  const authed = !!state.session.user

  useEffect(() => {
    if (!authed && route !== 'login') navigate('login')
    if (authed && route === 'login') navigate('dashboard')
  }, [authed, route])

  if (!authed) return <Login onLogin={() => navigate('dashboard')} />

  switch (route) {
    case 'import':
      return <DataImport navigate={navigate} />
    case 'trend':
      return <Trend navigate={navigate} />
    case 'recommendation':
      return <Recommend navigate={navigate} />
    case 'report':
      return <Report />
    default:
      return <Dashboard navigate={navigate} />
  }
}
