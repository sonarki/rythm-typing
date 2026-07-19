/**
 * M0 determinism proof (HANDOFF-BRIEF §3.7, CLAUDE.md §2):
 * replaying a recorded input log through scheduler + judge twice must produce
 * byte-identical judgment output and identical scheduled times.
 */
import { describe, expect, it } from 'vitest'
import { replayLog } from '../src/core/replay'
import type { ChartNote } from '../src/core/judge'
import type { InputLogEntry } from '../src/core/input'

// A "recorded" session: 8 beats at 90 BPM starting at audio t=2s,
// anchor pins perf 10_000ms ↔ audio 1s, device offset 12ms.
const BEAT = 60 / 90
const chart: ChartNote[] = Array.from({ length: 8 }, (_, i) => ({
  timeSec: 2 + i * BEAT,
  code: 'Space',
}))

// perf-time for audio-time t (given anchor + offset): (t - 1)*1000 + 10000 + 12
const perfAt = (tAudio: number) => (tAudio - 1) * 1000 + 10_000 + 12

const recordedLog: InputLogEntry[] = [
  { code: 'Space', tPerf: perfAt(2.004) }, // perfect
  { code: 'Space', tPerf: perfAt(2 + BEAT + 0.05) }, // good
  { code: 'Space', tPerf: perfAt(2 + 2 * BEAT - 0.1) }, // late (early side)
  // beat 3 skipped → miss
  { code: 'Space', tPerf: perfAt(2 + 4 * BEAT) }, // perfect
  { code: 'KeyX', tPerf: perfAt(2 + 5 * BEAT) }, // wrong key → miss
  { code: 'Space', tPerf: perfAt(2 + 6 * BEAT + 0.02) }, // perfect
  { code: 'Space', tPerf: perfAt(2 + 7 * BEAT + 0.3) }, // outside → miss
]

const config = {
  anchor: { anchorAudioSec: 1, anchorPerfMs: 10_000 },
  calibrationOffsetMs: 12,
}

describe('deterministic replay', () => {
  it('two replays of the same log are byte-identical', () => {
    const first = replayLog(chart, recordedLog, config)
    const second = replayLog(chart, recordedLog, config)

    // Byte-identical judgment output.
    expect(second.serialized).toBe(first.serialized)
    const bytes = (s: string) => new TextEncoder().encode(s)
    expect(bytes(second.serialized)).toEqual(bytes(first.serialized))

    // Identical audio schedule, element by element, exact equality.
    expect(second.scheduledBeatTimes).toEqual(first.scheduledBeatTimes)
    expect(first.scheduledBeatTimes).toHaveLength(chart.length)
  })

  it('the replayed judgments match the session as played', () => {
    const { judgments } = replayLog(chart, recordedLog, config)
    expect(judgments.map((j) => j.judgment)).toEqual([
      'perfect',
      'good',
      'late',
      'miss',
      'perfect',
      'miss',
      'perfect',
      'miss',
    ])
  })

  it('every scheduled beat fires at its exact chart time', () => {
    const { scheduledBeatTimes } = replayLog(chart, recordedLog, config)
    expect(scheduledBeatTimes).toEqual(chart.map((n) => n.timeSec))
  })

  it('changing the calibration offset changes judgment (offset is live)', () => {
    const shifted = replayLog(chart, recordedLog, {
      ...config,
      calibrationOffsetMs: 12 + 60,
    })
    const baseline = replayLog(chart, recordedLog, config)
    expect(shifted.serialized).not.toBe(baseline.serialized)
  })
})
