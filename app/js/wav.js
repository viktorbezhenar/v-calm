/**
 * Minimal 16-bit PCM mono WAV encoder. Pure — no DOM, unit-tested.
 * Used to turn an offline-rendered session into a file an <audio> element
 * can play, because iOS keeps <audio> playing on a locked screen while it
 * silences Web Audio ("ambient" audio) as soon as the app leaves the foreground.
 */

/**
 * @param {Float32Array} samples  mono samples in [-1, 1]
 * @param {number} sampleRate
 * @returns {ArrayBuffer}
 */
export function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buffer);

  writeAscii(v, 0, 'RIFF');
  v.setUint32(4, 36 + dataSize, true);
  writeAscii(v, 8, 'WAVE');
  writeAscii(v, 12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  v.setUint16(32, bytesPerSample, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  writeAscii(v, 36, 'data');
  v.setUint32(40, dataSize, true);

  let o = 44;
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** A short silent WAV, used to unlock the <audio> element inside a tap. */
export function silentWav(seconds = 0.1, sampleRate = 8000) {
  return encodeWav(new Float32Array(Math.round(seconds * sampleRate)), sampleRate);
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}
