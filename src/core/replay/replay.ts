/**
 * Deterministic replay (CLAUDE.md §2, HANDOFF-BRIEF §3.7).
 *
 * Runs a recorded input log through clock-conversion → scheduler → judge with
 * everything injected and nothing wall-clock-dependent, so the same log +
 * chart + calibration always reproduces byte-identical judgment output and
 * an identical audio schedule. This is the engine the M0 determinism test
 * exercises, and the seed of the M2 Tape Renderer (same pipeline into an
 * OfflineAudioContext).
 */
import { perfToAudio, type ClockAnchor } from '../clock'
import { LookaheadScheduler } from '../scheduler'
import {
  judgeChart,
  DEFAULT_WINDOWS,
  type ChartNote,
  type JudgedHit,
  type JudgeWindow,
} from '../judge'
import type { InputLogEntry } from '../input'

export interface ReplayConfig {
  anchor: ClockAnchor
  calibrationOffsetMs: number
  windows?: readonly JudgeWindow[]
  /** Scheduler tick period for the offline run, ms. Default 25. */
  tickMs?: number
  /** Scheduler horizon, ms. Default 100. */
  horizonMs?: number
}

export interface ReplayResult {
  /** Judgments in chart order — the honest output. */
  judgments: JudgedHit[]
  /** Exact audio times (sec) the scheduler fired chart beats at. */
  scheduledBeatTimes: number[]
  /** Canonical serialization for byte-identity assertions. */
  serialized: string
}

/**
 * Replay a log against a chart, offline. The scheduler is driven by a
 * simulated clock stepped in `tickMs` increments from the first to the last
 * relevant time — no timers, no real AudioContext.
 */
export function replayLog(
  chart: readonly ChartNote[],
  log: readonly InputLogEntry[],
  config: ReplayConfig,
): ReplayResult {
  const windows = config.windows ?? DEFAULT_WINDOWS
  const tickSec = (config.tickMs ?? 25) / 1000

  // 1) One conversion point: perf timestamps → audio timeline.
  const inputs = log.map((e) => ({
    code: e.code,
    timeSec: perfToAudio(e.tPerf, config.anchor, config.calibrationOffsetMs),
  }))

  // 2) Offline schedule of every chart beat through the real scheduler.
  const scheduledBeatTimes: number[] = []
  let simNow = 0
  const scheduler = new LookaheadScheduler<number>(
    { now: () => simNow },
    (ev) => scheduledBeatTimes.push(ev.timeSec),
    { tickMs: config.tickMs ?? 25, horizonMs: config.horizonMs ?? 100 },
  )
  for (const note of chart) scheduler.schedule(note.timeSec, note.timeSec)

  const endSec = chart.reduce((m, n) => Math.max(m, n.timeSec), 0) + 1
  for (simNow = 0; simNow <= endSec && scheduler.pending() > 0; simNow += tickSec) {
    scheduler.tick(simNow)
  }

  // 3) Honest judgment of the converted inputs.
  const judgments = judgeChart(chart, inputs, windows)

  return {
    judgments,
    scheduledBeatTimes,
    serialized: JSON.stringify({ judgments, scheduledBeatTimes }),
  }
}
