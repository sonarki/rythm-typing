/**
 * Jamo tables and syllable composition math (Unicode Hangul algorithm).
 * Pure data + pure functions; shared by the automaton (keys → text) and the
 * decomposer (text → keys). No DOM, no state.
 */

/** 초성 19, in Unicode order. */
export const INITIALS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

/** 중성 21, in Unicode order. */
export const MEDIALS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const

/** 종성 28 (index 0 = none), in Unicode order. */
export const FINALS = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

const HANGUL_BASE = 0xac00
const HANGUL_END = 0xd7a3

/** 복모음: first + second → compound medial. */
export const COMPOUND_MEDIALS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'ㅗ': { 'ㅏ': 'ㅘ', 'ㅐ': 'ㅙ', 'ㅣ': 'ㅚ' },
  'ㅜ': { 'ㅓ': 'ㅝ', 'ㅔ': 'ㅞ', 'ㅣ': 'ㅟ' },
  'ㅡ': { 'ㅣ': 'ㅢ' },
}

/** 겹받침: first + second → double final. */
export const DOUBLE_FINALS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'ㄱ': { 'ㅅ': 'ㄳ' },
  'ㄴ': { 'ㅈ': 'ㄵ', 'ㅎ': 'ㄶ' },
  'ㄹ': { 'ㄱ': 'ㄺ', 'ㅁ': 'ㄻ', 'ㅂ': 'ㄼ', 'ㅅ': 'ㄽ', 'ㅌ': 'ㄾ', 'ㅍ': 'ㄿ', 'ㅎ': 'ㅀ' },
  'ㅂ': { 'ㅅ': 'ㅄ' },
}

/** Inverse of DOUBLE_FINALS: double final → [first, second]. */
export const DOUBLE_FINAL_SPLIT: Readonly<Record<string, readonly [string, string]>> = {
  'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'],
  'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'],
  'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'],
}

/** Inverse of COMPOUND_MEDIALS: compound medial → [first, second]. */
export const COMPOUND_MEDIAL_SPLIT: Readonly<Record<string, readonly [string, string]>> = {
  'ㅘ': ['ㅗ', 'ㅏ'], 'ㅙ': ['ㅗ', 'ㅐ'], 'ㅚ': ['ㅗ', 'ㅣ'],
  'ㅝ': ['ㅜ', 'ㅓ'], 'ㅞ': ['ㅜ', 'ㅔ'], 'ㅟ': ['ㅜ', 'ㅣ'], 'ㅢ': ['ㅡ', 'ㅣ'],
}

const MEDIAL_SET = new Set<string>(MEDIALS)
const INITIAL_SET = new Set<string>(INITIALS)
const FINAL_SET = new Set<string>(FINALS.filter((f) => f !== ''))

export function isVowelJamo(j: string): boolean {
  return MEDIAL_SET.has(j)
}

export function isConsonantJamo(j: string): boolean {
  return INITIAL_SET.has(j) || FINAL_SET.has(j)
}

export function canBeInitial(j: string): boolean {
  return INITIAL_SET.has(j)
}

/** ㄸ/ㅃ/ㅉ can never close a syllable. */
export function canBeFinal(j: string): boolean {
  return FINAL_SET.has(j)
}

export function isHangulSyllable(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0
  return c >= HANGUL_BASE && c <= HANGUL_END
}

/** Compose initial + medial (+ final) jamo into one syllable character. */
export function composeSyllable(
  initial: string,
  medial: string,
  final = '',
): string {
  const i = INITIALS.indexOf(initial as (typeof INITIALS)[number])
  const m = MEDIALS.indexOf(medial as (typeof MEDIALS)[number])
  const f = FINALS.indexOf(final as (typeof FINALS)[number])
  if (i < 0 || m < 0 || f < 0) {
    throw new RangeError(`cannot compose: ${initial} ${medial} ${final}`)
  }
  return String.fromCodePoint(HANGUL_BASE + (i * 21 + m) * 28 + f)
}

export interface SyllableJamo {
  initial: string
  medial: string
  /** '' when the syllable is open. */
  final: string
}

/** Decompose a Hangul syllable character into its jamo. */
export function decomposeSyllable(ch: string): SyllableJamo {
  const code = (ch.codePointAt(0) ?? 0) - HANGUL_BASE
  if (code < 0 || code > HANGUL_END - HANGUL_BASE) {
    throw new RangeError(`not a Hangul syllable: ${ch}`)
  }
  const f = code % 28
  const m = ((code - f) / 28) % 21
  const i = Math.floor(code / (21 * 28))
  return { initial: INITIALS[i]!, medial: MEDIALS[m]!, final: FINALS[f]! }
}
