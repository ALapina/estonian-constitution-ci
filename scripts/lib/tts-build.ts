// Builds the audio files of a text and the voice samples (DESIGN.md section 6):
// synthesis per segment, pauses, MP3 encoding, timings.json.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Character, TextEntry } from '../../src/lib/types.ts';
import { PAUSE, Track, seconds, writeMp3, type Mp3Info } from './tts-audio.ts';
import {
  planLaw,
  planStory,
  segment,
  sharedVoices,
  type FileTimings,
  type LawLibrary,
  type PlannedFile,
  type SegmentRef,
  type SegmentTiming,
  type Timings,
} from './tts-plan.ts';
import { normaliseVoice, type Synthesiser } from './tts-synth.ts';
import { sampleSentence, type VoiceSample } from './tts-voices.ts';
import { tidyClip } from './tts-wav.ts';

export interface BuildContext {
  /** Project root, for short paths in messages. */
  root: string;
  /** Output folder: public/audio, or --out. */
  outRoot: string;
  /** public/, to turn file paths into site paths. */
  publicDir: string;
  characters: Record<string, Character>;
  laws: LawLibrary;
  synth: Synthesiser;
  /** Plan only: print the segments and count the requests; send nothing and write nothing. */
  dryRun: boolean;
  /** Dry run: voice|text of every clip that is not cached yet. */
  pending: Set<string>;
  log: (line: string) => void;
  warn: (line: string) => void;
}

/** A text has audio when its timings.json and every file it names exist. */
export function hasAudio(id: string, outRoot: string): boolean {
  const dir = join(outRoot, id);
  try {
    const timings = JSON.parse(readFileSync(join(dir, 'timings.json'), 'utf8')) as Timings;
    return [timings.story, timings.law].every((t) => t === null || existsSync(join(dir, t.file)));
  } catch {
    return false;
  }
}

/** Builds public/audio/<id>/story.mp3, law.mp3 and timings.json, and prints the paths. */
export async function buildText(text: TextEntry, ctx: BuildContext): Promise<void> {
  if (!/^[\w-]+$/u.test(text.id) || text.id === 'voices') throw new Error(`text id "${text.id}" cannot name an audio folder`);
  const lawCharacter = ctx.characters['law'];
  if (!lawCharacter) throw new Error('content/characters.json has no "law" character');
  const lawVoice = normaliseVoice(lawCharacter.voice, 'character "law"');
  for (const problem of sharedVoices(text, ctx.characters)) ctx.warn(`${text.id}: ${problem}`);
  // Plan both files before the first request, so content errors cost no API calls.
  const storyPlan = planStory(text, ctx.characters);
  const lawPlan = planLaw(text, ctx.laws, lawVoice, ctx.warn);
  if (lawPlan.length === 0) ctx.warn(`${text.id}: no law text and no facts, so no law.mp3`);
  if (ctx.dryRun) {
    printPlan(`${text.id}/story`, storyPlan, ctx);
    if (lawPlan.length > 0) printPlan(`${text.id}/law`, lawPlan, ctx);
    return;
  }

  const story = await render(storyPlan, ctx.synth);
  const law = lawPlan.length > 0 ? await render(lawPlan, ctx.synth) : null;

  // timings.json goes last: a text without it counts as missing, even if MP3s were replaced.
  const dir = join(ctx.outRoot, text.id);
  mkdirSync(dir, { recursive: true });
  const timingsPath = join(dir, 'timings.json');
  rmSync(timingsPath, { force: true });
  const storyPath = join(dir, 'story.mp3');
  const lawPath = join(dir, 'law.mp3');
  const timings: Timings = {
    story: fileTimings('story.mp3', story, await writeMp3(story.pcm, storyPath)),
    law: law ? fileTimings('law.mp3', law, await writeMp3(law.pcm, lawPath)) : null,
  };
  if (!law) rmSync(lawPath, { force: true });
  writeJson(timingsPath, timings);

  ctx.log(`${text.id}: story ${describeFile(timings.story)} → ${short(storyPath, ctx)}`);
  if (timings.law) ctx.log(`${text.id}: law ${describeFile(timings.law)} → ${short(lawPath, ctx)}`);
  ctx.log(`${text.id}: timings → ${short(timingsPath, ctx)}`);
  const audio = { story: sitePath(storyPath, ctx), ...(timings.law ? { law: sitePath(lawPath, ctx) } : {}), timings: sitePath(timingsPath, ctx) };
  ctx.log(`${text.id}: "audio": ${JSON.stringify(audio)}`);
}

/** Builds public/audio/voices/<character-id>.mp3 for every character, and index.json. */
export async function buildVoices(ctx: BuildContext): Promise<void> {
  const dir = join(ctx.outRoot, 'voices');
  const samples: VoiceSample[] = [];
  for (const [id, character] of Object.entries(ctx.characters)) {
    const voice = normaliseVoice(character.voice, `character "${id}"`);
    const { sentence, fallback } = sampleSentence(id, character);
    if (fallback) ctx.warn(`voices: scripts/lib/tts-voices.ts has no sentence for "${id}"; using "${sentence}"`);
    const plan: PlannedFile = [[segment({ segment: 0 }, voice, sentence)]];
    if (ctx.dryRun) {
      printPlan(`voices/${id}`, plan, ctx);
      continue;
    }
    const path = join(dir, `${id}.mp3`);
    const { pcm } = await render(plan, ctx.synth);
    const info = await writeMp3(pcm, path);
    samples.push({ id, name: character.name, voice, sentence, file: sitePath(path, ctx) });
    ctx.log(`voices/${id}: ${voice}, ${describeInfo(info)} → ${short(path, ctx)}`);
  }
  if (ctx.dryRun) return;
  const indexPath = join(dir, 'index.json');
  writeJson(indexPath, samples);
  ctx.log(`voices: index → ${short(indexPath, ctx)}`);
}

interface Rendered {
  pcm: Float32Array;
  segments: SegmentTiming[];
}

/**
 * Synthesises every chunk and joins the clips: PAUSE.chunk between the chunks of a segment,
 * PAUSE.segment between segments (and between sentences inside one), PAUSE.paragraph between
 * paragraphs, PAUSE.edge at both ends. Timings come from the sample counts.
 */
async function render(file: PlannedFile, synth: Synthesiser): Promise<Rendered> {
  const track = new Track();
  const segments: SegmentTiming[] = [];
  track.silence(PAUSE.edge);
  for (const [p, paragraph] of file.entries()) {
    for (const [s, seg] of paragraph.entries()) {
      if (s > 0) track.silence(PAUSE.segment);
      else if (p > 0) track.silence(PAUSE.paragraph);
      const start = track.length;
      for (const [c, chunk] of seg.chunks.entries()) {
        if (c > 0) track.silence(PAUSE.chunk);
        const clip = tidyClip(await synth.clip(seg.voice, chunk), PAUSE.segment);
        if (clip.length === 0) throw new Error(`the API returned only silence for "${chunk}"`);
        track.add(clip);
      }
      segments.push({ ...seg.at, start: seconds(start), end: seconds(track.length) });
    }
  }
  track.silence(PAUSE.edge);
  return { pcm: track.toPcm(), segments };
}

/** Timings of a file, checked against the MP3: every segment ends after it starts and before the next one. */
function fileTimings(file: string, rendered: Rendered, info: Mp3Info): FileTimings {
  let previousEnd = 0;
  for (const t of rendered.segments) {
    if (!(t.start >= previousEnd && t.end > t.start)) throw new Error(`${file}: timings out of order at ${JSON.stringify(t)}`);
    previousEnd = t.end;
  }
  if (previousEnd > info.duration) throw new Error(`${file}: the last segment ends at ${previousEnd} s, after the end of the MP3 (${info.duration} s)`);
  return { file, duration: seconds(rendered.pcm.length), segments: rendered.segments };
}

function printPlan(label: string, file: PlannedFile, ctx: BuildContext): void {
  const segments = file.flat();
  let missing = 0;
  for (const seg of segments) {
    for (const chunk of seg.chunks) {
      const key = `${seg.voice}|${chunk}`;
      if (!ctx.synth.isCached(seg.voice, chunk) && !ctx.pending.has(key)) {
        ctx.pending.add(key);
        missing++;
      }
    }
  }
  ctx.log(`${label}: ${count(segments.length, 'segment')} in ${count(file.length, 'paragraph')}; ${count(missing, 'new API request')}`);
  file.forEach((paragraph, p) => {
    for (const seg of paragraph) {
      ctx.log(`  ¶${p} ${describeRef(seg.at)} [${seg.voice}] ${seg.display}`);
      if (seg.chunks.length === 1 && seg.chunks[0] === seg.display) continue;
      seg.chunks.forEach((chunk, c) => {
        const cached = ctx.synth.isCached(seg.voice, chunk) ? 'cached' : 'new';
        ctx.log(`      spoken ${c + 1}/${seg.chunks.length} (${chunk.length} chars, ${cached}): ${chunk}`);
      });
    }
  });
}

function describeRef(at: SegmentRef): string {
  if ('segment' in at) return `segment ${at.segment}`;
  if ('fact' in at) return `fact ${at.fact}`;
  return `${at.ref} [${at.from}, ${at.to})`;
}

function describeFile(t: FileTimings): string {
  return `${count(t.segments.length, 'segment')}, ${t.duration.toFixed(2)} s`;
}

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function describeInfo(info: Mp3Info): string {
  return `${info.duration.toFixed(2)} s, ${info.bitRate / 1000} kbit/s, ${info.sampleRate} Hz, ${info.channels === 1 ? 'mono' : `${info.channels} channels`}`;
}

/** Path for the `audio` field and the voices index: relative to public/ ("audio/0001/story.mp3"). */
function sitePath(path: string, ctx: BuildContext): string {
  const fromPublic = relative(ctx.publicDir, path);
  const base = fromPublic.startsWith('..') ? relative(ctx.outRoot, path) : fromPublic;
  return base.split(sep).join('/');
}

function short(path: string, ctx: BuildContext): string {
  const fromRoot = relative(ctx.root, path);
  return fromRoot.startsWith('..') ? path : fromRoot;
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}
