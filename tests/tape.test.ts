import { describe, expect, it } from 'vitest'
import { buildTapeScore, encodeWavPcm16 } from '../src/core/tape'
import { LESSONS, PercussionSession } from '../src/core/percussion'

const lesson = LESSONS[0]!
const START = 5

function playedSession() {
  const s = new PercussionSession(lesson, START)
  for (const t of s.responseTargets.filter((t) => t.phraseIndex <= 1)) {
    s.recordHit(t.code, t.timeSec + 0.01)
  }
  return s
}

describe('buildTapeScore', () => {
  it('starts with a count-in and places hits at Grace-rendered times', () => {
    const s = playedSession()
    const summary = s.finalize()
    const score = buildTapeScore(summary, summary.hits, s.callEvents, START, {
      bpm: lesson.bpm,
    })
    const secPerBeat = 60 / lesson.bpm
    // 4 count-in hats at beat times
    const countIn = score.events.slice(0, 4)
    expect(countIn.map((e) => e.voice)).toEqual(['hat', 'hat', 'hat', 'hat'])
    expect(countIn.map((e) => e.timeSec)).toEqual([
      0,
      secPerBeat,
      2 * secPerBeat,
      3 * secPerBeat,
    ])
    expect(score.performanceStartSec).toBeCloseTo(4 * secPerBeat, 10)
    // hits shifted into tape time
    const firstHit = summary.hits[0]!
    expect(
      score.events.some(
        (e) =>
          Math.abs(
            e.timeSec -
              (score.performanceStartSec + (firstHit.renderTimeSec - START)),
          ) < 1e-9,
      ),
    ).toBe(true)
  })

  it('layered phrases echo under later phrases at soft gain', () => {
    const s = playedSession() // phrases 0 & 1 played → both layered
    const summary = s.finalize()
    expect(summary.layeredCount).toBe(2)
    const score = buildTapeScore(summary, summary.hits, s.callEvents, START, {
      bpm: lesson.bpm,
      layerGain: 0.33,
    })
    expect(score.events.some((e) => e.gain === 0.33)).toBe(true)
  })

  it('caps duration — a partial tape is still a tape', () => {
    const s = playedSession()
    const summary = s.finalize()
    const score = buildTapeScore(summary, summary.hits, s.callEvents, START, {
      bpm: lesson.bpm,
      maxDurationSec: 5,
      tailSec: 1,
    })
    expect(score.events.every((e) => e.timeSec <= 5)).toBe(true)
    expect(score.durationSec).toBeLessThanOrEqual(6)
    expect(score.events.length).toBeGreaterThan(0)
  })

  it('an empty session still produces a count-in tape (§1.5)', () => {
    const s = new PercussionSession(lesson, START)
    const summary = s.finalize()
    const score = buildTapeScore(summary, summary.hits, s.callEvents, START, {
      bpm: lesson.bpm,
    })
    expect(score.events).toHaveLength(4)
    expect(score.durationSec).toBeGreaterThan(0)
  })

  it('is deterministic', () => {
    const s = playedSession()
    const summary = s.finalize()
    const build = () =>
      JSON.stringify(
        buildTapeScore(summary, summary.hits, s.callEvents, START, {
          bpm: lesson.bpm,
        }),
      )
    expect(build()).toBe(build())
  })
})

describe('encodeWavPcm16', () => {
  const ascii = (buf: ArrayBuffer, from: number, len: number) =>
    String.fromCharCode(...new Uint8Array(buf, from, len))

  it('writes a valid RIFF/WAVE PCM16 header', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1])
    const buf = encodeWavPcm16([samples, samples], 44100)
    const view = new DataView(buf)
    expect(ascii(buf, 0, 4)).toBe('RIFF')
    expect(ascii(buf, 8, 4)).toBe('WAVE')
    expect(ascii(buf, 12, 4)).toBe('fmt ')
    expect(ascii(buf, 36, 4)).toBe('data')
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(2) // stereo
    expect(view.getUint32(24, true)).toBe(44100)
    expect(view.getUint16(34, true)).toBe(16) // bit depth
    expect(view.getUint32(40, true)).toBe(4 * 2 * 2) // frames×ch×2 bytes
    expect(buf.byteLength).toBe(44 + 16)
  })

  it('scales and clamps samples to int16', () => {
    const buf = encodeWavPcm16([new Float32Array([1, -1, 2, -2, 0])], 8000)
    const view = new DataView(buf)
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
    expect(view.getInt16(48, true)).toBe(0x7fff) // clamped
    expect(view.getInt16(50, true)).toBe(-0x8000) // clamped
    expect(view.getInt16(52, true)).toBe(0)
  })

  it('rejects empty or ragged channel sets', () => {
    expect(() => encodeWavPcm16([], 44100)).toThrow(RangeError)
    expect(() =>
      encodeWavPcm16([new Float32Array(2), new Float32Array(3)], 44100),
    ).toThrow(RangeError)
  })
})
