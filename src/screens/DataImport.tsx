import { useRef, useState } from 'react'
import { BUNDLED_CSV, DEMO_ERRORS_CSV, useStore } from '../store'
import { checkFile, checkFileSize, type CheckResult } from '../lib/checks'
import { fmtDate } from '../lib/format'
import { MIN_RECORDS } from '../config'
import { Shell, ScreenTitle, Tag, CheckIcon, CrossIcon } from '../components/Shell'
import type { Route } from '../router'

type Phase =
  | { kind: 'pick'; fileName: string | null; text: string | null; fileSize?: number; fileErr?: string }
  | { kind: 'failed'; fileName: string; result: CheckResult }
  | { kind: 'passed'; fileName: string; result: CheckResult }

const CHECKS = [
  'No price is empty',
  'No date is repeated',
  'Dates are in order',
  'All prices are above zero',
  `File has at least ${MIN_RECORDS} records`,
]

const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`

export function DataImport({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const [phase, setPhase] = useState<Phase>({ kind: 'pick', fileName: null, text: null })
  const [reading, setReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const readOnly = state.session.role === 'Controller'
  const ds = state.dataset

  const runCheck = (fileName: string, text: string) => {
    const result = checkFile(text)
    if (result.ok) {
      // accepted file becomes the active dataset right away
      dispatch({
        type: 'dataset',
        dataset: {
          fileName,
          source: fileName === 'DITO-Historical-Data.csv' ? 'bundled' : 'uploaded',
          importedAt: new Date().toISOString(),
          rows: result.rows,
        },
      })
      setPhase({ kind: 'passed', fileName, result })
    } else {
      setPhase({ kind: 'failed', fileName, result })
    }
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!/\.csv$/i.test(f.name)) {
      setPhase({
        kind: 'pick',
        fileName: null,
        text: null,
        fileErr: 'This file is not a CSV. Choose a file that ends in .csv.',
      })
      return
    }
    const sizeErr = checkFileSize(f.size)
    if (sizeErr) {
      setPhase({ kind: 'pick', fileName: null, text: null, fileErr: sizeErr })
      return
    }
    setReading(true)
    const rd = new FileReader()
    rd.onload = () => {
      setReading(false)
      setPhase({ kind: 'pick', fileName: f.name, text: String(rd.result), fileSize: f.size })
    }
    rd.onerror = () => {
      setReading(false)
      setPhase({
        kind: 'pick',
        fileName: null,
        text: null,
        fileErr: 'The file could not be read. Choose the file again.',
      })
    }
    rd.readAsText(f)
  }

  const useDemo = (errors: boolean) => {
    runCheck(errors ? 'DITO-demo-with-errors.csv' : 'DITO-Historical-Data.csv',
      errors ? DEMO_ERRORS_CSV : BUNDLED_CSV)
  }

  const upload = () => {
    if (phase.kind !== 'pick' || !phase.text || !phase.fileName) return
    runCheck(phase.fileName, phase.text)
  }

  const reset = () => {
    setPhase({ kind: 'pick', fileName: null, text: null })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <Shell
      session={state.session}
      route="import"
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle title="Data Import" />

      {phase.kind === 'pick' && (
        <>
          {readOnly && ds && (
            <div className="card checks-box">
              <b>Active dataset</b>
              <div className="sum">
                {ds.fileName}, {ds.rows.length} records, {fmtDate(ds.rows[0].iso)} to{' '}
                {fmtDate(ds.rows[ds.rows.length - 1].iso)}
              </div>
            </div>
          )}
          <div className={`drop-strip${readOnly ? ' disabled' : ''}`}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3 H6 a1 1 0 0 0 -1 1 v16 a1 1 0 0 0 1 1 h12 a1 1 0 0 0 1 -1 V8 Z" />
              <path d="M14 3 v5 h5" />
            </svg>
            <span>Daily price file</span>
            <label className={`btn${readOnly ? ' disabled' : ''}`}>
              Choose file
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={onFile}
                disabled={readOnly}
                hidden
              />
            </label>
            <span className="mut mono">
              {reading ? 'Reading file…' : phase.fileName ? phase.fileName + (phase.fileSize != null ? ', ' + fmtSize(phase.fileSize) : '') : 'No file chosen'}
            </span>
          </div>
          <div className="import-demos">
            <button className="btn btn-text" onClick={() => useDemo(false)} disabled={readOnly}>
              Use demo file <Tag kind="demo" text="DEMO" />
            </button>
            <button className="btn btn-text" onClick={() => useDemo(true)} disabled={readOnly}>
              Use demo file with errors <Tag kind="demo" text="DEMO" />
            </button>
          </div>
          {phase.kind === 'pick' && phase.fileErr && (
            <div className="err-box" role="alert">{phase.fileErr}</div>
          )}
          {reading && <div className="skeleton" role="status">Checking the file…</div>}
          {phase.text && phase.fileName && !reading && (
            <PreviewLine text={phase.text} />
          )}
          <div className="card checks-box">
            <b>The system will check that:</b>
            <ol>
              {CHECKS.map((c, i) => (
                <li key={c}>
                  <span className="idx">{i + 1}</span> {c}
                </li>
              ))}
            </ol>
          </div>
          <button
            className="btn primary"
            onClick={upload}
            disabled={!phase.text || reading || readOnly}
          >
            {reading ? 'Reading file…' : 'Upload and check'}
          </button>
          {readOnly && (
            <div className="note-row">
              Only the Data Analyst can upload files.
            </div>
          )}
        </>
      )}

      {phase.kind === 'failed' && (
        <>
          <div className="card result fail" role="alert">
            <h4>
              <CrossIcon /> File check failed
            </h4>
            <ul>
              {phase.result.problems.slice(0, 10).map((p) => (
                <li key={p.row + p.message}>
                  <span className="x">
                    <CrossIcon />
                  </span>
                  {p.message}
                </li>
              ))}
            </ul>
            {phase.result.problems.length > 10 && (
              <div className="sum">… and {phase.result.problems.length - 10} more</div>
            )}
            {ds && (
              <div className="sub" style={{ marginTop: '8px' }}>
                The previous valid file stays in use: {ds.fileName}, {ds.rows.length} records
                to {fmtDate(ds.rows[ds.rows.length - 1].iso)}.
              </div>
            )}
          </div>
          <button className="btn" onClick={reset}>
            Fix the file and upload again
          </button>
        </>
      )}

      {phase.kind === 'passed' && (
        <>
          <div className="card result pass" role="status">
            <h4>
              <CheckIcon /> File check passed
            </h4>
            <ul>
              {CHECKS.map((c) => (
                <li key={c}>
                  <span className="ck">
                    <CheckIcon />
                  </span>
                  {c}
                </li>
              ))}
            </ul>
            <div className="sum">
              {phase.result.records} records, {fmtDate(phase.result.firstDate!)} to{' '}
              {fmtDate(phase.result.lastDate!)}, no missing values, no repeated dates
            </div>
          </div>
          <div className="btn-row">
            <button className="btn" onClick={reset}>
              Fix the file and upload again
            </button>
            <button className="btn primary" onClick={() => navigate('trend')}>
              Continue to Trend and Forecast →
            </button>
          </div>
        </>
      )}
    </Shell>
  )
}

function PreviewLine({ text }: { text: string }) {
  const res = checkFile(text)
  if (!res.firstDate || !res.lastDate) return null
  return (
    <div className="mut preview mono">
      Preview: <b>{res.records} rows</b>, {fmtDate(res.firstDate)} to {fmtDate(res.lastDate)}
    </div>
  )
}
