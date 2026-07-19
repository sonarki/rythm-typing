/**
 * Judge — window-based judgment against a chart of target times.
 *
 * Pure and table-driven (HANDOFF-BRIEF §3.5): the window table is data, not
 * branching logic, so difficulty/mode tuning never edits code. All times are
 * audio-timeline seconds; all judgment consumes `judgeTime()` values — the
 * honest clock — never render-snapped times (CLAUDE.md §1.4).
 */

export type Judgment = 'perfect' | 'good' | 'late' | 'miss'

/** Ordered, widening windows. |Δ| ≤ ms/1000 → that judgment. */
export interface JudgeWindow {
  judgment: Exclude<Judgment, 'miss'>
  ms: number
}

/**
 * Default table. 'late' is the outermost catchable window — the hit counts,
 * scored low. Beyond it (or no hit at all) is a miss. Tunable per mode.
 */
export const DEFAULT_WINDOWS: readonly JudgeWindow[] = [
  { judgment: 'perfect', ms: 30 },
  { judgment: 'good', ms: 80 },
  { judgment: 'late', ms: 160 },
]

/** A single note target on the audio timeline. */
export interface ChartNote {
  timeSec: number
  /** Key code expected for the note ('' = any key). */
  code: string
}

/** One judged hit: which note, which input, verdict, signed error. */
export interface JudgedHit {
  noteIndex: number
  judgment: Judgment
  /** Signed timing error, seconds (+ = late). NaN for unhit misses. */
  deltaSec: number
}

/** Judge a single timing delta (seconds, signed) against a window table. */
export function judgeDelta(
  deltaSec: number,
  windows: readonly JudgeWindow[] = DEFAULT_WINDOWS,
): Judgment {
  const absMs = Math.abs(deltaSec) * 1000
  for (const w of windows) {
    if (absMs <= w.ms) return w.judgment
  }
  return 'miss'
}

/**
 * Judge a full performance: each chart note is matched to the earliest
 * unconsumed input with a matching code inside the widest window; every note
 * gets exactly one verdict (unmatched notes are misses). Inputs are consumed
 * at most once. Deterministic: same chart + same inputs → same output array.
 */
export function judgeChart(
  chart: readonly ChartNote[],
  inputs: readonly { timeSec: number; code: string }[],
  windows: readonly JudgeWindow[] = DEFAULT_WINDOWS,
): JudgedHit[] {
  const widestSec = (windows[windows.length - 1]?.ms ?? 0) / 1000
  const consumed = new Array<boolean>(inputs.length).fill(false)
  const results: JudgedHit[] = []

  chart.forEach((note, noteIndex) => {
    let best = -1
    let bestDelta = Number.POSITIVE_INFINITY
    inputs.forEach((input, i) => {
      if (consumed[i]) return
      if (note.code !== '' && input.code !== note.code) return
      const delta = input.timeSec - note.timeSec
      if (Math.abs(delta) <= widestSec && Math.abs(delta) < Math.abs(bestDelta)) {
        best = i
        bestDelta = delta
      }
    })
    if (best >= 0) {
      consumed[best] = true
      results.push({
        noteIndex,
        judgment: judgeDelta(bestDelta, windows),
        deltaSec: bestDelta,
      })
    } else {
      results.push({ noteIndex, judgment: 'miss', deltaSec: Number.NaN })
    }
  })

  return results
}
