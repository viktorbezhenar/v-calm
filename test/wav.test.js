import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav, silentWav } from '../app/js/wav.js';

const ascii = (v, o, n) => String.fromCharCode(...new Uint8Array(v.buffer, o, n));

test('encodeWav writes a valid 16-bit mono PCM header', () => {
  const buf = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1, 2]), 22050);
  const v = new DataView(buf);
  assert.equal(ascii(v, 0, 4), 'RIFF');
  assert.equal(ascii(v, 8, 4), 'WAVE');
  assert.equal(ascii(v, 36, 4), 'data');
  assert.equal(v.getUint16(20, true), 1); // PCM
  assert.equal(v.getUint16(22, true), 1); // mono
  assert.equal(v.getUint32(24, true), 22050);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), 12); // 6 samples x 2 bytes
  assert.equal(buf.byteLength, 44 + 12);
});

test('encodeWav clamps and scales samples', () => {
  const v = new DataView(encodeWav(new Float32Array([0, 1, -1, 2, -2]), 8000));
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((i) => v.getInt16(44 + i * 2, true)),
    [0, 32767, -32768, 32767, -32768],
  );
});

test('silentWav is short and silent', () => {
  const buf = silentWav(0.1, 8000);
  assert.equal(buf.byteLength, 44 + 800 * 2);
  assert.ok(new Int16Array(buf, 44).every((s) => s === 0));
});
