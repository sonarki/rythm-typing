# TADAK — Spec Addendum v2.1: Learning, Visuals, Ranking, Retention

Extends PROJECT-SPEC.md v2.0. Nothing here replaces v2.0; where milestones are named, fold these into that milestone's scope. CLAUDE.md rules apply unchanged. Read after PROJECT-SPEC.md.

---

## A. Learning engine — one game, every skill level (lands in M1–M2, model in core)

The app must feel like play to a first-day hunt-and-peck beginner AND a 120WPM expert. The mechanism is one adaptive engine, not separate "easy/hard apps".

### A.1 Mastery Model (`src/core/mastery/`)
- Track a per-key and per-bigram (key-pair) mastery score from every judged hit: rolling accuracy, mean timing error, and decay over days (spaced-repetition style: untouched keys slowly "cool down").
- Korean tracks jamo-level and syllable-pattern mastery (e.g., double-final consonants 겹받침 as their own skill nodes).
- This model is the single input for difficulty, drill selection, and the Skill Ring UI (§B.3).

### A.2 Weakness-Targeted Drill Synthesis (patent-track extension of JBC)
- JBC reverse mode (SPEC §4.1) gains a second objective: given the player's weak keys/bigrams from the Mastery Model, search the corpus for sentences that are BOTH rhythmically fitting AND dense in the player's weaknesses.
- Result: the player never sees "you are bad at ㄹ" — they just keep getting songs that secretly rehearse ㄹ, at a beat that makes the rehearsal feel like groove. Claim sketch: "rhythm-constrained text selection optimized jointly for musical fit and per-user motor-skill deficit."

### A.3 Flow Controller (`src/core/flow/`)
- Target success band: keep rolling note-success near 85% (the flow zone). Controller nudges, in priority order: judgment window → chart density → BPM. Adjust between phrases, never mid-phrase (players must not feel the ground move).
- Novice floor: below a threshold, Grace Clock snap widens and charts drop to syllable-beat automatically. Expert ceiling: windows tighten, jamo-beat and syncopation unlock. Same song, honest score, different ride.

### A.4 First-day promise (onboarding, M2)
- Minute 1–3: the player completes a real song using only 4 keys (home-row subset), gets a Session Tape, and hears themselves in the pocket (full Grace snap). Success BEFORE any teaching.
- Teaching is implicit: correct finger guidance is shown as light on the on-screen keyboard, never as text lectures. No typing-class vocabulary anywhere in UI ("자리연습" 금지 — it's a "warm-up groove").

## B. Visual system — progression you can see (lands in M2–M3, polish M5)

### B.1 Progressive UI density
- The interface itself levels with the player: novices see a large on-screen keyboard with finger-zone glow and slow lanes; as mastery rises, the keyboard guide shrinks and fades until experts play on a clean minimal lane. UI density is driven by the Mastery Model, with a manual override in settings.

### B.2 Juice budget (feel engineering)
- Every hit answers within 100ms with motion+sound. Perfect = crisp snap easing; Good = softer settle. Micro hit-stop (≤30ms) on phrase-final notes only. Particle budget hard-capped (pooled, ≤60 live), reduced-motion variant mandatory (CLAUDE.md §1.10).
- Combo is shown as environment, not number: background tone deepens, lane light warms. Break = brief desaturation, never shake/red-flash.

### B.3 Skill Ring & Tape Shelf (progress metaphors)
- **Skill Ring**: one ring around the player avatar; thickness = coverage (keys mastered), tightness = rhythm precision (ms). It visibly tightens over weeks — progress at a glance, no spreadsheets.
- **Tape Shelf**: the home screen is a quiet studio shelf; every Session Tape/Ambient Piece becomes a spine on the shelf. Filling the shelf IS the meta-progress visual. Tapping an old tape replays it — "listen to yourself two weeks ago" is the strongest motivator we have.

## C. Ranked play — challenge without cruelty (lands in M4, expands post-M5)

Standard leaderboards churn beginners (permanent bottom = quit). TADAK ranks differently:

### C.1 Groove Score (the ranked currency)
- Ranked metric = rhythm precision × accuracy, NOT raw speed. A musical 40WPM beginner can outrank a sloppy 100WPM expert. This is the differentiation: we rank musicianship, which every level can compete on. WPM remains a personal stat, never a rank axis.

### C.2 Weekly Pocket League
- Players are bracketed with ~30 similar-skill players (Mastery Model percentile); weekly promotion/demotion between named tiers (Cardboard → Wood → Brass → Vinyl → Gold Vinyl → Master Tape). You always race peers, never the global top. Opt-in only; Flow Mode users never see ranks.

### C.3 Ghost Duels (deterministic-replay tech reuse, near-zero infra)
- Any performance log (SPEC §4.5) can be replayed as a translucent "ghost" on the second lane. Challenge a friend's ghost asynchronously, or your own last-week self. No realtime netcode needed — the input-log determinism we already built makes PvP essentially free.

### C.4 Async Duet (signature social mode)
- Two players record halves of the same song (call/response or left-stems/right-stems); the Tape Renderer merges both logs into ONE finished track credited to both. Cooperative completion, not confrontation — on-brand with healing, and a shareable no competitor has.

## D. Retention — reasons to come back that respect the player (M4–M5)

Loop design, from daily to seasonal. Tone rule: every return trigger is an invitation, never guilt ("스트릭이 꺼져요!" 류 금지).

- **Daily (≤90 seconds)**: Daily Groove — one shared 60s chart worldwide; streak counter with 2 free "rest days" per week banked automatically (streak mercy). Completing it stamps today's mini-tape onto the shelf.
- **Weekly**: Pocket League resolves Sunday; **Weekly Mixtape** auto-compiles your best takes of the week into one track + share card (waveform + Skill Ring delta). The product emails/notifies exactly once: "이번 주 믹스테이프가 완성됐어요 — 들어보세요."
- **Monthly/seasonal**: a Season = new sound pack + 5 songs + a "Recital" weekend event where the community's duets are featured on a public wall (curated, opt-in).
- **Comeback design**: a lapsed player returning after 7+ days gets no guilt screen — instead: their shelf, one button, a 60-second warm-up groove tuned two notches easier than their last level, ending in an instant tape. First minute back = a win, always.
- **Hear-your-growth**: at 2/4/8-week marks, offer a side-by-side playback: first-week tape vs today. Nothing sells "계속 다니는 학습현장" like hearing your own before/after.

## E. Milestone folding (delta to SPEC §8)
- M1 += Mastery Model skeleton (data capture only).
- M2 += First-day onboarding song, progressive keyboard guide, Skill Ring v1, juice pass on Percussion.
- M3 += Flow Controller live, weakness-targeted charts v1.
- M4 += Daily Groove + streak mercy, Tape Shelf home, Ghost Duels v1 (self-ghost first), Weekly Mixtape.
- M5 += Pocket League, Async Duet, comeback flow, season scaffolding.
- Out-of-scope guard unchanged (SPEC §9): no accounts/backend until the phase gate — Daily Groove and leagues before that gate run local/mock so the mechanics can be fun-tested first.

