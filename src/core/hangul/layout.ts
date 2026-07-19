/**
 * 2-beolsik physical layout: KeyboardEvent.code ↔ jamo.
 * Data only — the automaton consumes it, the decomposer inverts it.
 */

export interface KeyJamo {
  /** Jamo produced without Shift. */
  base: string
  /** Jamo produced with Shift (double consonants ㅃㅉㄸㄲㅆ, vowels ㅒㅖ). */
  shift?: string
}

/** KeyboardEvent.code → jamo for the 2-beolsik layout. */
export const DUBEOLSIK: Readonly<Record<string, KeyJamo>> = {
  KeyQ: { base: 'ㅂ', shift: 'ㅃ' },
  KeyW: { base: 'ㅈ', shift: 'ㅉ' },
  KeyE: { base: 'ㄷ', shift: 'ㄸ' },
  KeyR: { base: 'ㄱ', shift: 'ㄲ' },
  KeyT: { base: 'ㅅ', shift: 'ㅆ' },
  KeyY: { base: 'ㅛ' },
  KeyU: { base: 'ㅕ' },
  KeyI: { base: 'ㅑ' },
  KeyO: { base: 'ㅐ', shift: 'ㅒ' },
  KeyP: { base: 'ㅔ', shift: 'ㅖ' },
  KeyA: { base: 'ㅁ' },
  KeyS: { base: 'ㄴ' },
  KeyD: { base: 'ㅇ' },
  KeyF: { base: 'ㄹ' },
  KeyG: { base: 'ㅎ' },
  KeyH: { base: 'ㅗ' },
  KeyJ: { base: 'ㅓ' },
  KeyK: { base: 'ㅏ' },
  KeyL: { base: 'ㅣ' },
  KeyZ: { base: 'ㅋ' },
  KeyX: { base: 'ㅌ' },
  KeyC: { base: 'ㅊ' },
  KeyV: { base: 'ㅍ' },
  KeyB: { base: 'ㅠ' },
  KeyN: { base: 'ㅜ' },
  KeyM: { base: 'ㅡ' },
}

export interface Keystroke {
  code: string
  shift: boolean
}

/** jamo → the physical keystroke that produces it (inverse of DUBEOLSIK). */
export const JAMO_TO_KEYSTROKE: Readonly<Record<string, Keystroke>> = (() => {
  const map: Record<string, Keystroke> = {}
  for (const [code, kj] of Object.entries(DUBEOLSIK)) {
    map[kj.base] = { code, shift: false }
    if (kj.shift !== undefined) map[kj.shift] = { code, shift: true }
  }
  return map
})()

/** Jamo for a physical key press, or null when the key types no jamo. */
export function keyToJamo(code: string, shift: boolean): string | null {
  const kj = DUBEOLSIK[code]
  if (kj === undefined) return null
  if (shift && kj.shift !== undefined) return kj.shift
  return kj.base
}
