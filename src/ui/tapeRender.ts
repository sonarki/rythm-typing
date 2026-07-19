/**
 * Session Tape renderer (SPEC §4.5): runs a TapeScore offline through the
 * SAME sound pack into an OfflineAudioContext, encodes PCM16 WAV, and hands
 * back both the AudioBuffer (for in-app playback) and a Blob (for export).
 */
import type { TapeScore } from '../core/tape'
import { encodeWavPcm16 } from '../core/tape'
import { createMasterBus, playVoice } from './soundPack'

export interface RenderedTape {
  audioBuffer: AudioBuffer
  wavBlob: Blob
  durationSec: number
}

export async function renderTape(
  score: TapeScore,
  sampleRate = 44100,
): Promise<RenderedTape> {
  const lengthFrames = Math.max(
    1,
    Math.ceil(score.durationSec * sampleRate),
  )
  const ctx = new OfflineAudioContext(2, lengthFrames, sampleRate)
  const bus = createMasterBus(ctx)
  for (const ev of score.events) {
    playVoice(ctx, bus, ev.voice, ev.timeSec, ev.gain)
  }
  const audioBuffer = await ctx.startRendering()
  const channels = [
    audioBuffer.getChannelData(0),
    audioBuffer.getChannelData(1),
  ]
  const wav = encodeWavPcm16(channels, sampleRate)
  return {
    audioBuffer,
    wavBlob: new Blob([wav], { type: 'audio/wav' }),
    durationSec: score.durationSec,
  }
}
