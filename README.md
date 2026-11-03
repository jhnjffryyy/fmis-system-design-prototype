# Stock Trend Forecasting and Advisory Module

An offline, single-file prototype that loads a daily stock price file, charts the trend
with 30 and 90 day moving averages, projects a 30 day forecast from a straight-line
fit, checks the forecast's accuracy on the last 30 known prices, and gives a simple
fixed-rule recommendation (Sell, Wait and watch, or Hold). It runs entirely in the
browser from local CSV data. It uses public price data only, it is a prototype, and
it is not professional financial advice.

## Requirements

- Node.js 22 or newer for the scripts (tests, build, QA harness).
- No other tools; the QA harness uses only Node built-ins and a locally installed
  Microsoft Edge or Google Chrome.

## Run

```
npm install
npm run dev        # http://localhost:5173
npm run build      # produces dist/index.html
npm run test       # vitest, scoped to src/test
```

Open `dist/index.html` by double-clicking it. Everything (app, styles, data, logo)
is inlined into that one file, so it works offline from `file://`.

## Demo accounts

These are prototype demo accounts only; there is no real personal data.

- `analyst01` — Data Analyst (can upload files)
- `controller01` — Controller (read only)
- Password for both: `dito2026`

## Folder map

- `src/App.tsx` — hash router and screen composition
- `src/components/Shell.tsx` — app shell: header, sidebar, drawer, ScreenTitle, EmptyState
- `src/components/LineChart.tsx` — shared measured chart used on Dashboard and Report
- `src/screens/` — Login, Dashboard, DataImport, Trend, Recommend, Report
- `src/lib/` — csv, checks (validation), analysis (averages, forecast, accuracy),
  recommend (fixed rules), format, paginate
- `src/store.tsx` — app state, session/dataset persistence, shared analysis
- `src/data/prices/DITO-Historical-Data.csv` — the real bundled price file (do not edit)
- `src/data/demo/DITO-demo-with-errors.csv` — demo file with planted row errors
- `src/data/drivers.ts` — frozen drivers, outside factors, limitations, disclaimer
- `src/config.ts` — thresholds: windows, horizon, minimum records, max file size
- `src/test/` — vitest suite (reference values pin the bundled file)
- `scripts/` — build-demo-errors, qa-shots, contrast-check
- `docs/screenshots/` — QA screenshots and reports
- `docs/qa/` — QA flow results, fixture CSVs, generator
- `docs/print/` — printed report PDFs and preview

## Replacing the data file

1. Export daily prices from Investing.com as CSV with at least `Date` and `Price`
   columns (`Open`, `High`, `Low`, `Vol.`, `Change %` are used when present).
2. Replace `src/data/prices/DITO-Historical-Data.csv` with the new file. Do not
   round or reformat prices.
3. Run `npm run demo-file` to rebuild `src/data/demo/DITO-demo-with-errors.csv`
   from its first 23 rows.
4. Update the pinned reference values in `src/test/lib.test.ts` — the tests pin the
   bundled file's numbers on purpose, so they fail for a different file until the
   expected values are refreshed.
5. `npm run test`, then `npm run build`.

## Scripts

- `npm run test` — vitest suite in `src/test`
- `npm run build` — typecheck + single-file production build
- `npm run demo-file` — regenerate the demo file with planted errors
- `npm run qa` — CDP screenshots + overflow/console checks at 7 viewport sizes
  - `--role controller` — run as the Controller account
  - `--sizes 1366x768,...` — narrow viewport list
  - `--flows` — demo-file flows + per-screen text dumps
  - `--print` — report PDFs for both roles + print preview shot
  - `--keyboard` — Tab-walk, verifies every focus has a visible indicator
  - `--qa-flows` — full requirement walk (auth, uploads, decisions, consistency,
    volume, perf, offline) writing `docs/qa/qa-flows.json`
- `npm run contrast` — WCAG contrast audit of every token pair used

## Configuration

`src/config.ts` holds all thresholds: `SHORT_WINDOW` 30, `LONG_WINDOW` 90,
`FIT_WINDOW` 90, `FORECAST_HORIZON` 30, `MIN_RECORDS` 120, `MAX_FILE_BYTES` 5 MB.
