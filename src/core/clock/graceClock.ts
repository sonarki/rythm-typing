/**
 * # Grace Clock — dual-clock forgiveness engine (patent-track module, SPEC §4.2)
 *
 * ## Novel mechanism (invention-disclosure notes — keep current)
 * A rhythm-input system that runs TWO timelines over the same input event:
 *
 * 1. **Judgment Clock** — `judgeTime()` returns the true, unmodified musical
 *    time of the input. Scoring/statistics consume ONLY this value, so the
 *    score is always honest (CLAUDE.md §1.4).
 * 2. **Render Clock** — `renderTime()` returns the time at which the *audible/
 *    visual result* of the input is scheduled: micro-quantized ("snapped") to
 *    the nearest musical subdivision, but only when the input falls within a
 *    psychoacoustic snap window around that subdivision. Outside the window
 *    the input renders at its true time (it is a miss-feel anyway; snapping
 *    it would feel disconnected).
 *
 * The claim sketch: "separating the input-evaluation timeline from the
 * auditory-rendering timeline with skill-adaptive quantization in a rhythm
 * input system." The two functions are deliberately pure and separate so the
 * boundary of the claim is visible in code.
 *
 * ## Inputs / outputs
 * - Input event time: seconds on the audio timeline (see `TadakClock` for the
 *   `performance.now()` → audio-time conversion).
 * - Subdivision grid: `{ originSec, intervalSec }` — e.g. 16th notes at
 *   120 BPM → intervalSec = 0.125.
 * - Output: seconds on the same audio timeline.
 *
 * ## Tunable parameters (GraceClockConfig)
 * - `snapWindowMs` — full width of the snap window around each subdivision.
 *   Skill-adaptive: novice ±70ms (width 140) → expert ±15ms (width 30).
 *   Context-adaptive: Flow Mode = full snap (window ≥ interval, everything
 *   lands in the pocket); ranked = near-zero.
 * - The adaptive policy itself (how skill maps to width) lives with the mode
 *   logic in later milestones; M0 exposes the mechanism, not the policy.
 */

/** A subdivision grid on the audio timeline. */
export interface SubdivisionGrid {
  /** Audio time (seconds) of any downbeat the grid is anchored to. */
  originSec: number
  /** Seconds between adjacent subdivisions (> 0). */
  intervalSec: number
}

/** Tunable parameters for the Grace Clock. All widths in milliseconds. */
export interface GraceClockConfig {
  /** Full width of the render snap window, ms. 0 disables snapping. */
  snapWindowMs: number
}

/** Default: mid-skill forgiveness (±40ms). */
export const DEFAULT_GRACE_CONFIG: GraceClockConfig = { snapWindowMs: 80 }

/**
 * Judgment Clock: the honest timeline.
 *
 * Returns the input's true audio time, unmodified. Exists as a named pure
 * function so call sites make the honest/kind split explicit and auditable.
 */
export function judgeTime(inputAudioTimeSec: number): number {
  return inputAudioTimeSec
}

/** Nearest grid point to a time, on the given subdivision grid. */
export function nearestSubdivision(
  tSec: number,
  grid: SubdivisionGrid,
): number {
  if (!(grid.intervalSec > 0)) {
    throw new RangeError(`intervalSec must be > 0, got ${grid.intervalSec}`)
  }
  const n = Math.round((tSec - grid.originSec) / grid.intervalSec)
  return grid.originSec + n * grid.intervalSec
}

/**
 * Render Clock: the kind timeline.
 *
 * If the input falls within ±(snapWindowMs/2) of the nearest subdivision, the
 * audible result is scheduled exactly ON that subdivision; otherwise it is
 * scheduled at the true input time. Pure — same inputs, same output, which is
 * what makes deterministic replay (CLAUDE.md §2) possible.
 */
export function renderTime(
  inputAudioTimeSec: number,
  grid: SubdivisionGrid,
  snapWindowMs: number,
): number {
  if (snapWindowMs <= 0) return inputAudioTimeSec
  const snapped = nearestSubdivision(inputAudioTimeSec, grid)
  const halfWindowSec = snapWindowMs / 2 / 1000
  return Math.abs(inputAudioTimeSec - snapped) <= halfWindowSec
    ? snapped
    : inputAudioTimeSec
}
