/**
 * TadakClock — the single time source (CLAUDE.md §1.8, "latency honesty").
 *
 * All timing math uses the audio timeline (`AudioContext.currentTime`,
 * seconds) as the single source of truth. Key events are timestamped with
 * `performance.now()` (milliseconds) at capture and converted ONCE onto the
 * audio timeline through:
 *
 *   audioTime = anchorAudioSec + (tPerfMs - anchorPerfMs) / 1000
 *               - calibrationOffsetMs / 1000
 *
 * - The anchor pair (audio "now" and perf "now" sampled together) pins the
 *   two monotonic timelines to each other.
 * - `calibrationOffsetMs` is the measured end-to-end input latency from the
 *   ASC calibration screen (SPEC §4.5): positive offset means the player's
 *   physical keystrokes arrive that many ms late relative to what they hear,
 *   so we subtract it to recover intent time.
 *
 * The class never touches the DOM; the audio-time source is injected so the
 * engine stays pure TypeScript (CLAUDE.md §2) and fully mockable in tests.
 */

/** Anything that reports "now" in audio-timeline seconds. */
export interface AudioTimeSource {
  now(): number
}

/** An anchor pinning the performance.now() timeline to the audio timeline. */
export interface ClockAnchor {
  anchorAudioSec: number
  anchorPerfMs: number
}

export class TadakClock {
  private anchor: ClockAnchor
  private calibrationOffsetMs: number

  constructor(
    private readonly audioSource: AudioTimeSource,
    private readonly perfNow: () => number,
    calibrationOffsetMs = 0,
  ) {
    this.calibrationOffsetMs = calibrationOffsetMs
    this.anchor = {
      anchorAudioSec: audioSource.now(),
      anchorPerfMs: perfNow(),
    }
  }

  /** Current audio time, seconds. The single source of truth. */
  now(): number {
    return this.audioSource.now()
  }

  /**
   * Re-sample the anchor pair. Call occasionally (e.g. on session start) —
   * both clocks are monotonic but can drift over long sessions.
   */
  reanchor(): void {
    this.anchor = {
      anchorAudioSec: this.audioSource.now(),
      anchorPerfMs: this.perfNow(),
    }
  }

  setCalibrationOffsetMs(offsetMs: number): void {
    this.calibrationOffsetMs = offsetMs
  }

  getCalibrationOffsetMs(): number {
    return this.calibrationOffsetMs
  }

  /**
   * Convert a `performance.now()` timestamp to audio-timeline seconds,
   * applying the stored calibration offset. This is the ONE conversion point
   * (CLAUDE.md §1.8) — nothing else may translate between the timelines.
   */
  perfToAudio(tPerfMs: number): number {
    return perfToAudio(tPerfMs, this.anchor, this.calibrationOffsetMs)
  }
}

/**
 * Pure conversion used by TadakClock and by deterministic replay, where a
 * recorded log is converted with a fixed anchor + offset and must reproduce
 * identical audio times on every run.
 */
export function perfToAudio(
  tPerfMs: number,
  anchor: ClockAnchor,
  calibrationOffsetMs: number,
): number {
  return (
    anchor.anchorAudioSec +
    (tPerfMs - anchor.anchorPerfMs) / 1000 -
    calibrationOffsetMs / 1000
  )
}

/**
 * ASC v1 (SPEC §4.5): reduce tap-error samples to a stored offset.
 * Median, not mean — tap sets reliably contain outliers (the first tap, a
 * double-hit) and the median is robust to them. Pure and NaN-free for use in
 * both the calibration screen and its tests.
 */
export function computeMedianOffsetMs(samplesMs: readonly number[]): number {
  if (samplesMs.length === 0) return 0
  const sorted = [...samplesMs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}
