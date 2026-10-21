# Stock Trend Forecasting and Advisory Module (React + Vite, offline)

- Install: `npm install`
- Dev server: `npm run dev` | Production build: `npm run build` -> single file `dist/index.html` (works via double-click, offline)
- Tests: `npm run test` (vitest, logic in `src/lib`)
- Sample data: `npm run sample` regenerates `src/data/sample/*.csv` and self-checks them against the storyboard's shared numbers. Do not edit the CSVs by hand.
- Demo logins (password `dito2026`): `analyst01` (Data Analyst), `controller01` (Controller)
- Screen spec: `../../storyboard-all-frames.md` (Frames 2-9). Visual tokens come from `../storyboard-all-frames.html`.
- Deps are pinned exactly; no router/chart/UI libraries by design.
