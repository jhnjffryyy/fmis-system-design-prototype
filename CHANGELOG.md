# Changelog

All changes are grouped by requirement ID from the finalization spec.

## Data and foundations

- FR-G5: real DITO price file bundled byte-for-byte at `src/data/prices/DITO-Historical-Data.csv` (MD5-verified); synthetic sample files and generator removed.
- FR-G5: `src/config.ts` centralizes thresholds (30/90-day windows, 90-day fit, 30-day horizon, 120 records, 5 MB).
- FR-G6: session lives in `sessionStorage`, dataset in `localStorage` with new keys; corrupt data reseeds the bundled file.
- FR-G7: analysis and recommendation computed once in the provider (`useAnalysis()`); all screens update immediately after a new dataset with no reload.
- FR-I4/FR-I5: exact validation messages; missing columns named; impossible calendar dates rejected; 120-record rule always runs; `checkFileSize` exported; blank volumes become `null` not fake data.
- FR-I6: demo file with exactly four planted errors generated from the real file (`npm run demo-file`).

## Rules and calculations

- Section 6: trend and recommendation compare unrounded values; equality yields Wait and watch.
- Section 6: dead diagnostics removed (`stats`, `regime`, `crossoverGap`, `olsR2`, `drop`); `avgPrice` and `totalChange` added; forecast, band, MAE, max error and MAPE math unchanged and pinned by tests.
- FR-G5: `fmtPct` always signed with two decimals (`0.00%` unsigned at zero); `fmtPctAbs` added for MAPE.

## Shell and layout (7.1-7.3)

- FR-G3/FR-L5: Login renders inside the shell with `Role: not signed in`, no Logout. Before login no sidebar is shown; Login is header only, per group request (`Shell` `noMenu`).
- FR-G2: fixed 60px header, fixed 232px sidebar on desktop, collapsible 64px rail (sessionStorage), off-canvas drawer under 1024px with backdrop, Esc close, focus trap and focus restore.
- 7.1: full-height `.shell` grid; only `<main>` scrolls; content centered at max-width 1440px; no fixed pixel container widths.
- 7.3: breakpoints at 1280 / 1024 / 768 / 420 drive Trend side columns, tile grids, drawer, single-column and table wrappers.
- Sidebar keeps step numbers 01-05 with `aria-current="page"` on the active item; `ScreenTitle` step eyebrow removed; skip link added.

## Design tokens (7.2)

- CSS variables for role colors, chart layer colors, spacing scale, two radii and one shadow; cards are border-only, one `.card` class replaces `.wf-box` and `.f7-card`.
- NFR-7 contrast tokens added: `--wait-text`, `--line-ctl`, `--err-text`; `--c-volume` darkened to pass 3:1; focus ring is brand on light surfaces and white in the header.
- Dead CSS removed after grep checks; no gradients, no entrance animations, transitions limited to buttons/links/drawer and disabled under `prefers-reduced-motion`.

## Charts (7.4)

- LineChart and the Trend SVG draw in measured pixels (`viewBox="0 0 W H"`), resize with a debounced ResizeObserver, and re-measure synchronously before/after print.
- Chart height `clamp(260px, 45vh, 560px)`; axis labels thin to ~90px/50px; text at least 11px; `Close, Php` y-axis title on all charts.
- Shared layer styles: price solid, 30d solid sky blue, 90d dotted `2 3`, forecast dashed `5 4`, matching static legend on the Report.
- P3/FR-D3: Dashboard area chart markers only for High, Low, Latest; hover circle only on the price series; tooltip shows date and close.
- FR-T5: volume in its own short panel (~18%, min 40px) with its own scale and `Vol., M` label; null days skipped.
- FR-T6/P8: Day 30 label collides-tested against the latest guide, price points and High/Low/year labels; hidden when colliding or under 520px; year labels lose to the `Next 30 days` zone label.
- All SVG text carries a white halo; tooltips measured and clamped inside the chart.

## Screens (section 4)

- FR-L1-L6: password show/hide toggle, per-field `This field is required.` errors, wrong-credentials message, single demo-accounts hint, session persists across reload.
- FR-D1-D6: tiles Latest price / Daily change / 30d / 90d with red/green triangles and neutral zero; Last updated; Go to row without numbers or arrows.
- FR-I1-I11: five exact checks; `.csv` extension and 5 MB rejection with messages; `name, size` mono line; FileReader error message; demo shortcuts run the check immediately with DEMO tags; failed card lists up to 10 problems plus `and N more` and the previous-file line; passed card dispatches the dataset at once and continues via `Continue to Trend and Forecast`; Controller gets read-only controls and an active-dataset summary.
- FR-T1-T12: exact method line; tabs Price chart / Data table with roving tabindex and arrow keys; range presets recompute six stat tiles; legend items toggle layers (`aria-pressed`); Forecast card with `against the latest price` and the real method sentence; Accuracy card with explainer text and info tooltips; full-column data table (9 columns, `aria-sort`, 25 rows per page, jump-to-date with highlight); Customize From/To validation, Linear/Log scale, Auto fit, Reset view; `Next ->` to the Recommendation.
- FR-R1-R8: loud result card; Why card with gray crosses; `What this means` sentences per decision; Drivers numbered list that wraps at small widths; exact outside-factors note and disclaimer; `View report ->`.
- FR-P1-P8/P10: live header `Data as of` + `Print report`; tiles and five-item strip; chart with forecast band and Predictive tag; Prescriptive rec block with reasons, forecast and accuracy lines; Drivers plus outside factors; Notes and limitations built from live dates; `CFO: view only access.`; leftover italic quote removed.
- FR-E1: shared EmptyState on all data screens; FR-E2: `Checking the file...` placeholder; FR-E3: errors say what and how to fix.
- P9: chart card stretches to the side column; Customize closed by default at every width.

## Print (FR-P9, 7.8)

- A4 portrait @page 12mm; header, sidebar, drawer, buttons, Go to and the options strip hidden; main un-scrolled; `print-color-adjust:exact`; `break-inside:avoid` on cards/charts/tables; compact 9pt layout (tiles 4-across, strip 5-across, chart then rec block); both roles print to a 2-page PDF with no split blocks; report chart legend keeps lines readable in black and white.

## Accessibility (NFR-7)

- `scripts/contrast-check.mjs` audits every text/graphic token pair (30 pairs, all pass; decorative exceptions listed).
- Visible 2px focus ring on every interactive element; drawer focus trap; tabs with proper roles and arrow keys; sort headers are real buttons; all inputs labeled, errors linked via `aria-describedby`, result cards use `role=status`/`alert`.
- Charts expose `role=img` + `aria-label` and visually hidden text summaries; the Trend summary points to the Data table tab; color is never the only signal.

## QA and docs

- `scripts/qa-shots.mjs`: screenshots + hScroll/console/overflow across 7 sizes, `--role`, `--sizes`, `--flows`, `--print` (PDFs + preview), `--keyboard` (focus indicator walk), `--qa-flows` (auth, uploads, decisions, consistency, volume, perf, offline, 24 checks) writing `docs/qa/qa-flows.json`.
- QA fixtures under `docs/qa/files/` (reversed/shuffled derived from the real file; synthetic hold/wait/sell series, not market data) with generator and README.
- 42 vitest cases pin reference values, fixture outcomes and a <1000 ms recompute bound.
