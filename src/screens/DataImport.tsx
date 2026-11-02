import { useRef, useState } from 'react'
import { SAMPLE_CSV, SAMPLE_ERRORS_CSV, useStore } from '../store'
import { checkFile, type CheckResult } from '../lib/checks'
import { fmtDate } from '../lib/format'
import { Shell, ScreenTitle, CheckIcon, CrossIcon } from '../components/Shell'
import type { Route } from '../router'

type Phase =
  | { kind: 'pick'; fileName: string | null; text: string | null; result?: undefined }
  | { kind: 'failed'; fileName: string; result: CheckResult }
  | { kind: 'passed'; fileName: string; result: CheckResult }

const CHECKS = [
  'No price is empty',
  'No date is repeated',
  'Dates are in order',
  'All prices are above zero',
]

export function DataImport({ navigate }: { navigate: (r: Route) => void }) {
  const { state, dispatch } = useStore()
  const [phase, setPhase] = useState<Phase>({ kind: 'pick', fileName: null, text: null })
  const [reading, setReading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const readOnly = state.session.role === 'Controller'

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setReading(true)
    const rd = new FileReader()
    rd.onload = () => {
      setReading(false)
      setPhase({ kind: 'pick', fileName: f.name, text: String(rd.result) })
    }
    rd.readAsText(f)
  }

  const useSample = (errors: boolean) => {
    setPhase({
      kind: 'pick',
      fileName: errors ? 'DITO-Historical-Data-with-errors.csv' : 'DITO-Historical-Data.csv',
      text: errors ? SAMPLE_ERRORS_CSV : SAMPLE_CSV,
    })
  }

  const upload = () => {
    if (phase.kind !== 'pick' || !phase.text || !phase.fileName) return
    const result = checkFile(phase.text)
    setPhase(result.ok
      ? { kind: 'passed', fileName: phase.fileName, result }
      : { kind: 'failed', fileName: phase.fileName, result })
  }

  const reset = () => {
    setPhase({ kind: 'pick', fileName: null, text: null })
    if (inputRef.current) inputRef.current.value = ''
  }

  const saveAndGo = () => {
    if (phase.kind !== 'passed') return
    dispatch({
      type: 'dataset',
      dataset: {
        fileName: phase.fileName,
        source: phase.fileName === 'DITO-Historical-Data.csv' ? 'sample' : 'uploaded',
        importedAt: new Date().toISOString(),
        rows: phase.result.rows,
      },
    })
    navigate('trend')
  }

  return (
    <Shell
      session={state.session}
      route="import"
      onLogout={() => dispatch({ type: 'logout' })}
    >
      <ScreenTitle step="02 · Data Import" title="Data Import" />

      {phase.kind === 'pick' && (
        <>
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
              {reading ? 'Reading file…' : phase.fileName ?? 'No file chosen'}
            </span>
          </div>
          <div className="import-samples">
            <button className="btn btn-text" onClick={() => useSample(false)} disabled={readOnly}>
              Use sample file <span className="sample">Sample</span>
            </button>
            <button className="btn btn-text" onClick={() => useSample(true)} disabled={readOnly}>
              Use sample file with errors <span className="sample">Sample</span>
            </button>
          </div>
          {phase.text && phase.fileName && (
            <PreviewLine text={phase.text} />
          )}
          <div className="wf-box checks-box">
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
            {reading ? 'Reading file…' : 'Upload and Check'}
          </button>
          {readOnly && (
            <div className="note-row">
              Only the Data Analyst can upload and check the price file. The Controller reviews the
              results and the report.
            </div>
          )}
        </>
      )}

      {phase.kind === 'failed' && (
        <>
          <div className="result fail" role="alert">
            <h4>
              <CrossIcon /> File check failed
            </h4>
            <ul>
              {phase.result.problems.slice(0, 50).map((p) => (
                <li key={p.row + p.message}>
                  <span className="x">
                    <CrossIcon />
                  </span>
                  {p.message}
                </li>
              ))}
            </ul>
            {phase.result.problems.length > 50 && (
              <div className="sum">… and {phase.result.problems.length - 50} more</div>
            )}
          </div>
          <button className="btn" onClick={reset}>
            Fix the file and upload again
          </button>
        </>
      )}

      {phase.kind === 'passed' && (
        <>
          <div className="result pass" role="status">
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
            <button className="btn primary" onClick={saveAndGo}>
              Continue to Trend and Forecast
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12 h14 M13 6 l6 6 -6 6" />
              </svg>
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
