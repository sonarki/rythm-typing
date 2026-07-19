/**
 * Text → 2-beolsik keystroke stream (the JBC pipeline's first stage,
 * SPEC §4.1). Inverse of the automaton: for any text this produces the exact
 * key sequence a 2-beolsik typist performs, so per-syllable stroke counts
 * (값=4, 닭=4, 외=3, 의=3) fall out for free.
 */
import {
  COMPOUND_MEDIAL_SPLIT,
  DOUBLE_FINAL_SPLIT,
  decomposeSyllable,
  isHangulSyllable,
} from './jamo'
import { JAMO_TO_KEYSTROKE, type Keystroke } from './layout'

export interface CharStrokes {
  /** The character as it appears in the text. */
  char: string
  /** Index of the character in the source text. */
  charIndex: number
  /** Physical keystrokes that produce it, in order. */
  strokes: Keystroke[]
  /** The jamo (or literal char) each keystroke contributes. */
  jamo: string[]
}

function jamoKeystroke(jamo: string): Keystroke {
  const ks = JAMO_TO_KEYSTROKE[jamo]
  if (ks === undefined) throw new RangeError(`no 2-beolsik key for: ${jamo}`)
  return ks
}

/** Jamo sequence for one Hangul syllable char, split to keystroke level. */
export function syllableToJamoKeys(ch: string): string[] {
  const { initial, medial, final } = decomposeSyllable(ch)
  const out: string[] = [initial]
  const medialSplit = COMPOUND_MEDIAL_SPLIT[medial]
  if (medialSplit !== undefined) out.push(...medialSplit)
  else out.push(medial)
  if (final !== '') {
    const finalSplit = DOUBLE_FINAL_SPLIT[final]
    if (finalSplit !== undefined) out.push(...finalSplit)
    else out.push(final)
  }
  return out
}

/**
 * Decompose text into per-character keystroke lists.
 * - Hangul syllables → jamo keystrokes (compounds/double-finals split;
 *   Shift doubles like ㄲ/ㅆ/ㅒ are ONE stroke).
 * - Standalone jamo → its keystroke.
 * - ASCII letters → one stroke (Shift for uppercase); anything else → one
 *   stroke with the literal char as its code-less marker.
 */
export function decomposeText(text: string): CharStrokes[] {
  return [...text].map((char, charIndex) => {
    if (isHangulSyllable(char)) {
      const jamo = syllableToJamoKeys(char)
      return { char, charIndex, jamo, strokes: jamo.map(jamoKeystroke) }
    }
    if (JAMO_TO_KEYSTROKE[char] !== undefined) {
      return { char, charIndex, jamo: [char], strokes: [jamoKeystroke(char)] }
    }
    if (/^[a-z]$/.test(char)) {
      return {
        char,
        charIndex,
        jamo: [char],
        strokes: [{ code: `Key${char.toUpperCase()}`, shift: false }],
      }
    }
    if (/^[A-Z]$/.test(char)) {
      return {
        char,
        charIndex,
        jamo: [char],
        strokes: [{ code: `Key${char}`, shift: true }],
      }
    }
    if (char === ' ') {
      return { char, charIndex, jamo: [char], strokes: [{ code: 'Space', shift: false }] }
    }
    return { char, charIndex, jamo: [char], strokes: [{ code: char, shift: false }] }
  })
}

/** Per-character stroke counts — the §4.1 stroke-count analysis stage. */
export function strokeCounts(text: string): number[] {
  return decomposeText(text).map((c) => c.strokes.length)
}
