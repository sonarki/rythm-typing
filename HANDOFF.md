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

# Handoff — 2026-07-19 M1 complete (Hangul automaton + JBC v1 + Mastery skeleton)

## Done (verified)
- Spec addendum v2.1 saved verbatim at repo root (`SPEC-ADDENDUM-v2.1.md`, extracted byte-exact from the human's delimited block) — commit `9810a70`. Milestone deltas from its §E are folded into working scope (M1 += Mastery Model skeleton, data capture only).
- Hangul Performance Automaton (`src/core/hangul/`, patent-track §4.4) — commit `4a4b532`:
  - `jamo.ts` Unicode compose/decompose + compound-vowel/double-final tables; `layout.ts` 2-beolsik code↔jamo map (Shift doubles); `automaton.ts` initial/medial/final state machine with 도깨비불 backtracking (migrated jamo's timestamped event re-roles to the new syllable); `decompose.ts` text→keystroke stream + stroke counts.
  - Golden test set passing (35 tests): 값/닭/외/의 compose AND stroke-count as 4/4/3/3; 도깨비불 값+ㅏ→갑사, 닭+ㅣ→달기, 있+ㅓ→이써; per-jamo timestamped events with roles; round-trip decompose→automaton for 값 닭 외 의 왜 뷁 안녕하세요 한글 띄어쓰기.
- JBC v1 (`src/core/beatmap/`, patent-track §4.1) — commit `be098ef`: text→syllable-beat chart for KR and EN (one note per char, word boundaries snapped to downbeats, punctuation = rests), every note carries the §4.1 stroke-count analysis + required keystrokes; density dials (`beatsPerNote`, `beatsPerBar`); deterministic (serialization-identical) — 10 tests.
- Mastery Model skeleton (`src/core/mastery/`, addendum §A.1, M1 scope = data capture ONLY) — commit `0f7bb16`: per-key and per-bigram attempts/hits/mean-abs-error/lastAt, pattern-tag nodes (겹받침), toJSON/fromJSON; a guard test asserts no difficulty/decay policy exists yet — 7 tests.
- Full suite after M1: `npm test` → **8 files, 97 tests, all green**; `src/core` statement coverage **98.48%** (threshold 80%). `npm run build` (tsc strict) clean.

## Not done / in flight
- weavrain leftover branch `claude/project-setup-m0-lxjjy8`: deletion was APPROVED but the push was rejected by the session's git proxy with HTTP 403 (this session may only push that repo's designated branch; branch deletion is a different ref operation). Classification: permission/environment. The branch remains on weavrain; delete it from GitHub's UI (Branches page) or from any session with weavrain write access. Nothing else on weavrain was touched.
- Jamo-beat phrase synthesis (8th pair/triplet/16th run) and JBC reverse mode — deliberately NOT in M1 (spec puts them later); stroke-count analysis they need is in place.
- Human feel-test deferred to the M2 checkpoint by the human's decision — not blocking.

## Decisions made by the human this session
- "Migration to sonarki/rythm-typing is accepted … rythm-typing `dev` is TADAK's home. Continue there."
- "APPROVED: delete the leftover remote branch `claude/project-setup-m0-lxjjy8` on the weavrain repo (branch only …). If this session no longer has access to weavrain, skip and note it in HANDOFF.md instead." → attempted, 403, noted above.
- "The human will do the hands-on feel test at the M2 checkpoint, not now. Do not wait for it."
- SPEC-ADDENDUM-v2.1.md added as a project document; extends PROJECT-SPEC.md, CLAUDE.md unchanged as standing law.

## Standing rules added/changed
- Addendum v2.1 §E milestone deltas are now part of each milestone's scope (M2 += onboarding song/keyboard guide/Skill Ring v1/juice pass; M3 += Flow Controller + weakness-targeted charts; M4/M5 per §E). Proposed CLAUDE.md §0 edit for the human: add `SPEC-ADDENDUM-v2.1.md` to the reference-docs list.

## Next first action
- M2 kickoff: build Percussion Mode lesson 1 (call-and-response over one sound pack) wired to Grace Clock v1 — starting with the sound-pack trigger scheduling in `src/ui/audioEngine.ts` + a `src/core` lesson pattern model.

## Do-not-repeat
- weavrain branch deletion via `git push --delete` → 403 proxy rejection; do not retry from this session class — needs GitHub UI or a weavrain-authorized session.
- (M0 items remain valid: verify test-expectation arithmetic; TextEncoder not Buffer; run `npm run build` before assuming green.)
