/**
 * # JBC — Jamo Beatmap Compiler v1 (patent-track module, SPEC §4.1)
 *
 * ## Novel mechanism (invention-disclosure notes — keep current)
 * Automatic text → music-chart compilation for Korean and English, built on
 * the keystroke ground truth of the Hangul decomposer: each syllable's
 * 2-beolsik stroke count (2–5) is treated as a RHYTHMIC asset. v1 ships the
 * forward pipeline at syllable-beat difficulty; jamo-beat phrase synthesis
 * (2 strokes = 8th pair, 3 = triplet, 4 = 16th run, 5 = run + pickup) and
 * reverse mode (groove → sentence search) land in later milestones, but the
 * stroke-count analysis they consume is produced here today.
 *
 * ## Pipeline (v1)
 * text → per-char keystroke stream (`decomposeText`) → stroke-count analysis
 * → note placement: one note per character on the beat grid, word boundaries
 * snapped to downbeats (bar starts), punctuation rendered as rests.
 *
 * ## Inputs / outputs
 * - Input: plain text (KR / EN / mixed) + `JbcConfig`.
 * - Output: `Beatmap` — notes with beat position, absolute audio time,
 *   display label, required keystrokes, stroke count, word-start flag.
 *   Deterministic: same text + config → identical beatmap (CLAUDE.md §2).
 *
 * ## Tunable parameters (JbcConfig)
 * - `bpm`, `startSec` — tempo and chart origin on the audio timeline.
 * - `beatsPerBar` — downbeat grid for word snapping (default 4).
 * - `beatsPerNote` — syllable-beat density dial (default 1 = quarter notes).
 * - `restBeatsForPunctuation` — rest length a punctuation mark inserts.
 */
import { decomposeText } from '../hangul'
import type { Keystroke } from '../hangul'

export interface JbcConfig {
  bpm: number
  /** Audio time (sec) of beat 0. */
  startSec: number
  /** Downbeat grid for word snapping. Default 4. */
  beatsPerBar?: number
  /** Beats each note occupies (density dial). Default 1. */
  beatsPerNote?: number
  /** Rest (in beats) inserted by a punctuation mark. Default 1. */
  restBeatsForPunctuation?: number
}

export interface BeatmapNote {
  /** Musical position, beats from chart start. */
  beat: number
  /** Absolute audio time, seconds. */
  timeSec: number
  /** Displayed character (syllable for KR). */
  label: string
  /** Physical keystrokes required to complete the note. */
  strokes: Keystroke[]
  /** Stroke count — the §4.1 rhythmic analysis value (값=4, 외=3…). */
  strokeCount: number
  /** True when this note starts a word (snapped to a downbeat). */
  isWordStart: boolean
  /** Index of the character in the source text. */
  charIndex: number
}

export interface Beatmap {
  notes: BeatmapNote[]
  bpm: number
  startSec: number
  beatsPerBar: number
  /** Total length in beats (last note beat + its duration). */
  lengthBeats: number
}

const PUNCTUATION = /^[.,!?;:…'"()\-·]$/

function isPunctuation(ch: string): boolean {
  return PUNCTUATION.test(ch)
}

/** Next downbeat at or after `beat` on a `beatsPerBar` grid. */
export function snapToDownbeat(beat: number, beatsPerBar: number): number {
  return Math.ceil(beat / beatsPerBar) * beatsPerBar
}

/**
 * Compile text to a syllable-beat chart (the easy/default difficulty):
 * one note per character, words starting on downbeats.
 */
export function compileSyllableBeat(text: string, config: JbcConfig): Beatmap {
  const beatsPerBar = config.beatsPerBar ?? 4
  const beatsPerNote = config.beatsPerNote ?? 1
  const restBeats = config.restBeatsForPunctuation ?? 1
  const secPerBeat = 60 / config.bpm

  const notes: BeatmapNote[] = []
  let beat = 0
  let atWordStart = true

  for (const cs of decomposeText(text)) {
    if (cs.char === ' ' || cs.char === '\n') {
      // Word boundary: the NEXT note snaps to a downbeat.
      atWordStart = true
      continue
    }
    if (isPunctuation(cs.char)) {
      beat += restBeats // audible silence, no note (SPEC §4.1: rests/fills)
      atWordStart = true
      continue
    }
    if (atWordStart && notes.length > 0) {
      beat = snapToDownbeat(beat, beatsPerBar)
    }
    notes.push({
      beat,
      timeSec: config.startSec + beat * secPerBeat,
      label: cs.char,
      strokes: cs.strokes,
      strokeCount: cs.strokes.length,
      isWordStart: atWordStart,
      charIndex: cs.charIndex,
    })
    beat += beatsPerNote
    atWordStart = false
  }

  return {
    notes,
    bpm: config.bpm,
    startSec: config.startSec,
    beatsPerBar,
    lengthBeats: beat,
  }
}
