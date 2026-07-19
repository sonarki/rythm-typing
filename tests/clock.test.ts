import { describe, expect, it } from 'vitest'
import {
  TadakClock,
  perfToAudio,
  computeMedianOffsetMs,
  judgeTime,
  renderTime,
  nearestSubdivision,
  DEFAULT_GRACE_CONFIG,
  type SubdivisionGrid,
} from '../src/core/clock'

const grid: SubdivisionGrid = { originSec: 10, intervalSec: 0.125 } // 16ths @120BPM

describe('Grace Clock — judgeTime', () => {
  it('is the identity: judgment is honest', () => {
    expect(judgeTime(12.3456)).toBe(12.3456)
    expect(judgeTime(0)).toBe(0)
  })
})

describe('Grace Clock — nearestSubdivision', () => {
  it('finds the nearest grid point in both directions', () => {
    expect(nearestSubdivision(10.07, grid)).toBeCloseTo(10.125, 10)
    expect(nearestSubdivision(10.05, grid)).toBeCloseTo(10.0, 10)
    expect(nearestSubdivision(9.93, grid)).toBeCloseTo(9.875, 10)
  })
  it('rejects a non-positive interval', () => {
    expect(() => nearestSubdivision(1, { originSec: 0, intervalSec: 0 })).toThrow(
      RangeError,
    )
  })
})

describe('Grace Clock — renderTime', () => {
  it('snaps inside the window', () => {
    // 30ms early with an 80ms window (±40ms) → lands ON the subdivision
    expect(renderTime(10.125 - 0.03, grid, 80)).toBeCloseTo(10.125, 10)
  })
  it('does not snap outside the window', () => {
    const t = 10.125 - 0.05 // 50ms early, window ±40ms
    expect(renderTime(t, grid, 80)).toBeCloseTo(t, 10)
  })
  it('window of 0 disables snapping entirely', () => {
    const t = 10.1251
    expect(renderTime(t, grid, 0)).toBe(t)
  })
  it('never alters what judgeTime sees (honest vs kind split)', () => {
    const t = 10.125 - 0.02
    expect(judgeTime(t)).toBe(t)
    expect(renderTime(t, grid, DEFAULT_GRACE_CONFIG.snapWindowMs)).not.toBe(
      judgeTime(t),
    )
  })
})

describe('TadakClock — perf→audio conversion', () => {
  it('converts through the anchor with the calibration offset', () => {
    const anchor = { anchorAudioSec: 5, anchorPerfMs: 1000 }
    // 250ms after the anchor, 10ms measured latency
    expect(perfToAudio(1250, anchor, 10)).toBeCloseTo(5.24, 10)
    expect(perfToAudio(1250, anchor, 0)).toBeCloseTo(5.25, 10)
  })

  it('class wrapper anchors at construction and re-anchors on demand', () => {
    let audioNow = 2
    let perfNow = 500
    const clock = new TadakClock({ now: () => audioNow }, () => perfNow, 0)
    expect(clock.perfToAudio(600)).toBeCloseTo(2.1, 10)
    expect(clock.now()).toBe(2)

    audioNow = 9
    perfNow = 7500
    clock.reanchor()
    expect(clock.perfToAudio(7500)).toBeCloseTo(9, 10)
  })

  it('stores and applies a mutable calibration offset', () => {
    const clock = new TadakClock({ now: () => 0 }, () => 0, 0)
    clock.setCalibrationOffsetMs(20)
    expect(clock.getCalibrationOffsetMs()).toBe(20)
    expect(clock.perfToAudio(100)).toBeCloseTo(0.08, 10)
  })
})

describe('computeMedianOffsetMs (ASC v1)', () => {
  it('returns 0 for no samples', () => {
    expect(computeMedianOffsetMs([])).toBe(0)
  })
  it('odd count → middle value', () => {
    expect(computeMedianOffsetMs([30, -5, 10])).toBe(10)
  })
  it('even count → mean of middle two', () => {
    expect(computeMedianOffsetMs([1, 2, 3, 100])).toBe(2.5)
  })
  it('is robust to outliers (the reason it is a median)', () => {
    const taps = [12, 14, 13, 15, 11, 400, 13, 12] // one double-hit outlier
    expect(computeMedianOffsetMs(taps)).toBe(13)
  })
  it('does not mutate its input', () => {
    const samples = [3, 1, 2]
    computeMedianOffsetMs(samples)
    expect(samples).toEqual([3, 1, 2])
  })
})
