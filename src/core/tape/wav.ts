/**
 * PCM16 WAV encoder — pure, dependency-free, testable without any audio API.
 * The UI feeds it `OfflineAudioContext` render output; tests feed it arrays.
 */

/**
 * Encode float samples (-1..1, one array per channel, equal lengths) into a
 * RIFF/WAVE PCM16 file.
 */
export function encodeWavPcm16(
  channels: readonly Float32Array[],
  sampleRate: number,
): ArrayBuffer {
  const numChannels = channels.length
  if (numChannels === 0) throw new RangeError('at least one channel required')
  const numFrames = channels[0]!.length
  for (const c of channels) {
    if (c.length !== numFrames) {
      throw new RangeError('all channels must have equal length')
    }
  }

  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numFrames * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < numFrames; frame++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const clamped = Math.max(-1, Math.min(1, channels[ch]![frame]!))
      view.setInt16(
        offset,
        clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff,
        true,
      )
      offset += 2
    }
  }
  return buffer
}
