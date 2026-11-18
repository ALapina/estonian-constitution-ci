// Joins clips with pauses, encodes MP3 with ffmpeg and checks the result with ffprobe
// (DESIGN.md section 6): MP3, 48 kbit/s, mono, 22 050 Hz.

import { spawn } from 'node:child_process';
import { mkdirSync, renameSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { SAMPLE_RATE } from './tts-wav.ts';

/** Pauses in seconds. */
export const PAUSE = {
  /** Between the clause chunks of one long sentence. */
  chunk: 0.2,
  /** Between segments of one paragraph. */
  segment: 0.3,
  /** Between paragraphs. */
  paragraph: 0.7,
  /** At the start and the end of a file, so players do not clip the first sound. */
  edge: 0.25,
} as const;

const BIT_RATE = 48_000;

/** One mono track built from clips and silences; positions are counted in samples. */
export class Track {
  private readonly parts: Float32Array[] = [];
  length = 0;

  silence(seconds: number): void {
    this.add(new Float32Array(Math.round(seconds * SAMPLE_RATE)));
  }

  add(samples: Float32Array): void {
    this.parts.push(samples);
    this.length += samples.length;
  }

  toPcm(): Float32Array {
    const pcm = new Float32Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      pcm.set(part, offset);
      offset += part.length;
    }
    return pcm;
  }
}

/** Seconds, rounded to milliseconds, of a sample position. */
export function seconds(samples: number): number {
  return Math.round((samples / SAMPLE_RATE) * 1000) / 1000;
}

export interface Mp3Info {
  codec: string;
  sampleRate: number;
  channels: number;
  /** Stream bit rate in bit/s. */
  bitRate: number;
  /** Seconds, as ffprobe reports them. */
  duration: number;
}

/**
 * Encodes float PCM at 22 050 Hz as MP3 (libmp3lame, 48 kbit/s CBR, mono, 22 050 Hz) and
 * checks the result with ffprobe. The file replaces `outPath` only after the check passes.
 */
export async function writeMp3(pcm: Float32Array, outPath: string): Promise<Mp3Info> {
  mkdirSync(dirname(outPath), { recursive: true });
  const tmp = `${outPath}.tmp-${process.pid}`;
  try {
    // ffmpeg reads raw little-endian floats from stdin.
    const raw = Buffer.allocUnsafe(pcm.length * 4);
    for (let i = 0; i < pcm.length; i++) raw.writeFloatLE(pcm[i]!, i * 4);
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'f32le', '-ar', String(SAMPLE_RATE), '-ac', '1', '-i', 'pipe:0',
      '-c:a', 'libmp3lame', '-b:a', '48k', '-compression_level', '2', '-ar', String(SAMPLE_RATE), '-ac', '1',
      '-f', 'mp3', tmp,
    ], raw);
    const info = await probeMp3(tmp);
    const problems: string[] = [];
    if (info.codec !== 'mp3') problems.push(`codec ${info.codec}`);
    if (info.sampleRate !== SAMPLE_RATE) problems.push(`sample rate ${info.sampleRate}`);
    if (info.channels !== 1) problems.push(`${info.channels} channels`);
    if (info.bitRate !== BIT_RATE) problems.push(`bit rate ${info.bitRate}`);
    const expected = pcm.length / SAMPLE_RATE;
    if (Math.abs(info.duration - expected) > 0.1) problems.push(`duration ${info.duration} s, expected ${expected.toFixed(3)} s`);
    if (problems.length > 0) throw new Error(`${outPath}: unexpected MP3: ${problems.join(', ')}`);
    renameSync(tmp, outPath);
    return info;
  } finally {
    rmSync(tmp, { force: true });
  }
}

export async function probeMp3(path: string): Promise<Mp3Info> {
  const out = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0',
    '-show_entries', 'stream=codec_name,sample_rate,channels,bit_rate:format=duration',
    '-of', 'json', path,
  ]);
  const json = JSON.parse(out) as {
    streams?: { codec_name?: string; sample_rate?: string; channels?: number; bit_rate?: string }[];
    format?: { duration?: string };
  };
  const stream = json.streams?.[0];
  if (!stream) throw new Error(`${path}: ffprobe found no audio stream`);
  return {
    codec: stream.codec_name ?? '?',
    sampleRate: Number(stream.sample_rate),
    channels: stream.channels ?? 0,
    bitRate: Number(stream.bit_rate),
    duration: Number(json.format?.duration),
  };
}

/** Runs a command, feeds it `input` on stdin, and returns its stdout. */
function run(command: string, args: string[], input?: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.stdin.on('error', () => undefined); // the exit code reports what went wrong
    child.on('error', (err: NodeJS.ErrnoException) => {
      reject(err.code === 'ENOENT' ? new Error(`${command} not found: install ffmpeg (brew install ffmpeg)`) : err);
    });
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error(`${command} exited with code ${code}: ${Buffer.concat(stderr).toString('utf8').trim()}`));
    });
    child.stdin.end(input);
  });
}
