import { describe, expect, it } from 'vitest'
import {
  LESSONS,
  PercussionSession,
  LAYER_THRESHOLD,
  HIT_GAIN,
  voiceForKey,
} from '../src/core/percussion'

const lesson = LESSONS[0]! // 첫 그루브: 72 BPM, full snap, 5 phrases
const START = 10

function freshSession() {
  return new PercussionSession(lesson, START)
}

describe('lesson data', () => {
  it('ships exactly 3 lessons with the spec difficulty ramp', () => {
    expect(LESSONS).toHaveLength(3)
    expect(LESSONS.map((l) => l.bpm)).toEqual([72, 88, 104])
    // snap tightens as lessons advance (Grace v1 adaptive dial)
    expect(LESSONS[0]!.snapWindowMs).toBeGreaterThan(LESSONS[1]!.snapWindowMs)
    expect(LESSONS[1]!.snapWindowMs).toBeGreaterThan(LESSONS[2]!.snapWindowMs)
  })
  it('onboarding lesson uses exactly 4 keys (addendum §A.4)', () => {
    expect(lesson.keys).toHaveLength(4)
  })
  it('voiceForKey resolves lesson keys and rejects others', () => {
    expect(voiceForKey(lesson, 'KeyF')).toBe('kick')
    expect(voiceForKey(lesson, 'KeyQ')).toBeNull()
  })
})

describe('session timeline', () => {
  it('lays out call → response per phrase, back to back', () => {
    const s = freshSession()
    const span0 = s.phraseSpan(0)
    expect(span0.callStartSec).toBe(START)
    const phraseLen = 4 * (60 / lesson.bpm)
    expect(span0.responseStartSec).toBeCloseTo(START + phraseLen, 10)
    expect(span0.endSec).toBeCloseTo(START + 2 * phraseLen, 10)
    const span1 = s.phraseSpan(1)
    expect(span1.callStartSec).toBeCloseTo(span0.endSec, 10)
    expect(s.endSec).toBeCloseTo(
      START + lesson.phrases.length * 2 * phraseLen,
      10,
    )
  })
  it('every call step has a mirrored response target one phrase later', () => {
    const s = freshSession()
    expect(s.responseTargets).toHaveLength(s.callEvents.length)
    const phraseLen = 4 * (60 / lesson.bpm)
    s.callEvents.forEach((c, i) => {
      const t = s.responseTargets[i]!
      expect(t.code).toBe(c.code)
      expect(t.timeSec).toBeCloseTo(c.timeSec + phraseLen, 10)
    })
  })
  it('marks phrase-final targets (juice hit-stop points)', () => {
    const s = freshSession()
    const finals = s.responseTargets.filter((t) => t.phraseFinal)
    expect(finals).toHaveLength(lesson.phrases.length)
  })
})

describe('recordHit — honest judgment, kind rendering', () => {
  it('on-time hit is perfect with full gain', () => {
    const s = freshSession()
    const target = s.responseTargets[0]!
    const hit = s.recordHit(target.code, target.timeSec + 0.01)
    expect(hit.kind).toBe('hit')
    expect(hit.judgment).toBe('perfect')
    expect(hit.gain).toBe(HIT_GAIN.perfect)
    expect(hit.deltaSec).toBeCloseTo(0.01, 10)
  })
  it('judgment stays honest while render time snaps (full-snap lesson)', () => {
    const s = freshSession()
    const target = s.responseTargets[0]!
    const t = target.timeSec + 0.06 // 60ms late
    const hit = s.recordHit(target.code, t)
    expect(hit.judgment).toBe('good') // honest: 60ms is good, not perfect
    expect(hit.judgeTimeSec).toBe(t) // judgment clock untouched
    // render clock: full snap pulls the sound onto the 8th grid
    const interval = (60 / lesson.bpm) / 2
    const offGrid = (hit.renderTimeSec - START) / interval
    expect(offGrid).toBeCloseTo(Math.round(offGrid), 10)
    expect(hit.renderTimeSec).not.toBe(t)
  })
  it('same-key targets are consumed once; second hit matches the next one', () => {
    const s = freshSession()
    const kicks = s.responseTargets.filter((t) => t.code === 'KeyF')
    const a = s.recordHit('KeyF', kicks[0]!.timeSec)
    const b = s.recordHit('KeyF', kicks[0]!.timeSec + 0.02)
    expect(a.targetIndex).toBe(kicks[0]!.index)
    expect(b.targetIndex).not.toBe(kicks[0]!.index)
  })
  it('stray hits still render — soft gain, never silence (§1.1)', () => {
    const s = freshSession()
    const stray = s.recordHit('KeyF', START - 5) // way outside any window
    expect(stray.kind).toBe('stray')
    expect(stray.gain).toBe(HIT_GAIN.stray)
    expect(stray.gain).toBeGreaterThan(0)
    expect(Number.isFinite(stray.renderTimeSec)).toBe(true)
  })
  it('unknown-key stray resolves voice null but still carries render info', () => {
    const s = freshSession()
    const stray = s.recordHit('KeyQ', START + 1)
    expect(stray.voice).toBeNull()
    expect(stray.gain).toBeGreaterThan(0)
  })
})

describe('layering and summary', () => {
  function playPhrasePerfectly(s: PercussionSession, phraseIndex: number) {
    for (const t of s.responseTargets.filter((t) => t.phraseIndex === phraseIndex)) {
      s.recordHit(t.code, t.timeSec)
    }
  }

  it('a phrase answered ≥ threshold is layered', () => {
    const s = freshSession()
    playPhrasePerfectly(s, 0)
    expect(s.phraseAccuracy(0)).toBe(1)
    expect(s.isLayered(0)).toBe(true)
    expect(LAYER_THRESHOLD).toBeLessThanOrEqual(1)
  })
  it('an unanswered phrase is not layered and finalizes as misses', () => {
    const s = freshSession()
    playPhrasePerfectly(s, 0)
    const summary = s.finalize()
    expect(summary.phrases[0]!.layered).toBe(true)
    expect(summary.phrases[1]!.layered).toBe(false)
    expect(summary.phrases[1]!.judged.every((j) => j === 'miss')).toBe(true)
    expect(summary.layeredCount).toBe(1)
  })
  it('summary reports honest overall accuracy and mean abs error', () => {
    const s = freshSession()
    playPhrasePerfectly(s, 0)
    const summary = s.finalize()
    const phrase0Targets = s.responseTargets.filter((t) => t.phraseIndex === 0)
    expect(summary.overallAccuracy).toBeCloseTo(
      phrase0Targets.length / s.responseTargets.length,
      10,
    )
    expect(summary.meanAbsErrorMs).toBeCloseTo(0, 6)
  })
  it('is deterministic: same hit sequence → identical serialized summary', () => {
    const run = () => {
      const s = freshSession()
      playPhrasePerfectly(s, 0)
      s.recordHit('KeyJ', s.responseTargets[1]!.timeSec + 0.05)
      return JSON.stringify(s.finalize())
    }
    expect(run()).toBe(run())
  })
  it('finalize works mid-session — quitting still yields a full summary (§1.5)', () => {
    const s = freshSession()
    const summary = s.finalize()
    expect(summary.phrases).toHaveLength(lesson.phrases.length)
    expect(summary.overallAccuracy).toBe(0)
  })
})
