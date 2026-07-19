# TADAK — Project Rules (CLAUDE.md)

This file is the standing law of the project. Every Claude Code session must read this file FIRST, before touching any code. Rules here override convenience, speed, and any conflicting instinct. If a rule must change, the human (캡틴) changes it — sessions never silently deviate.

---

## 0. Identity

**TADAK** is NOT a typing tutor with music added. It is a **music performance game whose instrument happens to be a keyboard.** Typing skill is the side effect; the product is the feeling of playing music. Every design and code decision is tested against this sentence.

- Product one-liner: "Your typing becomes music."
- Languages: Korean (2-beolsik) + English (QWERTY), both first-class.
- Platform: desktop web (physical keyboard required). Mobile is out of scope until further notice.
- Reference docs: `PROJECT-SPEC.md` (what to build), `HANDOFF-BRIEF.md` (current work order), `HANDOFF.md` (session log — see §6).

## 1. Non-negotiable design laws

1. **Never sound bad.** No harsh error buzzers, no jarring mute. A miss makes the music thinner, filtered, or softer — never ugly. The Grace Clock engine (SPEC §4.2) exists for this. Any sound a user can produce must be musically acceptable.
2. **Feedback lives inside the world.** No "PERFECT!" text popups, no floating score numbers, no toast notifications during play. Feedback = animation, sound layers, light. If you catch yourself adding a popup, delete it and express the same information through motion or audio.
3. **One accent color.** UI is monochrome line-art + exactly one accent (default: coral `#D85A30`). Skins may swap the accent, never add a second.
4. **Judgment is honest; rendering is kind.** Scores always reflect real timing. Only the *audible/visual rendering* of the hit is forgiving. Never fake the score to flatter the player.
5. **Every session of play must end in a completion ritual** (SPEC §5). A player who stops mid-way still gets a "tape" of what they made. Nothing the player does is thrown away.
6. **Completion criteria for the player, per mode**: Percussion → a rendered Session Tape; Groove → a full arrangement (all stems lit); Flow → a saved ambient piece. If a feature doesn't feed one of these arcs, question it.
7. **60fps is a feature.** Frame budget 16ms. Canvas/WebGL for the play field; DOM only for menus. No layout thrash during gameplay; use object pooling for notes/particles.
8. **Latency honesty.** All timing math uses `AudioContext.currentTime` as the single source of truth. Key events are timestamped with `performance.now()` and converted once through a measured offset. Never trust `Date.now()`, never trust event order without timestamps.
9. **Hangul input never goes through the browser IME during gameplay.** Use the in-house jamo automaton (`src/core/hangul/`) fed by raw `keydown` codes. IME composition events are timing-unreliable and are used only in non-game text fields.
10. **Accessibility floor**: reduced-motion mode (no camera shake/particles), colorblind-safe accent option, all audio-conveyed judgment also visible visually.

## 2. Engineering rules

- **Stack**: TypeScript strict; React for shell/menus; Canvas 2D (WebGL only if profiling proves need) for the play field; Web Audio API with a lookahead scheduler (25ms tick, 100ms lookahead); Vite; Vitest for unit tests; Playwright for smoke tests.
- **Core is engine-first**: `src/core/` (clock, scheduler, judge, hangul automaton, beatmap compiler, stem mixer) must be pure TypeScript with **zero DOM/React imports** and ≥80% unit test coverage. UI consumes the engine through a typed event bus.
- **The four patent-track modules** (SPEC §4) live in clearly-bounded files with doc comments explaining the novel mechanism, inputs, outputs, and tunable parameters. These comments double as invention-disclosure notes — keep them current.
- **Determinism**: given the same beatmap + the same timestamped input log, the engine must reproduce identical judgment and identical audio schedule. Every play session records an input log (this powers replays, Session Tapes, and debugging).
- **No new runtime dependency** without listing it in HANDOFF.md with a one-line justification. Prefer zero-dependency core.
- **Audio assets**: royalty-free or self-generated only. Every asset gets a line in `assets/CREDITS.md` (source, license). No copyrighted songs, ever.
- Commits: conventional commits (`feat:`, `fix:`, `perf:`, `docs:`); small and thematic. Never commit directly to `main` — work on `dev` or feature branches.

## 3. Working discipline (applies to every session)

- Chat/output hygiene: never print base64, raw logs, or long dumps to the conversation. Artifacts go to files; show the human only actions, results, and blockers.
- "Done" requires evidence: a passing test run, a file path, a commit SHA, or a running URL. Anything else is reported as "in flight" with the exact gap named.
- Separate verified fact / recorded info / inference / proposal in every status report.
- On failure: read the actual error, classify it (environment / permission / tool-capability / logic), and never retry the same thing unchanged. Record dead ends in HANDOFF.md §Do-not-repeat.
- One clarifying round maximum; otherwise act on the spec and state assumptions inline.

## 4. Do-not-touch / approval-required

- Do not modify `CLAUDE.md` or `PROJECT-SPEC.md` — propose changes in chat; the human edits or approves.
- Do not delete or rewrite `HANDOFF.md` history — append only.
- Approval required before: adding any paid service, any analytics/tracking, any deploy to a public URL, any license change, deleting more than 5 files.

## 5. Scope guards

- No account system, no payments, no backend until the spec's Phase gate says so. MVP is local-first (localStorage/IndexedDB).
- Do not add songs, skins, or modes beyond the current milestone's list. Fun-through-polish beats fun-through-quantity.
- Do not "improve" the visual style toward gradients/glow/3D. The minimal line-art constraint IS the style.

## 6. Session continuity protocol (mandatory)

**On session start** — silently, before any work:
1. Read `CLAUDE.md`, then `HANDOFF.md` (latest entry), then the milestone section of `PROJECT-SPEC.md` referenced there.
2. Verify the reported state cheaply (branch exists? tests pass? file exists?) — treat the note as history, not fact.
3. Open with ONE sentence proving context ("M1 clock+scheduler verified passing; next first action is the jamo automaton"), then proceed. No long recaps.
4. If `HANDOFF.md` is missing or stale, reconstruct from git log + file tree and state explicitly what is verified vs assumed.

**On session end, or at any milestone completion** — append to `HANDOFF.md`:

```
# Handoff — {date} {short title}
## Done (verified)
- {only items with evidence: test output, commit SHA, path}
## Not done / in flight
- {item} — {exact blocker or next step}
## Decisions made by the human this session
- {verbatim-faithful, no embellishment}
## Standing rules added/changed
- {new rules; ALSO propose the CLAUDE.md edit to the human}
## Next first action
- {exactly ONE concrete action}
## Do-not-repeat
- {failures hit and root cause}
```

Rules: write the file FIRST, then tell the human. "Next first action" is exactly one item. When the human states a standing rule mid-session, acknowledge in one line and persist it immediately (HANDOFF.md → propose CLAUDE.md edit); never let it live only in conversation.

## 7. Definition of fun (tiebreaker)

When two implementations are otherwise equal, choose the one that: makes a better sound, gives clearer cause-and-effect within 100ms, or makes the player want one more run. If a debug session leaves you not wanting to play one more round, file that as a bug.
