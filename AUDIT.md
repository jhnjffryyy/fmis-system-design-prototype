# Phase 0 Audit

Audit of the prototype against `Prototype_Finalization_Spec.md`. No app code was changed in this phase.

## 1. File list

| File | Role |
|---|---|
| `index.html` | Entry. Title is already correct. No favicon. |
| `vite.config.ts` | Vite + `vite-plugin-singlefile`, builds one offline `dist/index.html`. |
| `src/main.tsx` | Mounts `StoreProvider` and `App` in StrictMode. |
| `src/App.tsx` | Auth gate and hash route switch. |
| `src/router.ts` | Hash router, `#/dashboard`, `#/import`, `#/trend`, `#/recommendation`, `#/report`. |
| `src/store.tsx` | Shared state: session + one active dataset. Seeds the bundled CSV. Persists to `localStorage`. Holds demo accounts. |
| `src/lib/csv.ts` | CSV parser. |
| `src/lib/checks.ts` | File checks, date parsing, volume parsing. |
| `src/lib/analysis.ts` | All numbers: averages, high, low, change, OLS forecast, accuracy check. |
| `src/lib/recommend.ts` | The three rules. |
| `src/lib/format.ts` | Price, percent, date formatters. |
| `src/data/drivers.ts` | Five drivers, outside factors note, limitations, disclaimer. |
| `src/components/Shell.tsx` | Header, sidebar, page title, tag, icons. |
| `src/components/LineChart.tsx` | SVG line chart used by Dashboard and Report. |
| `src/screens/*.tsx` | Login, Dashboard, DataImport, Trend, Recommend, Report. Trend has its own 1068 line inline chart. |
| `src/styles.css` | All styles. 920 lines. |
| `src/test/lib.test.ts` | Vitest tests for csv, checks, analysis, recommend. |
| `scripts/generate-sample-csv.mjs` | Generates the bundled CSVs. |
| `src/data/sample/*.csv` | Bundled price file and error demo file. |

## 2. Data flow

1. `store.tsx` loads state from `localStorage`. If none, it parses the bundled CSV with `checkFile` and makes it the active dataset.
2. Each screen calls `analyze(state.dataset.rows)` in its own `useMemo`, then `recommend(a)`. So every screen reads one dataset and one calculation module.
3. Data Import runs `checkFile` on the chosen text and dispatches a new dataset on Continue. All screens re-render from it without a refresh.
4. Trend and Forecast computes its range tiles, chart geometry, and table inline in the screen.

## 3. Critical finding: the bundled price file is not the real file

`scripts/generate-sample-csv.mjs` line 1 says: "Generates SAMPLE daily price files for the demo. The values are made up". The bundled `src/data/sample/DITO-Historical-Data.csv` is synthetic. It has 927 rows and ends Oct 19, 2026. Its volume is random, 2 to 32 M.

The real Investing.com exports sit in `C:\Users\Meynard\Downloads`. I ran the existing, unchanged `checkFile` + `analyze` + `recommend` on each file:

| Item | Bundled synthetic | `DITO Historical Data (2).csv` | `DITO-Historical-Data.csv` | Spec prototype column | Spec paper column |
|---|---|---|---|---|---|
| Records | 927 | 930 | 928 | 930 | 928 |
| First date | 2023-01-03 | 2023-01-03 | 2023-01-03 | Jan 3, 2023 | Jan 3, 2023 |
| Last date | 2026-10-19 | 2026-10-21 | 2026-10-19 | Oct 21, 2026 | Oct 19, 2026 |
| Latest price | 0.59 | 0.59 | 0.59 | 0.59 | 0.59 |
| Daily change | -1.67 | 0.00 | -1.67 | 0.00% | -1.67% |
| 30 day average | 0.6000 | 0.5977 | 0.6027 | 0.60 | 0.60 |
| 90 day average | 0.6900 | 0.6913 | 0.6947 | 0.69 | 0.69 |
| First price | 2.81 | 2.81 | 2.81 | 2.81 | 2.81 |
| Total change | -79.00 | -79.00 | -79.00 | -79.0% | about -79% |
| Highest close | 3.69, 2023-10-19 | 3.69, 2023-10-19 | 3.69, 2023-10-19 | same | same |
| Lowest close | 0.54, 2026-10-08 | 0.54, 2026-10-08 | 0.54, 2026-10-08 | same | same |
| Average price | 1.8304 | 1.7054 | 1.7078 | 1.71 | not recorded |
| Forecast day 30 | 0.4926, -16.51% | 0.5120, -13.23% | 0.5215, -11.61% | 0.51, -13.2% | not recorded |
| Avg / largest diff | 0.0781 / 0.1289 | 0.0619 / 0.1098 | 0.0538 / 0.1019 | 0.06 / 0.11 | not recorded |
| MAPE | 13.39 | 10.54 | 9.15 | 10.5% | not recorded |
| Recommendation | Sell | Sell | Sell | Sell | Sell |

Result: `DITO Historical Data (2).csv` reproduces every value in the spec prototype column. `DITO-Historical-Data.csv` matches the paper column. The bundled file matches neither on average price, forecast, or accuracy.

Section 3 item 8 freezes "the bundled price data". The spec assumes the bundled file is the real 930 row file. It is not. This needs a group decision before Phase 1. See section 7.

Note: `DITO Historical Data.csv` and `(1)` in Downloads are the same 23 row real extract. They fail only the 120 record rule.

## 4. Hard coded values

| Where | Value | Requirement |
|---|---|---|
| `Trend.tsx` 938, 942 | `a.mae ?? 0.08`, `a.maxError ?? 0.15` fallbacks | FR-G4 |
| `drivers.ts` 14 | `'Daily prices Jan 2023 to Oct 2026 only'` | FR-P7 |
| `test/lib.test.ts` | 927, 2026-10-19, -1.67, 0.4924, 13.41 tied to synthetic data | NFR-4 |
| `Trend.tsx` | chart colors `#14396f #1e88e5 #8a94a3 #212121 #b9c7dc #e3e9f1 #eaf1fb` inline, not CSS variables | NFR-9, 7.5 |
| `analysis.ts`, `checks.ts`, `Trend.tsx` | 30, 90, 120, 30 day horizon, presets spread in code. No config file. No 5 MB limit at all. | NFR-9 |
| `analysis.ts` 212-215 | fake volume wave `8 + sin(i*0.17)*4` when Vol. is blank or zero | FR-T5, FR-I6 |

No hard coded price, average, date, count, or recommendation is shown on screen outside the items above. Dashboard, Report, and Recommendation read live values.

## 5. Known problems P1 to P16

| ID | Status | Finding |
|---|---|---|
| P1 | Confirmed | Sidebar fixed 232 px with only 900/640/480 px breakpoints; under 900 px it becomes a horizontal strip, not a drawer. `body` uses `min-height:100vh`, so the whole page scrolls, not only main. Fixed widths: Dashboard rec card 280 px, Trend side column 240 px, Trend chart box `height:480px`, Report print rec 280 px. Trend SVG `W = max(500, width)`, H fixed 480. LineChart H fixed 240 or 300. No 1440 px max width. |
| P2 | Partly | No SAMPLE DATA badge exists in current code. Login renders no header at all since commit c99484f. `Shell.tsx` 34 has `'(not yet)'`, but it is unreachable. FR-L5 needs a header on Login. |
| P3 | Partly | `fmtPctPlain` writes `percent` on Dashboard and Report. Confirmed. Stray dots not reproduced from code; LineChart draws hover dots per series plus markers. Needs a browser check. Dashboard also lacks the lowest close marker, FR-D3. |
| P4 | Confirmed | `DataImport.tsx` `CHECKS` lists 4. `checks.ts` applies a fifth, 120 records. |
| P5 | Partly | Problems already list with row numbers, up to 50. But the 120 rule only runs when no other problem exists, so the demo cannot show it. Missing column message does not name the column. No "previous file stays in use" line. No "first 10 then and N more". |
| P6 | Confirmed | `Use sample file` buttons carry a `Sample` badge. Trend Forecast and Accuracy cards also show `Sample`, and the tooltip shows `(Sample)`. |
| P7 | Partly | Code uses the real Vol. column when present; all bundled rows have volume. The wave is a fallback for blank volume, `analysis.ts` 212-215. The synthetic volume is also random. Both go away with the real file and removing the fallback. Volume already sits under the price panel with its own scale in the same SVG. |
| P8 | Confirmed | Day 30 label is drawn at `x=W-R, y=lastY-14` with no collision check against the price line, the latest price guide, or the Low label. |
| P9 | Confirmed | `.f7-cols` uses `align-items:start`. The side column holds four cards with Customize chart open by default, so it is taller than the chart card. |
| P10 | Not reproduced in code | Drivers use `display:flex` with a text span. Needs browser check at 1024 and 390 px. Why card only holds two lines and no What this means sentence, FR-R5. |
| P11 | Mostly not reproduced | Current Report already uses the real LineChart and live values. No sketch chart, no SAMPLE tag in code. The 927, Oct 19, and -1.67 come from the synthetic data, not from hard coding. Remaining gaps: label `Report date` not `Data as of`, `Total drop approximately 79%` not Total change, no forecast range on chart, no forecast value or accuracy line in the rec block, extra line `Forecast values are estimates, not guaranteed future prices.` The screenshot was likely taken from an older build. |
| P12 | Confirmed | `LIMITATIONS` exists in `drivers.ts` but the Report never renders it. Wording differs from FR-P7 and the date line is hard coded. |
| P13 | Not reproduced | No peso sign in Report code. |
| P14 | Confirmed | Parentheses in: `Role: (not yet)`, `Outside factors (notes only):` on two screens, Method line, demo accounts hint, `(found N)`, `(Sample)`, `Volume (M)`, `(sorted by ...)`, tooltip change `(...)`, `[` interval `]`. Also `High / low markers`, `Auto-fit`, `Next: ... →`. |
| P15 | Confirmed | Two card systems: `.wf-box` radius 4 and `.f7-card` radius 6, both with shadow. Uppercase mono eyebrows and `WHY`, `DRIVERS`, `KEY FINANCIAL DRIVERS`. Breadcrumb eyebrows like `01 · Dashboard`. Arrows on Go to buttons. Button labels `Upload and Check`, `View Report`, `Print Report`, `View Recommendation` differ from section 8. |
| P16 | Partly | The header shows the logged in role correctly. Both roles reach all screens. Only Data Import checks the role. This already matches matrix 4.9; the Controller read only view lacks the dataset summary and the exact message, FR-I10. |

## 6. Other findings

1. React hooks bug: `Trend.tsx` returns early at line 82, then calls `useMemo` at lines 136 to 432. This breaks the rules of hooks and can crash when the dataset changes from none to some. Must fix for NFR-5.
2. Session lives in `localStorage`, so it survives tab close. FR-L6 needs `sessionStorage` for the session. The dataset can stay persisted.
3. When no dataset exists, Dashboard, Trend, Recommendation, and Report `return null`, a blank screen. FR-E1 and FR-E2 missing.
4. Recommendation compares values rounded to 2 decimals, `recommend.ts` 30-33. Trend label also uses rounded values. Section 6 says compare unrounded values. Section 3 item 7 freezes the calculations. With the real 930 row file both ways give Sell and Downward, so no screen value changes. Needs a decision. See section 7.
5. Forecast method, for FR-T8: ordinary least squares straight line fitted to the last 90 closing prices, projected 30 trading days ahead. Forecast dates skip weekends only, not holidays. The 95% range uses a t value of 1.987.
6. Accuracy check, FR-T9: the same fit on closes 120 to 31 days back, compared with the real last 30 closes. Already correct.
7. Dates like `02/31/2026` pass the date check because only day 1 to 31 is checked. `Date.UTC` rolls over. Reported, FR-I5.
8. Error demo file is the synthetic 927 row file with 3 planted errors. FR-I9 wants about 23 rows with empty price, repeated date, out of order date, and zero price.
9. Login has no show and hide toggle, no required field message, and the error lacks `Please try again.`
10. Data Import has no CSV type check beyond `accept`, no size limit, no file size display.
11. Data table caps at 350 rows, no pagination, no jump to date, no Open, High, Low columns. Extra Up and Down filter not in spec.
12. Legend items do not toggle lines. Accuracy terms have no explanation. Customize chart is always open.
13. Range tile Change and Forecast percent use 1 decimal. FR-G5 wants 2.
14. Print uses landscape and 10 mm. FR-P9 wants A4 portrait and 12 mm.
15. Dead code: `StatisticalDiagnostics` and `stats` are only read by tests. CSS blocks `.side`, `.range-btns`, `.f7-row`, `.f7-boxes`, `.chart-legend`, `.sw`, `.f7-stat-*`, `.f7-math-block`, `.f7-diag-row`, `.f7-container`, `.f7-method-header` are unused.
16. IBM Plex fonts are named but not bundled. The app falls back to Segoe UI, so it still works offline.
17. No favicon. README is one line. AGENTS.md points to `../../storyboard-all-frames.md`, which does not exist; the file is in Downloads.
18. CSV text is rendered through React, so it is escaped. No `eval` or `dangerouslySetInnerHTML`. Nothing leaves the browser.

## 7. Decisions needed before Phase 1

1. Bundled data. Replace the synthetic file with the real `DITO Historical Data (2).csv`, 930 rows to Oct 21, 2026? It matches every spec reference value. The generator script and its tests would then be retired.
2. Rounded or unrounded comparison in the rules. Keep the current rounded comparison per frozen item 7, or switch to unrounded per section 6?
3. Error demo file. Build the 23 row demo from the real 23 row extract by planting the four errors?
