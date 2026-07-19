# TADAK — Project Specification v2.0 (Work Manual)

Status: replaces plan v1.0. Read together with `CLAUDE.md` (rules) and `HANDOFF-BRIEF.md` (current work order).

---

## 1. Vision

A desktop-web music game where the keyboard is the instrument and text is the score. The player never feels they are "practicing typing" — they are performing, and getting faster at typing is the loot they walk away with.

Three experience promises, in priority order:
1. **Joy** — every keystroke produces a musically pleasing result within 100ms.
2. **Completion** — every mode funnels toward a tangible "I made this" artifact.
3. **Healing** — at least one mode is explicitly restorative, not competitive.

## 2. Why this cannot be copied easily (differentiation thesis)

Existing products split into typing tutors (measure speed) and rhythm games (fixed note charts). TADAK's moat is the combination of four in-house technologies (§4) that make **arbitrary text in Korean and English playable as music, sound good even when the player is bad, and turn every play session into a shareable musical artifact.** The Korean jamo layer is the deepest moat: no existing product treats Hangul's 2–5-keystroke syllable structure as a rhythmic asset. Each technology below is written up as a patent-track module; §4 comments in code are the invention disclosure drafts.

## 3. The three modes and their achievement arcs

### 3.1 Percussion Mode — "the drill that records an album"
Call-and-response drills where each key is a percussion voice (rows = drum kit; sound packs swap the kit: lo-fi kit, hand-pan, gugak samul set, rain-drop kit).

- Loop: the game plays a 2-bar pattern (call) → the player answers on the drilled keys (response) → correct-on-beat answers get layered into a growing groove.
- **Achievement arc — Session Tape**: every take is recorded (input log, §4.5). Completing a lesson renders the player's best takes into a ~30s mixed track with intro/outro — "the tape of today's session" — playable and exportable. The beginner's clumsy first tape vs. week-3 tape is the retention hook: progress you can *hear*.
- Difficulty: BPM 60→120, one row → all rows → cross-row patterns.

### 3.2 Groove Mode — "complete the arrangement"
Beat-mapped sentences over stem-based songs. Letters are the notes; a judgment line sweeps them.

- Songs ship as 4–6 stems (drums, bass, keys, melody, texture, master-sparkle). Combo thresholds light stems up; misses duck them musically (§4.3). The song literally becomes fuller as you play better.
- **Achievement arc — the Full Arrangement**: the final chorus/outro stem only plays if the player finishes above threshold; full-combo triggers the "master" stem + a vinyl-spin results scene where their own performance replays. Clearing = finishing the song, not beating a score.
- Hangul charts: syllable-beat charts (Lv.2–3) → jamo-beat charts (Lv.4+) where a 4-stroke syllable becomes a 16th-note run — the signature high-level feel (§4.1).
- Korean/English mixed stages at top level (emails, code+comments) — the switch key itself is a note.

### 3.3 Flow Mode — "typing as meditation" (the healing pillar)
No score, no fail, no chart. The player types anything — journal, thoughts, pasted text — over a generative ambient bed (rain, soft pads, slow pulse ~60 BPM).

- Every keystroke triggers a note **constrained to the current pentatonic/modal scale**, voiced by syllable position (initial consonant = low pluck, vowel = mid tone, final consonant = soft chime; English maps by row). Constraint guarantees nothing can sound wrong — the technical basis of "healing".
- Breathing guide: the ambient bed swells on a 4-4-6 breath cycle; an optional gentle cue invites pacing without demanding it.
- **Achievement arc — the Ambient Piece**: ending a session offers to save/export the generated piece ("what your 10 minutes sounded like"). Doubles as the shareable that markets the product.

### 3.4 Cross-mode spine
- Daily Groove: one shared 60s challenge/day, streak + share card.
- Progress metrics: WPM/CPM, accuracy, and **rhythm precision (mean absolute timing error, ms)** — a metric no typing product surfaces; shown as a tightening ring over weeks.
- Collection: sound packs, key-skin visuals, song unlocks. All cosmetic; no pay-to-win mechanics ever.

## 4. Patent-track core technologies

Each module: bounded code, disclosure-grade doc comments, tunable parameters exposed in a config object.

### 4.1 JBC — Jamo Beatmap Compiler (`src/core/beatmap/`)
Text → music chart, automatically, for Korean and English.
- Pipeline: text → jamo/character keystroke stream (via the automaton §4.4) → per-syllable stroke-count analysis → rhythmic phrase synthesis: 2 strokes = 8th pair, 3 = triplet, 4 = 16th run, 5 = 16th run + pickup; word boundaries snap to downbeats; punctuation = rests/fills.
- **Reverse mode (the novel claim)**: given a target groove (e.g., a boom-bap pattern), search a corpus for sentences whose stroke-count sequence *fits the groove*, so the chart designer picks a beat and the compiler finds the words. Text-to-rhythm AND rhythm-to-text.
- Difficulty parameterization: same text compiles to syllable-beat (easy) or jamo-beat (hard) charts; density and syncopation are dials.

### 4.2 Grace Clock — dual-clock forgiveness engine (`src/core/clock/`)
The core "never sound bad" mechanism, and the invention with the widest claim.
- Two timelines: the **Judgment Clock** records true input time and scores honestly; the **Render Clock** schedules the *audible* result of each hit micro-quantized to the nearest musical subdivision within a psychoacoustic snap window.
- Adaptive snap: window width scales inversely with player skill (novice ±70ms → expert ±15ms) and per-context (Flow Mode = full snap; ranked = near-zero). The player always *hears* themselves in the pocket while the score tells the truth — decoupling motivation from punishment.
- Claim sketch: "separating input-evaluation timeline from auditory-rendering timeline with skill-adaptive quantization in a rhythm input system."

### 4.3 ADSM — Accuracy-Driven Stem Mixer (`src/core/mixer/`)
Real-time musical mix as the feedback channel.
- Rolling accuracy/combo drives per-stem gain, filter cutoff, and send levels via smoothed envelopes (no hard mutes). Miss = the relevant stem dips under a lowpass ("underwater") and recovers over ~2 bars; streaks open the mix up and add sparkle layers.
- Threshold events (stem unlock, final-chorus gate, full-combo master stem) are the completion mechanics of Groove Mode.
- Claim sketch: continuous mapping from input-accuracy statistics to multi-stem DSP parameters as primary game feedback.

### 4.4 Hangul Performance Automaton (`src/core/hangul/`)
IME-free Hangul composition for per-keystroke timing truth.
- Consumes raw `keydown` codes; runs a 2-beolsik jamo automaton (initial/medial/final states, double-consonant and compound-vowel handling, dokkaebi-bul backtracking) producing per-jamo timestamped events AND composed syllables.
- This is what makes jamo-beat judgment (§3.2) and Flow Mode voicing (§3.3) possible; browsers' IME cannot provide per-jamo timing.

### 4.5 Performance Log & Tape Renderer (`src/core/tape/`)
- Every session records `{keyCode, tPerf, judgment}` — a deterministic input log. Replaying a log through the engine reproduces the exact audio schedule (see determinism rule).
- Tape Renderer runs the log offline through the same scheduler into an `OfflineAudioContext` → WAV/MP3 export. Powers Session Tapes, Ambient Pieces, replays, and share clips. The product manufactures its own marketing content.
- Supporting tech: **ASC (Acoustic Self-Calibration)** — measured latency offset via a tap-along calibration screen; optional mic-assisted mode captures the physical key *thock* against the reference click to measure true end-to-end latency. Store per-device offset.

## 5. Completion-ritual design (applies to all modes)
- Ending screens are quiet, not loud: the artifact (tape/arrangement/piece) plays back over a still scene; stats fade in after, small.
- Partial sessions still produce a partial tape ("today's 40 seconds"). Quitting never feels like losing progress.
- Share card: minimal monochrome + accent, auto-generated (score ring, streak, waveform of the tape).

## 6. Visual system (optimization + style)
- Play field: single Canvas layer, object-pooled sprites, no per-frame allocation, devicePixelRatio-aware, target 60fps / 16ms budget; profile with the Performance panel before/after every play-field change.
- Style: monochrome line-art, one accent, feedback-in-world only (rules §1.2–1.3). Combo raises a subtle background tone shift; miss desaturates briefly. Reduced-motion variant mandatory.
- Menus/results: React DOM, plain and calm; the game screen is the show.

## 7. Audio system (the "joyful + healing" bar)
- Web Audio lookahead scheduler (25ms tick / 100ms horizon) driven by `AudioContext.currentTime`.
- Sound palette direction: warm, rounded, low-fatigue — lo-fi drums, felt piano, hand percussion, rain/vinyl textures. Nothing shrill; hard-cap brightness on all one-shots. Loudness-normalize all assets to a shared LUFS target.
- All hit sounds pitch/velocity-varied (round-robin ×3 + subtle random) so repetition never grates.
- Master bus: gentle glue compression + limiter; never clip.

## 8. Milestones (build order)

- **M0 — Engine skeleton (gate: all core tests pass)**: clock + scheduler + judge + input timestamping + ASC calibration screen + deterministic replay of a log. No visuals beyond a debug lane.
- **M1 — Hangul automaton + JBC v1**: per-jamo events verified against a golden test set (incl. 값/닭/외/의 edge cases); text→syllable-beat chart compiles; English charts.
- **M2 — Percussion Mode playable**: 3 lessons, one sound pack, Grace Clock v1, Session Tape render + export. *First "fun test" checkpoint with the human.*
- **M3 — Groove Mode playable**: 2 stem songs (1 KR, 1 EN), ADSM v1, arrangement-completion ending.
- **M4 — Flow Mode + Daily Groove + share cards.**
- **M5 — Polish pass**: perf audit, reduced-motion, colorblind accent, onboarding, 5 more songs.
- Phase gate after M5: retention instrumentation & monetization are a separate approved phase — not before.

Each milestone ends with: tests green, a HANDOFF.md entry, and a 30-second demo the human can run with one command (`npm run dev`).

## 9. Out of scope (v2.0)
Mobile/soft keyboards, multiplayer, UGC marketplace, accounts/payments/backend, licensed music, native apps. Listed so no session "helpfully" starts them.
