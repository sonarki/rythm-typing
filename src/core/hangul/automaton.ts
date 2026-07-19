/**
 * # Hangul Performance Automaton (patent-track module, SPEC §4.4)
 *
 * ## Novel mechanism (invention-disclosure notes — keep current)
 * IME-free Hangul composition for per-keystroke timing truth. Browser IMEs
 * expose only composition events whose timing is unreliable and which hide
 * individual jamo keystrokes; this automaton consumes raw `keydown` codes
 * (2-beolsik) and produces BOTH:
 *   1. per-jamo timestamped events — the per-keystroke rhythmic layer that
 *      makes jamo-beat judgment (SPEC §3.2) and Flow-Mode voicing (§3.3)
 *      possible, and
 *   2. composed syllables — the text layer, byte-identical to what a system
 *      IME would have produced for the same key sequence.
 *
 * ## Mechanism
 * A finite-state composer over {initial, medial, final} with:
 * - double consonants via Shift (ㅃㅉㄸㄲㅆ; ㅒㅖ for vowels) — layout level;
 * - compound vowels (ㅗ+ㅏ→ㅘ …) and double finals (ㄹ+ㄱ→ㄺ …) — merge level;
 * - 도깨비불 backtracking: a vowel arriving while a final is held moves that
 *   final (or the SECOND element of a double final) to the next syllable's
 *   initial, retroactively re-committing the previous syllable (값+ㅏ→갑사).
 *
 * ## Inputs / outputs
 * - Input: `feedKey(code, shift, tPerf)` raw physical events, or
 *   `feedJamo(jamo, tPerf)` for pre-mapped input; non-jamo keys flush.
 * - Output: append-only `JamoEvent[]` `{jamo, tPerf, role}`, committed-
 *   syllable events `{text, jamoEvents}` via listener, `getText()` snapshot.
 *
 * ## Tunable parameters
 * The automaton itself is rule-exact (no tunables — Hangul is not tunable);
 * the tables it runs on (layout, merge maps) live in `layout.ts` / `jamo.ts`
 * and swap wholesale for future layouts (e.g. 3-beolsik).
 *
 * Determinism: same (code, shift, tPerf) sequence → identical events and
 * identical text, always (CLAUDE.md §2).
 */
import {
  COMPOUND_MEDIALS,
  DOUBLE_FINALS,
  DOUBLE_FINAL_SPLIT,
  canBeFinal,
  composeSyllable,
  isVowelJamo,
} from './jamo'
import { keyToJamo } from './layout'

export type JamoRole = 'initial' | 'medial' | 'final' | 'standalone'

/** Per-jamo timestamped event — the rhythmic ground truth. */
export interface JamoEvent {
  jamo: string
  tPerf: number
  role: JamoRole
}

/** A finished syllable (or standalone jamo) with the strokes that made it. */
export interface CommittedSyllable {
  text: string
  jamoEvents: readonly JamoEvent[]
}

interface Composing {
  initial: string
  medial: string
  final: string
  events: JamoEvent[]
}

const EMPTY: Composing = { initial: '', medial: '', final: '', events: [] }

export class HangulAutomaton {
  private state: Composing = { ...EMPTY, events: [] }
  private committed: CommittedSyllable[] = []
  private allEvents: JamoEvent[] = []
  private listeners: ((s: CommittedSyllable) => void)[] = []

  onSyllable(listener: (s: CommittedSyllable) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /** Feed a raw physical key. Returns false if the key types no jamo. */
  feedKey(code: string, shift: boolean, tPerf: number): boolean {
    const jamo = keyToJamo(code, shift)
    if (jamo === null) return false
    this.feedJamo(jamo, tPerf)
    return true
  }

  /** Feed one jamo (already layout-mapped). */
  feedJamo(jamo: string, tPerf: number): void {
    if (isVowelJamo(jamo)) this.feedVowel(jamo, tPerf)
    else this.feedConsonant(jamo, tPerf)
  }

  /** Commit whatever is composing (end of input / non-jamo key). */
  flush(): void {
    this.commitState()
  }

  /** Committed text + the still-composing syllable, as an IME would show. */
  getText(): string {
    return (
      this.committed.map((c) => c.text).join('') + this.renderComposing()
    )
  }

  getCommitted(): readonly CommittedSyllable[] {
    return this.committed
  }

  /** Append-only per-jamo event log (SPEC §4.4 output 1). */
  getJamoEvents(): readonly JamoEvent[] {
    return this.allEvents
  }

  // ---- internals ----

  private feedVowel(v: string, tPerf: number): void {
    const s = this.state
    if (s.final !== '') {
      // 도깨비불: the final (or second half of a double final) migrates.
      const split = DOUBLE_FINAL_SPLIT[s.final]
      let moved: string
      if (split !== undefined) {
        s.final = split[0]
        moved = split[1]
      } else {
        moved = s.final
        s.final = ''
      }
      // The migrated consonant's event moves to the new syllable too.
      const movedEvent = s.events.pop()!
      const reRoled: JamoEvent = { ...movedEvent, role: 'initial' }
      this.commitState()
      this.state = {
        initial: moved,
        medial: '',
        final: '',
        events: [reRoled],
      }
      this.pushEvent({ jamo: v, tPerf, role: 'medial' })
      this.state.medial = v
      return
    }
    if (s.medial !== '') {
      const combined = COMPOUND_MEDIALS[s.medial]?.[v]
      if (combined !== undefined) {
        this.pushEvent({ jamo: v, tPerf, role: 'medial' })
        s.medial = combined
        return
      }
      this.commitState()
      this.pushEvent({ jamo: v, tPerf, role: 'medial' })
      this.state.medial = v
      return
    }
    if (s.initial !== '') {
      this.pushEvent({ jamo: v, tPerf, role: 'medial' })
      s.medial = v
      return
    }
    this.pushEvent({ jamo: v, tPerf, role: 'medial' })
    s.medial = v
  }

  private feedConsonant(c: string, tPerf: number): void {
    const s = this.state
    if (s.medial !== '') {
      const vowelOnly = s.initial === ''
      if (!vowelOnly && s.final === '' && canBeFinal(c)) {
        this.pushEvent({ jamo: c, tPerf, role: 'final' })
        s.final = c
        return
      }
      if (!vowelOnly && s.final !== '') {
        const combined = DOUBLE_FINALS[s.final]?.[c]
        if (combined !== undefined) {
          this.pushEvent({ jamo: c, tPerf, role: 'final' })
          s.final = combined
          return
        }
      }
      // vowel-only syllable, un-final-able consonant, or full syllable
      this.commitState()
      this.pushEvent({ jamo: c, tPerf, role: 'initial' })
      this.state.initial = c
      return
    }
    if (s.initial !== '') {
      // 2-beolsik never merges two plain initials — commit the standalone.
      this.commitState()
    }
    this.pushEvent({ jamo: c, tPerf, role: 'initial' })
    this.state.initial = c
  }

  private pushEvent(ev: JamoEvent): void {
    this.state.events.push(ev)
    this.allEvents.push(ev)
  }

  private renderComposing(): string {
    const s = this.state
    if (s.initial !== '' && s.medial !== '') {
      return composeSyllable(s.initial, s.medial, s.final)
    }
    return s.initial + s.medial
  }

  private commitState(): void {
    const text = this.renderComposing()
    if (text === '') return
    const done: CommittedSyllable = { text, jamoEvents: this.state.events }
    this.committed.push(done)
    for (const l of this.listeners) l(done)
    this.state = { initial: '', medial: '', final: '', events: [] }
  }
}
