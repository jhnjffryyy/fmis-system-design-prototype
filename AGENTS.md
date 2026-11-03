# Stock Trend Forecasting and Advisory Module (React + Vite, offline)

- Install: `npm install`
- Dev server: `npm run dev` | Production build: `npm run build` -> single file `dist/index.html` (works via double-click, offline)
- Tests: `npm run test` -> `vitest run src/test` (scoped because `my-skills/` contains unrelated Vitest files that break unscoped runs)
- Demo data: `npm run demo-file` regenerates `src/data/demo/DITO-demo-with-errors.csv` from the bundled file. The real price file `src/data/prices/DITO-Historical-Data.csv` must not be edited.
- QA: `npm run qa` (screenshots + overflow/console checks; flags `--role`, `--sizes`, `--flows`, `--print`, `--keyboard`, `--qa-flows`); `npm run contrast` audits WCAG token pairs. Node >= 22, headless Edge or Chrome.
- Demo logins (password `dito2026`): `analyst01` (Data Analyst), `controller01` (Controller)
- Storyboard spec: `C:\Users\Meynard\Downloads\storyboard-all-frames.md` (Frames 2-9); finalization spec: `C:\Users\Meynard\Downloads\Prototype_Finalization_Spec.md`. Visual tokens come from `../storyboard-all-frames.html`.
- Deps are pinned exactly; no router/chart/UI libraries by design.
- Thresholds live in `src/config.ts`; tests pin the bundled file's reference values and must be updated if the data file changes.
