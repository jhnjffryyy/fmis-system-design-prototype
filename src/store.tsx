import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { ReactNode } from 'react'
import { checkFile, type PricePoint } from './lib/checks'
import { analyze, type Analysis } from './lib/analysis'
import { recommend, type Recommendation } from './lib/recommend'
import bundledCsv from './data/prices/DITO-Historical-Data.csv?raw'
import demoErrorsCsv from './data/demo/DITO-demo-with-errors.csv?raw'

export const BUNDLED_CSV = bundledCsv
export const DEMO_ERRORS_CSV = demoErrorsCsv

export interface Session {
  user: string | null
  role: string | null
}

export interface Dataset {
  fileName: string
  source: 'bundled' | 'uploaded'
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

const SESSION_KEY = 'stfa-session-v2'
const DATASET_KEY = 'stfa-dataset-v2'

function seedDataset(): Dataset {
  const res = checkFile(bundledCsv)
  return {
    fileName: 'DITO-Historical-Data.csv',
    source: 'bundled',
    importedAt: new Date().toISOString(),
    rows: res.rows,
  }
}

function loadSession(): Session {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Session
      if (s && 'user' in s && 'role' in s) return s
    }
  } catch {
    /* corrupted session -> logged out */
  }
  return { user: null, role: null }
}

function loadDataset(): Dataset {
  try {
    const raw = localStorage.getItem(DATASET_KEY)
    if (raw) {
      const d = JSON.parse(raw) as Dataset
      if (d && Array.isArray(d.rows) && d.rows.length) {
        d.rows = d.rows.map((r) => ({ ...r, t: Date.parse(`${r.iso}T00:00:00Z`) }))
        return d
      }
    }
  } catch {
    /* corrupted dataset -> reseed */
  }
  return seedDataset()
}

function load(): State {
  return { session: loadSession(), dataset: loadDataset() }
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

interface StoreValue {
  state: State
  dispatch: React.Dispatch<Action>
  a: Analysis | null
  rec: Recommendation | null
}

const StoreCtx = createContext<StoreValue>({
  state: { session: { user: null, role: null }, dataset: null },
  dispatch: () => {},
  a: null,
  rec: null,
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load)

  const a = useMemo(() => (state.dataset ? analyze(state.dataset.rows) : null), [state.dataset])
  const rec = useMemo(() => (a ? recommend(a) : null), [a])

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session))
    } catch {
      /* storage unavailable */
    }
  }, [state.session])
  useEffect(() => {
    try {
      localStorage.setItem(DATASET_KEY, JSON.stringify(state.dataset))
    } catch {
      /* storage full or unavailable */
    }
  }, [state.dataset])

  const value = useMemo(() => ({ state, dispatch, a, rec }), [state, a, rec])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export const useStore = () => useContext(StoreCtx)

/** shared analysis + recommendation for the active dataset */
export const useAnalysis = () => {
  const { a, rec } = useContext(StoreCtx)
  return { a, rec }
}

export const ACCOUNTS = [
  { user: 'analyst01', pass: 'dito2026', role: 'Data Analyst' },
  { user: 'controller01', pass: 'dito2026', role: 'Controller' },
]
