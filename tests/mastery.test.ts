import { describe, expect, it } from 'vitest'
import { MasteryModel } from '../src/core/mastery'

describe('MasteryModel — data capture skeleton', () => {
  it('tracks per-key attempts, hits, accuracy, mean abs error', () => {
    const m = new MasteryModel()
    m.record({ key: 'ㄹ', judgment: 'perfect', errorMs: 10, at: 1 })
    m.record({ key: 'ㄹ', judgment: 'good', errorMs: -50, at: 2 })
    m.record({ key: 'ㄹ', judgment: 'miss', errorMs: null, at: 3 })
    const s = m.keyStats('ㄹ')!
    expect(s.attempts).toBe(3)
    expect(s.hits).toBe(2)
    expect(s.accuracy).toBeCloseTo(2 / 3, 10)
    expect(s.meanAbsErrorMs).toBeCloseTo(30, 10) // (10+50)/2, abs
    expect(s.lastAt).toBe(3)
  })

  it('tracks bigrams from consecutive records', () => {
    const m = new MasteryModel()
    m.record({ key: 'ㄱ', judgment: 'perfect', errorMs: 5, at: 1 })
    m.record({ key: 'ㅏ', judgment: 'good', errorMs: 40, at: 2 })
    m.record({ key: 'ㅂ', judgment: 'perfect', errorMs: 8, at: 3 })
    expect(m.bigramStats('ㄱ', 'ㅏ')!.attempts).toBe(1)
    expect(m.bigramStats('ㅏ', 'ㅂ')!.attempts).toBe(1)
    expect(m.bigramStats('ㄱ', 'ㅂ')).toBeNull()
  })

  it('resetChain breaks the bigram link across phrases', () => {
    const m = new MasteryModel()
    m.record({ key: 'a', judgment: 'perfect', errorMs: 1, at: 1 })
    m.resetChain()
    m.record({ key: 'b', judgment: 'perfect', errorMs: 1, at: 2 })
    expect(m.bigramStats('a', 'b')).toBeNull()
  })

  it('supports pattern-tag nodes (겹받침 as its own skill node)', () => {
    const m = new MasteryModel()
    m.record({ key: 'pattern:겹받침', judgment: 'late', errorMs: 120, at: 1 })
    expect(m.keyStats('pattern:겹받침')!.attempts).toBe(1)
  })

  it('unknown keys return null; trackedKeys lists what was seen', () => {
    const m = new MasteryModel()
    expect(m.keyStats('ㅋ')).toBeNull()
    m.record({ key: 'ㅋ', judgment: 'perfect', errorMs: 0, at: 1 })
    expect(m.trackedKeys()).toEqual(['ㅋ'])
  })

  it('round-trips through toJSON/fromJSON', () => {
    const m = new MasteryModel()
    m.record({ key: 'ㄹ', judgment: 'good', errorMs: 33, at: 7 })
    m.record({ key: 'ㅏ', judgment: 'perfect', errorMs: 4, at: 8 })
    const restored = MasteryModel.fromJSON(
      JSON.parse(JSON.stringify(m.toJSON())),
    )
    expect(restored.keyStats('ㄹ')).toEqual(m.keyStats('ㄹ'))
    expect(restored.bigramStats('ㄹ', 'ㅏ')).toEqual(m.bigramStats('ㄹ', 'ㅏ'))
    expect(JSON.stringify(restored.toJSON())).toBe(JSON.stringify(m.toJSON()))
  })

  it('captures data only — no difficulty/decay behavior exists yet', () => {
    // Guard against scope creep: the skeleton must not expose policy.
    const m = new MasteryModel() as unknown as Record<string, unknown>
    expect(m['suggestDifficulty']).toBeUndefined()
    expect(m['decay']).toBeUndefined()
  })
})
