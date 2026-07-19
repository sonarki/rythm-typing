# TADAK — Work Order for Claude Code (Session 1)

This is the executable work order. Read `CLAUDE.md` (rules) and `PROJECT-SPEC.md` (spec) first; this file tells you exactly what to do now.

## 1. Goal (one sentence)
Stand up the TADAK repository and complete **Milestone M0 (engine skeleton)** so that a deterministic, latency-calibrated timing core passes its full test suite.

## 2. Verified current state
- Nothing exists yet. There is **no repository, no code, no prior branch** — do not search for phantom prior work.
- You will receive/confirm from the human: the working directory path and whether a GitHub remote should be created. If no remote is available, work locally and say so in the handoff note; do not block on it.
- The three project documents (`CLAUDE.md`, `PROJECT-SPEC.md`, `HANDOFF-BRIEF.md`) are provided by the human — place them at the repo root unchanged, and create an empty `HANDOFF.md`.

## 3. Exact work (in order)

1. **Scaffold**: Vite + React + TypeScript strict. Layout:
   ```
   src/core/{clock,scheduler,judge,input,hangul,beatmap,mixer,tape}/
   src/ui/            # React shell (menus later; M0 needs only a debug page)
   src/dev/DebugLane.tsx
   assets/  tests/  HANDOFF.md  CLAUDE.md  PROJECT-SPEC.md
   ```
   Vitest configured; `npm test` and `npm run dev` both work.
2. **`core/clock`**: single time source wrapping `AudioContext.currentTime`; `performance.now()`→audio-time conversion with a stored calibration offset. Includes the **Grace Clock** scaffold: `judgeTime(input)` (honest) and `renderTime(input, snapWindowMs)` (quantized to subdivision) as separate pure functions with doc comments per CLAUDE.md §2 (patent-track module).
3. **`core/scheduler`**: lookahead scheduler (25ms tick, 100ms horizon) that schedules callbacks/audio events against the clock; unit-tested with a mocked clock.
4. **`core/input`**: raw `keydown`/`keyup` capture with `performance.now()` timestamps, key-repeat filtering, and an append-only session log `{code, tPerf}` (the §4.5 log format).
5. **`core/judge`**: window-based judgment (Perfect/Good/Late/Miss) against a chart of target times; pure, table-driven windows.
6. **Calibration screen (ASC v1)**: a minimal page playing a click at 60 BPM; user taps space ×16; compute median offset, persist to localStorage, feed the clock. (Mic-assisted mode is M5 — do NOT build it now.)
7. **Determinism proof**: a test that replays a recorded input log through scheduler+judge twice and asserts byte-identical judgment output and identical scheduled times.
8. **DebugLane**: one canvas lane showing scheduled beats and hit markers so the human can feel M0 with `npm run dev`.
9. Append the M0 completion entry to `HANDOFF.md` in the CLAUDE.md §6 format.

## 4. Completion criteria (checks a stranger can run)
- `npm test` → all green; `src/core` coverage ≥ 80% (statement).
- `npm run dev` → calibration screen works end-to-end; DebugLane shows beats; tapping space on beat shows judgment markers.
- Determinism test (step 7) exists and passes.
- `HANDOFF.md` contains the session entry; if a remote exists, commit SHA pushed on `dev`.
- Nothing from PROJECT-SPEC §9 (out of scope) was started.

## 5. Failure report format
If blocked, report exactly: (a) the verbatim error, (b) classification — environment / permission / tool-capability / logic, (c) ONE proposed next action. Log it under `HANDOFF.md → Do-not-repeat`. Never retry the identical action after the same failure.

## 6. Model recommendation
Run M0 with **Claude Opus (or the highest reasoning tier available)** — the clock/scheduler/determinism core is architecture-heavy and errors here poison every later milestone. From M2 onward, routine implementation (UI wiring, asset plumbing) can drop to **Sonnet** for speed/cost; keep Opus for the four patent-track modules.

## 7. Guards
- Do not modify `CLAUDE.md` / `PROJECT-SPEC.md`; propose edits in chat instead.
- No new runtime dependencies beyond the scaffold without logging justification in `HANDOFF.md`.
- No deploys, no accounts, no analytics, no audio assets that lack a `assets/CREDITS.md` line.
- Ask approval before deleting more than 5 files or changing licenses.
