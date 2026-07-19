import { describe, expect, it } from 'vitest'
import { MasteryModel, computeSkillRing, guideLevel } from '../src/core/mastery'

function trained(
  keys: string[],
  opts: { attempts?: number; hit?: boolean; errorMs?: number } = {},
): MasteryModel {
  const m = new MasteryModel()
  const attempts = opts.attempts ?? 6
  for (const key of keys) {
    for (let i = 0; i < attempts; i++) {
      m.record({
        key,
        judgment: (opts.hit ?? true) ? 'perfect' : 'miss',
        errorMs: opts.errorMs ?? 10,
        at: i,
      })
    }
    m.resetChain()
  }
  return m
}

describe('computeSkillRing', () => {
  it('coverage = fraction of keys mastered; precision = mean abs error', () => {
    const m = trained(['a', 'b'], { errorMs: 20 })
    const ring = computeSkillRing(m, ['a', 'b', 'c', 'd'])
    expect(ring.coverage).toBe(0.5)
    expect(ring.precisionMs).toBeCloseTo(20, 10)
  })
  it('keys below minAttempts or minAccuracy do not count as mastered', () => {
    const few = trained(['a'], { attempts: 2 })
    expect(computeSkillRing(few, ['a']).coverage).toBe(0)
    const sloppy = trained(['a'], { hit: false })
    expect(computeSkillRing(sloppy, ['a']).coverage).toBe(0)
  })
  it('no data → coverage 0, precision null', () => {
    const ring = computeSkillRing(new MasteryModel(), ['a', 'b'])
    expect(ring).toEqual({ coverage: 0, precisionMs: null })
  })
  it('empty key set → coverage 0 (no divide-by-zero)', () => {
    expect(computeSkillRing(new MasteryModel(), []).coverage).toBe(0)
  })
})

describe('guideLevel — progressive UI density (§B.1)', () => {
  const keys = ['a', 'b', 'c', 'd']
  it('novice (low coverage) → level 0, full guide', () => {
    expect(guideLevel(new MasteryModel(), keys)).toBe(0)
    expect(guideLevel(trained(['a']), keys)).toBe(0) // 25% < 50%
  })
  it('mid coverage → level 1, outline guide', () => {
    expect(guideLevel(trained(['a', 'b', 'c']), keys)).toBe(1) // 75%
  })
  it('high coverage but loose timing stays level 1', () => {
    expect(guideLevel(trained(keys, { errorMs: 80 }), keys)).toBe(1)
  })
  it('high coverage + tight timing → level 2, minimal lane', () => {
    expect(guideLevel(trained(keys, { errorMs: 12 }), keys)).toBe(2)
  })
})
