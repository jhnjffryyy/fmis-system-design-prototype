import { createContext, useContext, useEffect, useReducer } from 'react'
import type { ReactNode } from 'react'
import { checkFile, type PricePoint } from './lib/checks'
import sampleCsv from './data/sample/DITO-Historical-Data.csv?raw'

export interface Session {
  user: string | null
  role: string | null
}

export interface Dataset {
  fileName: string
  source: 'sample' | 'uploaded'
  importedAt: string
  rows: PricePoint[]
}

interface State {
  session: Session
  dataset: Dataset | null
}

type Action =
  | { type: 'login'; user: string; role: string }
  | { type: 'logout' }
  | { type: 'dataset'; dataset: Dataset }

const KEY = 'stfa-state-v1'

function seedDataset(): Dataset {
  const res = checkFile(sampleCsv)
  return {
    fileName: 'DITO-Historical-Data.csv',
    source: 'sample',
    importedAt: new Date().toISOString(),
    rows: res.rows,
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as State
      if (s && s.dataset && Array.isArray(s.dataset.rows)) {
        s.dataset.rows = s.dataset.rows.map((r) => ({
          ...r,
          t: Date.parse(`${r.iso}T00:00:00Z`),
        }))
        return s
      }
    }
  } catch {
    /* corrupted state -> reseed */
  }
  return { session: { user: null, role: null }, dataset: seedDataset() }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'login':
      return { ...state, session: { user: action.user, role: action.role } }
    case 'logout':
      return { ...state, session: { user: null, role: null } }
    case 'dataset':
      return { ...state, dataset: action.dataset }
  }
}

const StoreCtx = createContext<{ state: State; dispatch: React.Dispatch<Action> }>({
  state: { session: { user: null, role: null }, dataset: null },
  dispatch: () => {},
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* storage full or unavailable */
    }
  }, [state])
  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>
}

export const useStore = () => useContext(StoreCtx)

export const ACCOUNTS = [
  { user: 'analyst01', pass: 'dito2026', role: 'Data Analyst' },
  { user: 'controller01', pass: 'dito2026', role: 'Controller' },
]
export const SAMPLE_CSV = sampleCsv
export { default as SAMPLE_ERRORS_CSV } from './data/sample/DITO-Historical-Data-with-errors.csv?raw'
