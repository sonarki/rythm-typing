/**
 * Performance Log & Tape Renderer (SPEC §4.5). M2 pieces: the pure tape
 * score builder and WAV encoder live here; the OfflineAudioContext render
 * glue is UI-side (`src/ui/tapeRender.ts`) because core stays DOM-free.
 */
export { buildTapeScore } from './tapeScore'
export type { TapeEvent, TapeScore, TapeOptions } from './tapeScore'
export { encodeWavPcm16 } from './wav'
