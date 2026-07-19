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

# Handoff — 2026-07-19 M2 complete (Percussion Mode playable) — FUN-TEST CHECKPOINT

## Done (verified)
- Percussion core (`src/core/percussion/`) — commit `eec1418`: 3 lessons (첫 그루브 72BPM 4-key full-snap onboarding → 홈로우 셔플 88 → 크로스로우 브레이크 104; snap 999→140→80ms per Grace v1 adaptive dial), pure call-and-response session machine: honest judgment + Grace-rendered times per hit, stray hits soft-not-silent (§1.1), phrase layering ≥70%, quit-anytime finalize (§1.5).
- Session Tape core (`src/core/tape/`) — commit `09b4883`: pure TapeScore builder (count-in, hits at RENDERED times, layered-phrase echoes, ~32s cap, tail) + dependency-free PCM16 WAV encoder (header/clamping unit-tested).
- Skill Ring v1 + guide progression (`src/core/mastery/progress.ts`) — commit `f01cf50`: coverage/precision ring math, guideLevel 0/1/2 (full glow → outline → minimal) with thresholds.
- UI — commit `5e1c182`: synthesized lo-fi kit (kick/snare/hat/rim, deterministic pseudo-noise + pitch-vary, brightness-capped, glue-compressed master bus — zero external assets, CREDITS.md updated), PercussionScreen (canvas: beat pulse, phrase dots call→response, on-screen keyboard guide with finger-zone glow + call-key lighting + manual override select, pooled ripples ≤60, micro hit-stop ≤28ms on phrase finals, combo = background warmth, miss = brief desaturation, reduced-motion honored, Esc = finish-with-tape), quiet ending scene (tape auto-plays, ▶ replay, ⬇ WAV download, stats fade in small, Skill Ring), studio home with lesson list + ring. Feedback in-world only — no popups, no floating numbers.
- Gate: `npm test` → **11 files, 129 tests, all green**; `src/core` statements **98.95%** (threshold 80%). `npm run build` clean (tsc strict). Dev server smoke: HTTP 200 on `/` and `/src/ui/PercussionScreen.tsx`. All pushed on `dev`.

## Human fun-test checklist (M2 checkpoint — the actual gate)
Run: `git checkout dev && npm install && npm run dev` → open the printed URL (Chrome/Edge 권장).
1. **calibration 탭**: ▶ start → 스페이스로 클릭에 맞춰 16탭 → 오프셋 ms 저장 확인.
2. **home → 01 첫 그루브**: ▶ 시작 → 리듬이 먼저 치고(listen), 다음 마디에 따라 치기(play). 확인할 것: 첫 판에 "완주했다"는 느낌이 드는가? 서툴게 쳐도 소리가 포켓 안에 있는가(전부 박에 실려 들리는가)?
3. **엔딩**: 조용한 화면에서 테이프가 자동 재생되는가? ⬇ WAV로 저장한 파일이 플레이어에서 재생되는가? 스탯이 뒤늦게 작게 떠오르는가?
4. **02, 03 레슨**: 난이도가 층계처럼 느껴지는가? 03에서 스냅이 조여진 게 체감되는가?
5. **주스**: 콤보가 이어질 때 배경이 미세하게 따뜻해지는가? 미스에 회색이 잠깐 스치는가(빨강/셰이크 없음)? 프레이즈 마지막 히트의 미세 멈춤이 느껴지는가?
6. **가이드**: 우상단 guide 셀렉트로 full/outline/minimal 전환이 되는가? (auto는 숙련도 축적 후 자동 하강)
7. **Esc 중도 이탈**: 그래도 테이프가 만들어지는가?
### 피드백으로 필요한 것 (자유 서술)
- 한 판 더 하고 싶은가? (CLAUDE.md §7 — 아니라면 그것이 버그)
- 소리: 거슬리는 음이 하나라도 있었는가? 킷 중 가장 약한 소리는?
- 첫 레슨이 너무 쉬운가/긴가? BPM·프레이즈 수 조정 의견.
- 판정이 억울한 순간(맞게 쳤는데 miss)이 있었는가 — 있었다면 calibration 후에도 그런가?

## Not done / in flight
- Tape Shelf(선반에 테이프 쌓이기)와 온보딩 문구 다듬기 — §E상 M4/M2 폴리시 여지; 현 홈은 레슨 목록 + Skill Ring.
- Playwright 스모크 — 여전히 브리프 비요구, 미착수.
- 60fps 실측 프로파일링 — 헤드리스 환경에서는 불가; 재미 테스트 시 크롬 Performance 패널로 한 번 확인 권장(설계상 rAF 단일 캔버스 + 풀링, 프레임당 할당 최소화).

## Decisions made by the human this session
- "M1 is accepted … Proceed to Milestone M2 … prefer synthesized one-shots (Web Audio) over external files at this stage."

## Standing rules added/changed
- None new (addendum §E already folded).

## Next first action
- Human runs the fun-test checklist above and reports; M3 (Groove Mode + ADSM) starts only after feel feedback is folded back into Percussion.

## Do-not-repeat
- (carried) verify test-expectation arithmetic; TextEncoder not Buffer; build before assuming green; weavrain branch ops are 403 from this session.

# Handoff — 2026-07-19 addendum: standing rule — always publish a test link

## Done (verified)
- M2 test build published as a self-contained single-file artifact (private to the human's Claude account, shareable from its page): https://claude.ai/code/artifact/a0d1b872-485f-4a8c-b0e6-e6b1ddbede08 — built from `dev` @ `ce2d913` (vite build inlined; localStorage shim for sandboxed iframes).

## Standing rules added/changed
- **"테스트 링크는 항상 걸어줘"** — from now on, EVERY milestone/checkpoint report to the human must include a clickable test link of the current build. Procedure: `npm run build` → inline bundle into one HTML → republish the SAME artifact so the URL stays stable. From this session, republish the same file path (`scratchpad/tadak-test.html`); from any NEW session, pass `url: https://claude.ai/code/artifact/a0d1b872-485f-4a8c-b0e6-e6b1ddbede08` to the Artifact tool to keep the URL. Note: this is a private artifact, not a public deploy — CLAUDE.md §4's public-deploy approval gate is untouched.
- Proposed CLAUDE.md edit (human applies): §3 Working discipline, add — "Every milestone report includes a test link (artifact) of the current build; keep the artifact URL stable across updates."

## Next first action
- (unchanged) Human runs the M2 fun-test checklist — now via the test link above (Chrome 권장, 물리 키보드) or locally with `npm run dev`.
