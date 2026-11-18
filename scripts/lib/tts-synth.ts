// TartuNLP text-to-speech client with a segment cache (DESIGN.md section 6).
// Requests go one at a time. Every segment WAV is cached in .cache/tts/ under the
// SHA-256 of "voice|speed|spoken text" and is never requested again.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { decodeWav } from './tts-wav.ts';

const API_URL = 'https://api.tartunlp.ai/text-to-speech/v2';
export const SPEED = 1;
const MAX_TRIES = 5;
/** The server answers 408 after about 30 s; this only guards against a hung connection. */
const CLIENT_TIMEOUT_MS = 90_000;
const MAX_RETRY_WAIT_S = 120;

/**
 * The ten voices of the fastpitch-est model (DESIGN.md 4.3). The API also offers lee and
 * luukas, whose model and licence are unknown, so they are not allowed here.
 */
const VOICES = new Set(['albert', 'indrek', 'kalev', 'kylli', 'liivika', 'mari', 'meelis', 'peeter', 'tambet', 'vesta']);

/** Checks a voice name; "külli", the API's alias, becomes "kylli" so the cache has one key. */
export function normaliseVoice(voice: string, who: string): string {
  const name = voice === 'külli' ? 'kylli' : voice;
  if (!VOICES.has(name)) throw new Error(`${who}: voice "${voice}" is not one of ${[...VOICES].join(', ')}`);
  return name;
}

/** The API failed after all retries; later requests would most likely fail too. */
export class TtsApiError extends Error {}

type Attempt =
  | { wav: Buffer; secs: string; remaining: string }
  | { problem: string; retryable: boolean; retryAfter: number | null };

export interface SynthStats {
  /** HTTP requests sent, retries included. */
  requests: number;
  /** Requests that failed and were retried or gave up. */
  failed: number;
  /** Clips received and cached. */
  synthesised: number;
  /** Clips read from the cache. */
  cached: number;
  /** Lowest x-rate-limit-remaining seen, or null. */
  lowestRemaining: number | null;
}

export class Synthesiser {
  readonly stats: SynthStats = { requests: 0, failed: 0, synthesised: 0, cached: 0, lowestRemaining: null };
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly cacheDir: string,
    private readonly log: (line: string) => void,
  ) {}

  cachePath(voice: string, text: string): string {
    const key = createHash('sha256').update(`${voice}|${SPEED}|${text}`).digest('hex');
    return join(this.cacheDir, `${key}.wav`);
  }

  isCached(voice: string, text: string): boolean {
    return existsSync(this.cachePath(voice, text));
  }

  /** The samples of one spoken text, from the cache or from the API. */
  async clip(voice: string, text: string): Promise<Float32Array> {
    const path = this.cachePath(voice, text);
    if (existsSync(path)) {
      this.stats.cached++;
      try {
        return decodeWav(readFileSync(path));
      } catch (err) {
        throw new Error(`cached clip ${path} is unreadable (${(err as Error).message}); delete it to request it again`);
      }
    }
    const wav = await this.serial(() => this.request(voice, text));
    mkdirSync(this.cacheDir, { recursive: true });
    const tmp = `${path}.tmp-${process.pid}`;
    writeFileSync(tmp, wav);
    renameSync(tmp, path);
    this.stats.synthesised++;
    return decodeWav(wav);
  }

  /** Runs one request at a time, even if callers do not wait for each other. */
  private serial<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  /** Retries 408, 429, 5xx, network errors and broken WAVs with backoff, at most MAX_TRIES tries. */
  private async request(voice: string, text: string): Promise<Buffer> {
    const what = `${voice}, ${text.length} chars`;
    for (let attempt = 1; ; attempt++) {
      const result = await this.attempt(voice, text);
      if ('wav' in result) {
        this.log(`[api ${clock()}] 200 ${what}, ${result.secs} s, x-rate-limit-remaining ${result.remaining}`);
        return result.wav;
      }
      this.stats.failed++;
      if (!result.retryable) throw new Error(`TTS API refused ${what} "${preview(text)}": ${result.problem}`);
      if (attempt >= MAX_TRIES) {
        throw new TtsApiError(`TTS API failed ${MAX_TRIES} times for ${what} "${preview(text)}": ${result.problem}`);
      }
      const waitS = Math.min(result.retryAfter ?? 2 ** attempt, MAX_RETRY_WAIT_S);
      this.log(`[api ${clock()}] ${what}: ${result.problem}; try ${attempt + 1}/${MAX_TRIES} in ${waitS} s`);
      await new Promise((resolve) => setTimeout(resolve, waitS * 1000));
    }
  }

  private async attempt(voice: string, text: string): Promise<Attempt> {
    this.stats.requests++;
    const started = Date.now();
    const elapsed = () => ((Date.now() - started) / 1000).toFixed(1);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speaker: voice, speed: SPEED }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });
      const remaining = this.noteRemaining(res.headers.get('x-rate-limit-remaining'));
      if (!res.ok) {
        const detail = (await res.text()).replace(/\s+/g, ' ').slice(0, 200);
        return {
          problem: `HTTP ${res.status} after ${elapsed()} s, x-rate-limit-remaining ${remaining}: ${detail}`,
          retryable: res.status === 408 || res.status === 429 || res.status >= 500,
          retryAfter: retryAfter(res.headers.get('retry-after')),
        };
      }
      const wav = Buffer.from(await res.arrayBuffer());
      try {
        decodeWav(wav);
      } catch (err) {
        return { problem: `HTTP ${res.status} with a broken WAV: ${(err as Error).message}`, retryable: true, retryAfter: null };
      }
      return { wav, secs: elapsed(), remaining };
    } catch (err) {
      return { problem: `request failed after ${elapsed()} s: ${(err as Error).message}`, retryable: true, retryAfter: null };
    }
  }

  private noteRemaining(header: string | null): string {
    if (header === null) return '(none)';
    const n = Number(header);
    if (Number.isFinite(n)) {
      this.stats.lowestRemaining = this.stats.lowestRemaining === null ? n : Math.min(this.stats.lowestRemaining, n);
    }
    return header;
  }
}

/** Seconds from a Retry-After header (seconds or an HTTP date), or null. */
function retryAfter(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(1, Math.ceil(secs));
  const date = Date.parse(header);
  return Number.isNaN(date) ? null : Math.max(1, Math.ceil((date - Date.now()) / 1000));
}

/** Local time, HH:MM:SS: with x-rate-limit-remaining it shows the length of the rate-limit window. */
function clock(): string {
  return new Date().toTimeString().slice(0, 8);
}

function preview(text: string): string {
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}
