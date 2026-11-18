// Reads the WAV files of the TartuNLP API: mono, 22 050 Hz, 32-bit float (DESIGN.md section 6).

export const SAMPLE_RATE = 22050;

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_IEEE_FLOAT = 3;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

/** Decodes a mono 22 050 Hz WAV file, 32-bit float or 16-bit PCM, to float samples. */
export function decodeWav(buf: Buffer): Float32Array {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let format = -1;
  let channels = 0;
  let rate = 0;
  let bits = 0;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    let size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      format = buf.readUInt16LE(body);
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
      // The sub-format GUID of WAVE_FORMAT_EXTENSIBLE starts with the format code.
      if (format === WAVE_FORMAT_EXTENSIBLE && size >= 26) format = buf.readUInt16LE(body + 24);
    } else if (id === 'data') {
      if (format < 0) throw new Error('WAV data chunk before the fmt chunk');
      if (channels !== 1 || rate !== SAMPLE_RATE) {
        throw new Error(`WAV is ${channels} channel(s) at ${rate} Hz; expected mono at ${SAMPLE_RATE} Hz`);
      }
      // A streamed WAV may carry a placeholder size: use the bytes that are there.
      if (size === 0 || body + size > buf.length) size = buf.length - body;
      if (format === WAVE_FORMAT_IEEE_FLOAT && bits === 32) {
        const samples = new Float32Array(Math.floor(size / 4));
        for (let i = 0; i < samples.length; i++) samples[i] = buf.readFloatLE(body + 4 * i);
        return samples;
      }
      if (format === WAVE_FORMAT_PCM && bits === 16) {
        const samples = new Float32Array(Math.floor(size / 2));
        for (let i = 0; i < samples.length; i++) samples[i] = buf.readInt16LE(body + 2 * i) / 32768;
        return samples;
      }
      throw new Error(`WAV format ${format} with ${bits} bits is not supported`);
    }
    pos = body + size + (size & 1);
  }
  throw new Error('WAV has no data chunk');
}

const quiet = (x: number) => Math.abs(x) <= 1e-5;

/**
 * Prepares a clip from the API for joining. The API pads every clip with 0.5 s of digital
 * silence (exact zeros) at each end and puts the same between the sentences of one request.
 * The padding at the ends is dropped, since the script sets its own pauses, and every silent
 * run inside is cut to `maxPause` seconds, so sentences inside a segment get the same pause
 * as sentences between segments.
 */
export function tidyClip(samples: Float32Array, maxPause: number): Float32Array {
  let from = 0;
  let to = samples.length;
  while (from < to && quiet(samples[from]!)) from++;
  while (to > from && quiet(samples[to - 1]!)) to--;
  const max = Math.round(maxPause * SAMPLE_RATE);
  const out = new Float32Array(to - from);
  let length = 0;
  let run = 0;
  for (let i = from; i < to; i++) {
    const x = samples[i]!;
    run = quiet(x) ? run + 1 : 0;
    if (run <= max) out[length++] = x;
  }
  return out.subarray(0, length);
}
