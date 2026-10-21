import { useEffect, useState } from 'react'

export type Route =
  | 'login'
  | 'dashboard'
  | 'import'
  | 'trend'
  | 'recommendation'
  | 'report'

const ROUTES: Route[] = ['login', 'dashboard', 'import', 'trend', 'recommendation', 'report']

function current(): Route {
  const h = location.hash.replace(/^#\/?/, '')
  return (ROUTES as string[]).includes(h) ? (h as Route) : 'dashboard'
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(current)
  useEffect(() => {
    const onHash = () => setRoute(current())
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])
  const navigate = (r: Route) => {
    location.hash = `/${r}`
  }
  return [route, navigate]
}
