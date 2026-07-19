# Handoff — 2026-07-19 M0 engine skeleton complete

## Done (verified)
- Repository correction (human decision, this session): TADAK lives in `sonarki/rythm-typing`, NOT `sonarki/weavrain`. All work below was rebuilt/re-verified in this repo on branch `dev`. The earlier weavrain copy sits untouched on its side branch `claude/project-setup-m0-lxjjy8` (weavrain `main` was never modified).
- Project documents committed verbatim at repo root (sha256-verified against the human-provided originals): `CLAUDE.md`, `PROJECT-SPEC.md`, `HANDOFF-BRIEF.md`, empty `HANDOFF.md`, `.gitignore` (`node_modules/`, `dist/`, `.env`) — commit `8601a0f`.
- Scaffold: Vite + React + TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) + Vitest with v8 coverage — commit `403161e`. `npm run build` passes `tsc -b` clean.
- M0 timing core — commit `9e4503c`:
  - `src/core/clock/` — `TadakClock` (injected `AudioContext.currentTime` source, one `performance.now()`→audio conversion point, stored calibration offset) + Grace Clock patent-track scaffold (`judgeTime` / `renderTime` pure functions, disclosure doc comments), `computeMedianOffsetMs`.
  - `src/core/scheduler/` — `LookaheadScheduler`, 25ms tick / 100ms horizon, injectable clock + interval driver.
  - `src/core/input/` — `InputCapture`, repeat filtering (flag + held-set), append-only `{code, tPerf}` log. Zero DOM imports.
  - `src/core/judge/` — table-driven Perfect/Good/Late/Miss (`judgeDelta`, `judgeChart`).
  - `src/core/replay/` — offline deterministic replay (log → clock conversion → scheduler → judge).
  - Placeholders only for `hangul`, `beatmap`, `mixer`, `tape` (M1+; no code, per brief).
- Tests (re-run in THIS repo): `npm test` → **5 files, 45 tests, all green**; `src/core` statement coverage **98.32%** (threshold 80% enforced in `vite.config.ts`). Determinism proof (`tests/determinism.test.ts`) replays a recorded log twice and asserts byte-identical serialized judgment + identical scheduled beat times.
- UI — commit `429c881`: ASC v1 calibration screen (60 BPM clicks, Space ×16, median offset → `localStorage['tadak.calibrationOffsetMs']` → clock) and canvas DebugLane (90 BPM beats sweeping to a judgment line, in-world hit marks, monochrome + coral `#D85A30`).
- Runtime dependencies added (scaffold, justified per CLAUDE.md §2): `react`, `react-dom` — required by the mandated stack; core has zero runtime deps.

## Not done / in flight
- Human feel-test of calibration + DebugLane in a real browser — the build environment is headless (no audio device, no keyboard); code paths are unit-tested but the end-to-end feel needs a human `npm run dev` run.
- Playwright smoke tests (CLAUDE.md §2 stack item) — not required by the M0 brief; not started.
- Cleanup of the stale weavrain branch `claude/project-setup-m0-lxjjy8` (contains the mistaken TADAK copy) — deletion left to the human; nothing on weavrain `main` was ever touched.

## Decisions made by the human this session
- "답변은 한글로" — chat replies in Korean.
- "레포저장소 잘못됐어. veavrain 아니고 rythm-typing이야. 여기로 다시 다 옮겨. wevrain거는 건들지 말고" — TADAK belongs in `sonarki/rythm-typing`; weavrain's own files must not be touched.

## Standing rules added/changed
- TADAK's home repository is `sonarki/rythm-typing` (proposed for CLAUDE.md §0 note; human edits CLAUDE.md).

## Next first action
- Human runs `npm run dev`, completes the 16-tap calibration, then plays the DebugLane and reports how it feels before M1 (hangul automaton) starts.

## Do-not-repeat
- The session initially committed TADAK into the wrong repository (`weavrain`) because the work order arrived in a weavrain-bound session — confirm the target repo before the first commit of a new project.
- Two test failures came from arithmetic errors in test *expectations* (nearest-subdivision midpoints), not the implementation — compute which grid point is actually closer before writing the expected value.
- `Buffer` is unavailable under browser-lib TypeScript without `@types/node`; use `TextEncoder` for byte-identity assertions in tests.
- `src/dev/DebugLane.tsx` importing `./audioEngine` — the module lives at `../ui/audioEngine`; tsc catches it only at build, so run `npm run build` before assuming green.
