import { describe, expect, it } from 'vitest'
import { compileSyllableBeat, snapToDownbeat } from '../src/core/beatmap'

const config = { bpm: 120, startSec: 2 } // 0.5s per beat

describe('snapToDownbeat', () => {
  it('snaps up to the next bar start', () => {
    expect(snapToDownbeat(0, 4)).toBe(0)
    expect(snapToDownbeat(1, 4)).toBe(4)
    expect(snapToDownbeat(4, 4)).toBe(4)
    expect(snapToDownbeat(5, 4)).toBe(8)
  })
})

describe('compileSyllableBeat — Korean', () => {
  it('one note per syllable, sequential beats within a word', () => {
    const map = compileSyllableBeat('나는', config)
    expect(map.notes.map((n) => n.label)).toEqual(['나', '는'])
    expect(map.notes.map((n) => n.beat)).toEqual([0, 1])
    expect(map.notes.map((n) => n.timeSec)).toEqual([2, 2.5])
  })

  it('word boundaries snap to downbeats', () => {
    const map = compileSyllableBeat('나는 밥', config)
    const bab = map.notes.find((n) => n.label === '밥')!
    expect(bab.beat).toBe(4) // next bar after 나(0) 는(1)
    expect(bab.isWordStart).toBe(true)
    expect(map.notes[1]!.isWordStart).toBe(false)
  })

  it('carries §4.1 stroke counts on every note (값=4, 외=3)', () => {
    const map = compileSyllableBeat('값 외', config)
    expect(map.notes.map((n) => n.strokeCount)).toEqual([4, 3])
    expect(map.notes[0]!.strokes.map((s) => s.code)).toEqual([
      'KeyR', 'KeyK', 'KeyQ', 'KeyT',
    ])
  })

  it('punctuation becomes a rest, not a note', () => {
    const map = compileSyllableBeat('가, 나', config)
    expect(map.notes.map((n) => n.label)).toEqual(['가', '나'])
    // 가 at 0; comma rests beat 1; 나 snaps to next downbeat (4)
    expect(map.notes[1]!.beat).toBe(4)
  })
})

describe('compileSyllableBeat — English', () => {
  it('one note per character, words snapped to downbeats', () => {
    const map = compileSyllableBeat('go on', config)
    expect(map.notes.map((n) => n.label)).toEqual(['g', 'o', 'o', 'n'])
    expect(map.notes.map((n) => n.beat)).toEqual([0, 1, 4, 5])
    expect(map.notes.every((n) => n.strokeCount === 1)).toBe(true)
  })
})

describe('compileSyllableBeat — config dials and determinism', () => {
  it('beatsPerNote stretches density; beatsPerBar moves downbeats', () => {
    const map = compileSyllableBeat('가나 다', {
      ...config,
      beatsPerNote: 2,
      beatsPerBar: 8,
    })
    expect(map.notes.map((n) => n.beat)).toEqual([0, 2, 8])
  })

  it('mixed KR/EN text compiles in one chart', () => {
    const map = compileSyllableBeat('한글 ok', config)
    expect(map.notes.map((n) => n.label)).toEqual(['한', '글', 'o', 'k'])
  })

  it('is deterministic: same text + config → identical serialization', () => {
    const a = JSON.stringify(compileSyllableBeat('값진 하루 ok!', config))
    const b = JSON.stringify(compileSyllableBeat('값진 하루 ok!', config))
    expect(a).toBe(b)
  })

  it('reports chart length in beats', () => {
    const map = compileSyllableBeat('가나', config)
    expect(map.lengthBeats).toBe(2)
  })
})
