# Final Report

Prototype finalization for the Stock Trend Forecasting and Advisory Module, DITO CME Holdings Corp. Read this with `AUDIT.md`, which holds the Phase 0 findings, and `CHANGELOG.md`, which lists every change by requirement ID. Evidence lives in `docs/`.

No library was added. The stack is still React 19, Vite, and TypeScript with no router, chart, or UI library. The QA and contrast scripts use only Node built-ins plus a locally installed Edge or Chrome.

## Decisions made with the group owner

| Topic | Decision | Why |
|---|---|---|
| Bundled data | Replaced the synthetic file with the real `DITO Historical Data (2).csv`, byte for byte, MD5 4A39E31EB57721D1CC052BF974777C7D. Retired the generator script. | The old bundled file was made up by `scripts/generate-sample-csv.mjs`. The real file reproduces every value in section 6. This changes frozen item 8, and the group owner approved it. |
| Rule comparison | Recommendation and trend label now compare unrounded values. | Section 6 asks for this. It conflicted with frozen item 7. With the real data the results are still Sell and Downward. |
| Demo errors file | Built from the first 23 real rows with four planted errors. Script: `npm run demo-file`. | FR-I9. No prices were invented. |

## Open decision defaults used, section 9

1. Data cut off: the bundled file runs through Oct 21, 2026. No date or count is hard coded.
2. Sixth driver for weak liquidity: not added.
3. Controller upload: no, read only.
4. Percent: the percent sign is used everywhere.

## Reference values, section 6

All values match on the bundled file: 930 records, Jan 3, 2023 to Oct 21, 2026, latest 0.59, daily change 0.00%, 30 day average 0.60, 90 day average 0.69, first 2.81, total change -79.0%, high 3.69 on Oct 19, 2023, low 0.54 on Oct 8, 2026, average 1.71, forecast 0.51 at -13.2%, average difference 0.06, largest difference 0.11, MAPE 10.5%, Sell. The first 928 rows reproduce the paper column: -1.67%, 0.60, 0.69. Tests: `src/test/lib.test.ts`.

## Requirement status

### Global
| ID | Status | Reason |
|---|---|---|
| FR-G1 | Done | Logged out, `#/report` shows Login. Evidence: `docs/qa/qa-flows.json`. |
| FR-G2 | Done | Header shows the system name, the company, the role, and Logout. Back after logout stays on Login. |
| FR-G3 | Partly done | Before login no sidebar is shown; Login is header only, per group request. |
| FR-G4 | Done | One shared analysis in `store.tsx`. The fake 0.08 and 0.15 fallbacks and the synthetic volume wave are gone. |
| FR-G5 | Done | Shared `fmtPrice`, `fmtPct`, and `fmtDate`. Axis titles read `Close, Php`. |
| FR-G6 | Done | Matrix 4.9 is enforced. Only Data Import upload is limited to the Data Analyst. |
| FR-G7 | Done | A dataset is applied as soon as the check passes. QA shows Dashboard and Report change without a reload. |
| FR-G8 | Done | Tab title is correct. The favicon is the D logo, inlined. |

### Login
| ID | Status | Reason |
|---|---|---|
| FR-L1 | Done | Enter submits. Show and hide password toggle added. |
| FR-L2 | Done | Both accounts work. The hint line is in place. |
| FR-L3 | Done | Exact wrong entry and required field messages. |
| FR-L4 | Done | Dashboard opens and the header shows the role. |
| FR-L5 | Done | No SAMPLE badge anywhere. Login header shows `Role: not signed in`. |
| FR-L6 | Done | Session is kept in sessionStorage. It survives a reload and ends when the tab closes or on logout. |

### Dashboard
| ID | Status | Reason |
|---|---|---|
| FR-D1 | Done | Four tiles. Daily change is red with a down triangle, green with an up triangle, or gray at zero. |
| FR-D2 | Done | Last updated shows the date of the last record. |
| FR-D3 | Done | Area chart with only High, Low, and Latest markers. Hover dot shows on the price line only. |
| FR-D4 | Done | Badge, two live yes or no lines, and View recommendation. |
| FR-D5 | Done | Four Go to buttons with no arrows. |
| FR-D6 | Done | Grid stretch gives equal height at 1366 and 1920. |

### Data Import
| ID | Status | Reason |
|---|---|---|
| FR-I1 | Done | CSV only. Shows name and size. The button stays disabled until a valid file is chosen. |
| FR-I2 | Done | Message names the missing column. |
| FR-I3 | Done | Exactly five checks in the given order. |
| FR-I4 | Done | A reversed file passes with identical results. A shuffled file fails check 3. |
| FR-I5 | Done | Both formats accepted. Impossible dates are rejected. The message names the first bad row. |
| FR-I6 | Done | K, M, and B suffixes convert. A blank volume is allowed and draws no bar. |
| FR-I7 | Done | Red card, every problem with its row, first 10 then and N more, previous file note, reset button. |
| FR-I8 | Done | Green card, five ticks, summary line, Continue to Trend and Forecast. |
| FR-I9 | Done | Both shortcuts carry a DEMO tag. The error file has 23 real rows and gives exactly 5 problems. |
| FR-I10 | Done | Controller sees disabled controls, a dataset summary, and the exact message. |
| FR-I11 | Done | Parsing runs in the browser. Files over 5 MB are refused. |

### Trend and Forecast
| ID | Status | Reason |
|---|---|---|
| FR-T1 | Done | Tag, question, and exact method line. |
| FR-T2 | Done | Two ARIA tabs with arrow key support. |
| FR-T3 | Done | Six ranges. Tiles recompute for the range. |
| FR-T4 | Done | All layers are drawn. Tooltip has no parentheses. Legend items toggle their lines. |
| FR-T5 | Done | Real Vol. column in its own panel with its own scale. Oct 16, 2026 shows 30.11 M. |
| FR-T6 | Done | Collision check for the Day 30 label. It is hidden when it would overlap or the chart is under 520 px. |
| FR-T7 | Done | Summary, Forecast, and Accuracy cards. Each accuracy term has an info tip. |
| FR-T8 | Done | Method line: a straight line fitted to the last 90 closing prices, projected 30 trading days ahead. Weekends are skipped. Holidays are not. |
| FR-T9 | Done | Back-test math is unchanged. |
| FR-T10 | Done | All rows, nine columns, sortable, 25 per page, jump to date. |
| FR-T11 | Partly done | All controls and validation work. The panel is collapsed by default at every width, not only under 1280 px. This removes the P9 gap at wide sizes. |
| FR-T12 | Done | Next opens screen 04. |

### Recommendation and Drivers
| ID | Status | Reason |
|---|---|---|
| FR-R1 | Done | Live values. Sell, Wait and watch, and Hold were each forced with fixtures: `docs/qa/rec-*.png`. |
| FR-R2 | Done | Word, color, and strip. The amber word uses a darker text tone so it reaches 5.02:1 contrast. |
| FR-R3 | Done | Exact rule wording. |
| FR-R4 | Done | Two yes or no lines. A no uses a gray cross. |
| FR-R5 | Done | Three exact What this means sentences. |
| FR-R6 | Done | Five frozen drivers. Text wraps at 1024 and 390 px. |
| FR-R7 | Done | Exact outside factors note. |
| FR-R8 | Done | Exact disclaimer and View report. |

### Report
| ID | Status | Reason |
|---|---|---|
| FR-P1 | Done | Built from live data. No SAMPLE tags, sketch chart, or hard coded values. |
| FR-P2 | Done | Title, company, Data as of, and Print report. |
| FR-P3 | Done | Four tiles and a five item strip. |
| FR-P4 | Partly done | Same real daily data, both averages, forecast with 95% range, legend, and Predictive tag. It uses the shared LineChart, not the full Trend chart, so there is no volume panel and no controls. |
| FR-P5 | Done | Prescriptive tag, result, reasons, forecast line, accuracy line. |
| FR-P6 | Done | Drivers and the outside factors note. |
| FR-P7 | Done | Exactly 7 lines with live dates. |
| FR-P8 | Done | `CFO: view only access.` |
| FR-P9 | Done | A4 portrait with 12 mm margins. Two pages with no chart split. Navigation and buttons are hidden. Lines use different dash styles. Tested in headless Edge; Chrome uses the same engine. |
| FR-P10 | Done | Italic quote and leftover line removed. |

### Errors and empty states
| ID | Status | Reason |
|---|---|---|
| FR-E1 | Done | Shared EmptyState with the exact message and an Open Data Import button on four screens. |
| FR-E2 | Partly done | Data Import shows a placeholder while it reads and checks a file. Analysis runs synchronously in about 9 ms for 5000 rows, so no other screen needs a placeholder. |
| FR-E3 | Done | Every message says what went wrong and how to fix it. No apologies. |

### Non functional
| ID | Status | Reason |
|---|---|---|
| NFR-1 | Done | FCP 308 ms. Recompute for 5000 rows takes 9.1 ms. Resize is debounced at 100 ms. |
| NFR-2 | Partly done | Tested in headless Edge only; Chrome uses the same engine. Firefox was not tested. Windows 125% scaling and browser zoom were tested with CSS pixel equivalent viewports, not real zoom. |
| NFR-3 | Done | `dist/index.html` has no external references. It runs from file:// with the network off. |
| NFR-4 | Done | One calculation module. Tests pin the section 6 values. |
| NFR-5 | Done | Console is clean at every size and in every flow. The rules of hooks crash in Trend is fixed. |
| NFR-6 | Partly done | Wording follows the paper. The scripted walk takes 4.2 s. A timed first time user test was not run. |
| NFR-7 | Partly done | `npm run contrast` passes all 30 pairs. The keyboard tab pass found 0 elements without a focus ring. Skip link, focus trap, chart text summaries, and reduced motion are in place. No third party checker such as axe was run. Decorative card borders and grid lines stay under 3:1 on purpose, as listed in the script output. |
| NFR-8 | Done | Demo accounts only, stated in the README. React escapes all text. No eval. Nothing leaves the browser. |
| NFR-9 | Done | Thresholds live in `src/config.ts`. Colors live in CSS variables. Dead code and CSS removed. |
| NFR-10 | Done | README covers run, accounts, folder map, and replacing the data file. |
| NFR-11 | Done | One card, button, tag, and table style across screens. |

### Observed problems
| ID | Status | Reason |
|---|---|---|
| P1 | Done | 100dvh shell. Only the main area scrolls. Drawer under 1024 px. No horizontal scroll at any of the 7 sizes or the zoom proxies. |
| P2 | Done | No badge. Login header added with `Role: not signed in`. |
| P3 | Done | Only the three markers remain. Daily change uses the percent sign. |
| P4 | Done | Five checks listed. |
| P5 | Done | Every problem with its row number. The 120 rule always runs. |
| P6 | Done | DEMO tag. Sample wording removed. |
| P7 | Done | Real volume. The wave fallback is removed. |
| P8 | Done | Label collision handling. |
| P9 | Done | Chart card stretches and Customize starts collapsed. |
| P10 | Done | Drivers wrap. The Why card has What this means. |
| P11 | Done | Report rebuilt from live data. |
| P12 | Done | Full limitations list. |
| P13 | Done | No peso sign on prices. It was not present in the current code. |
| P14 | Done | Rendered text dumps contain no parentheses and no em dashes. |
| P15 | Done | Tokens, one card style, no breadcrumbs, sentence case labels. |
| P16 | Done | Header shows the logged in role. The permission matrix is enforced. |

### Design sections 7.1 to 7.8
All are done, with these notes. Card borders stay decorative. Customize chart starts collapsed at every width, as covered under FR-T11. The Report prints on two pages.

## Noticed but not changed

1. Forecast dates skip weekends but not Philippine market holidays. The forecast math is frozen.
2. The t value for the 95% range is fixed at 1.987. That is correct for about 88 degrees of freedom with a 90 row fit window.
3. `AGENTS.md` points to `../storyboard-all-frames.html`, which does not exist at that path.
4. The untracked `my-skills/` folder has unrelated Vitest files, so `npm run test` is scoped to `src/test`.
5. Nothing is committed. All changes are in the working tree.

## Evidence

- Screenshots, 7 sizes and every screen: `docs/screenshots/<WxH>/`. Zoom proxy: `docs/screenshots/2400x1350/`.
- QA flows: `docs/qa/qa-flows.json`, `docs/qa/rec-*.png`, `docs/screenshots/flows/`.
- Print: `docs/print/report-analyst.pdf`, `report-controller.pdf`, `report-print-preview.png`.
- Keyboard: `docs/screenshots/keyboard.json`. Contrast: `npm run contrast`.
