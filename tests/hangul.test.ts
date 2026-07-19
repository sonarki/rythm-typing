import { describe, expect, it } from 'vitest'
import {
  HangulAutomaton,
  composeSyllable,
  decomposeSyllable,
  decomposeText,
  strokeCounts,
  syllableToJamoKeys,
  keyToJamo,
  JAMO_TO_KEYSTROKE,
} from '../src/core/hangul'

/** Type a jamo sequence with auto-incrementing timestamps. */
function typeJamo(seq: string[], auto = new HangulAutomaton()): HangulAutomaton {
  seq.forEach((j, i) => auto.feedJamo(j, 1000 + i * 100))
  return auto
}

describe('jamo composition math', () => {
  it('composes and decomposes the golden syllables', () => {
    expect(composeSyllable('ㄱ', 'ㅏ', 'ㅄ')).toBe('값')
    expect(composeSyllable('ㄷ', 'ㅏ', 'ㄺ')).toBe('닭')
    expect(composeSyllable('ㅇ', 'ㅚ')).toBe('외')
    expect(composeSyllable('ㅇ', 'ㅢ')).toBe('의')
    expect(decomposeSyllable('값')).toEqual({ initial: 'ㄱ', medial: 'ㅏ', final: 'ㅄ' })
    expect(decomposeSyllable('닭')).toEqual({ initial: 'ㄷ', medial: 'ㅏ', final: 'ㄺ' })
    expect(decomposeSyllable('외')).toEqual({ initial: 'ㅇ', medial: 'ㅚ', final: '' })
    expect(decomposeSyllable('의')).toEqual({ initial: 'ㅇ', medial: 'ㅢ', final: '' })
  })
  it('rejects non-Hangul input', () => {
    expect(() => decomposeSyllable('a')).toThrow(RangeError)
    expect(() => composeSyllable('x', 'ㅏ')).toThrow(RangeError)
  })
})

describe('2-beolsik layout', () => {
  it('maps plain and shifted keys', () => {
    expect(keyToJamo('KeyR', false)).toBe('ㄱ')
    expect(keyToJamo('KeyR', true)).toBe('ㄲ')
    expect(keyToJamo('KeyK', false)).toBe('ㅏ')
    expect(keyToJamo('KeyK', true)).toBe('ㅏ') // no shift variant → base
    expect(keyToJamo('Space', false)).toBeNull()
  })
  it('inverse map covers every jamo the layout can type', () => {
    expect(JAMO_TO_KEYSTROKE['ㄲ']).toEqual({ code: 'KeyR', shift: true })
    expect(JAMO_TO_KEYSTROKE['ㅖ']).toEqual({ code: 'KeyP', shift: true })
  })
})

describe('HangulAutomaton — golden set', () => {
  it('값: ㄱㅏㅂㅅ composes with double final ㅄ', () => {
    const a = typeJamo(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ'])
    expect(a.getText()).toBe('값')
  })
  it('닭: ㄷㅏㄹㄱ composes with double final ㄺ', () => {
    const a = typeJamo(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ'])
    expect(a.getText()).toBe('닭')
  })
  it('외: ㅇㅗㅣ composes compound vowel ㅚ', () => {
    const a = typeJamo(['ㅇ', 'ㅗ', 'ㅣ'])
    expect(a.getText()).toBe('외')
  })
  it('의: ㅇㅡㅣ composes compound vowel ㅢ', () => {
    const a = typeJamo(['ㅇ', 'ㅡ', 'ㅣ'])
    expect(a.getText()).toBe('의')
  })
  it('안녕하세요 via raw key codes', () => {
    const a = new HangulAutomaton()
    const keys: [string, boolean][] = [
      ['KeyD', false], ['KeyK', false], ['KeyS', false], // 안
      ['KeyS', false], ['KeyU', false], ['KeyD', false], // 녕
      ['KeyG', false], ['KeyK', false], // 하
      ['KeyT', false], ['KeyP', false], // 세
      ['KeyD', false], ['KeyY', false], // 요
    ]
    keys.forEach(([code, shift], i) => a.feedKey(code, shift, i))
    expect(a.getText()).toBe('안녕하세요')
  })
})

describe('HangulAutomaton — 도깨비불 backtracking', () => {
  it('single final migrates: 각+ㅣ → 가기', () => {
    const a = typeJamo(['ㄱ', 'ㅏ', 'ㄱ', 'ㅣ'])
    expect(a.getText()).toBe('가기')
  })
  it('double final splits: 값+ㅏ → 갑사', () => {
    const a = typeJamo(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ', 'ㅏ'])
    expect(a.getText()).toBe('갑사')
  })
  it('닭+ㅣ → 달기', () => {
    const a = typeJamo(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ', 'ㅣ'])
    expect(a.getText()).toBe('달기')
  })
  it('shift-double final migrates whole: 있+ㅓ → 이써', () => {
    const a = typeJamo(['ㅇ', 'ㅣ', 'ㅆ', 'ㅓ'])
    expect(a.getText()).toBe('이써')
  })
  it('migrated jamo event re-roles to initial of the new syllable', () => {
    const a = typeJamo(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ', 'ㅏ'])
    a.flush()
    const committed = a.getCommitted()
    expect(committed.map((c) => c.text)).toEqual(['갑', '사'])
    expect(committed[1]!.jamoEvents.map((e) => [e.jamo, e.role])).toEqual([
      ['ㅅ', 'initial'],
      ['ㅏ', 'medial'],
    ])
  })
})

describe('HangulAutomaton — boundaries and oddities', () => {
  it('double consonants via shift: ㄲㅏ → 까', () => {
    const a = new HangulAutomaton()
    a.feedKey('KeyR', true, 0)
    a.feedKey('KeyK', false, 1)
    expect(a.getText()).toBe('까')
  })
  it('un-final-able consonant starts a new syllable: 가+ㄸ+ㅏ → 가따', () => {
    const a = typeJamo(['ㄱ', 'ㅏ', 'ㄸ', 'ㅏ'])
    expect(a.getText()).toBe('가따')
  })
  it('two plain consonants never merge: ㄱㄱ → ㄱㄱ', () => {
    const a = typeJamo(['ㄱ', 'ㄱ'])
    expect(a.getText()).toBe('ㄱㄱ')
  })
  it('vowel-only then consonant then vowel: ㅏㄱㅏ → ㅏ가', () => {
    const a = typeJamo(['ㅏ', 'ㄱ', 'ㅏ'])
    expect(a.getText()).toBe('ㅏ가')
  })
  it('non-combining vowels split: ㅏ+ㅗ → ㅏㅗ', () => {
    const a = typeJamo(['ㅇ', 'ㅏ', 'ㅗ'])
    expect(a.getText()).toBe('아ㅗ')
  })
  it('non-jamo key returns false and does not disturb composition', () => {
    const a = new HangulAutomaton()
    a.feedKey('KeyR', false, 0)
    expect(a.feedKey('Digit1', false, 1)).toBe(false)
    a.feedKey('KeyK', false, 2)
    expect(a.getText()).toBe('가')
  })
  it('emits per-jamo timestamped events in input order', () => {
    const a = typeJamo(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ'])
    expect(a.getJamoEvents().map((e) => e.jamo)).toEqual(['ㄷ', 'ㅏ', 'ㄹ', 'ㄱ'])
    expect(a.getJamoEvents().map((e) => e.tPerf)).toEqual([1000, 1100, 1200, 1300])
    expect(a.getJamoEvents().map((e) => e.role)).toEqual([
      'initial', 'medial', 'final', 'final',
    ])
  })
  it('notifies syllable listeners on commit', () => {
    const a = new HangulAutomaton()
    const seen: string[] = []
    a.onSyllable((s) => seen.push(s.text))
    typeJamo(['ㄱ', 'ㅏ', 'ㄱ', 'ㅣ'], a)
    a.flush()
    expect(seen).toEqual(['가', '기'])
  })
})

describe('decomposeText — stroke counts (§4.1 analysis)', () => {
  it('golden stroke counts: 값=4 닭=4 외=3 의=3', () => {
    expect(strokeCounts('값닭외의')).toEqual([4, 4, 3, 3])
  })
  it('shift doubles are ONE stroke: 까=2, 있=3', () => {
    expect(strokeCounts('까')).toEqual([2])
    expect(strokeCounts('있')).toEqual([3])
  })
  it('English letters and spaces are one stroke each', () => {
    expect(strokeCounts('go on')).toEqual([1, 1, 1, 1, 1])
    expect(decomposeText('Go')[0]!.strokes[0]).toEqual({ code: 'KeyG', shift: true })
  })
  it('값 keystrokes spell ㄱㅏㅂㅅ on the physical layout', () => {
    expect(syllableToJamoKeys('값')).toEqual(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ'])
    expect(decomposeText('값')[0]!.strokes.map((s) => s.code)).toEqual([
      'KeyR', 'KeyK', 'KeyQ', 'KeyT',
    ])
  })
})

describe('round trip: decomposeText → automaton reproduces the text', () => {
  it.each(['값', '닭', '외', '의', '왜', '뷁', '안녕하세요', '한글', '띄어쓰기'])(
    'round-trips %s',
    (word) => {
      const a = new HangulAutomaton()
      let t = 0
      for (const cs of decomposeText(word)) {
        for (const ks of cs.strokes) a.feedKey(ks.code, ks.shift, t++)
      }
      expect(a.getText()).toBe(word)
    },
  )
})
