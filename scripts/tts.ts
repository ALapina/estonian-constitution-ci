// Builds the audio of the texts with the TartuNLP text-to-speech API (DESIGN.md section 6).
//
//   pnpm tts <id> [<id>...]   content/texts/<id>.json → public/audio/<id>/story.mp3, law.mp3, timings.json
//   pnpm tts --missing        every text in content/texts/ that has no audio yet
//   pnpm tts --voices         public/audio/voices/<character-id>.mp3 and index.json
//   pnpm tts --file <path>    a text from any path, for tests (repeatable)
//
// Options:
//   --law <path>   a LawAct file to use instead of content/law/<act>.json (repeatable)
//   --out <dir>    output folder instead of public/audio
//   --dry-run      print the segments, the spoken text and the requests needed; send nothing
//
// Segment WAVs are cached in .cache/tts/ and never requested again. The script prints the
// paths for the text's `audio` field but does not write it.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import type { Character, TextEntry } from '../src/lib/types.ts';
import { buildText, buildVoices, hasAudio, type BuildContext } from './lib/tts-build.ts';
import { LawLibrary } from './lib/tts-plan.ts';
import { Synthesiser, TtsApiError } from './lib/tts-synth.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEXTS_DIR = join(ROOT, 'content', 'texts');
const USAGE = `Usage:
  pnpm tts <id> [<id>...]   build content/texts/<id>.json
  pnpm tts --missing        build every text that has no audio yet
  pnpm tts --voices         build the voice samples
  pnpm tts --file <path>    build a text from any path (repeatable)
Options:
  --law <path>   LawAct file to use instead of content/law/<act>.json (repeatable)
  --out <dir>    output folder instead of public/audio
  --dry-run      print the plan and the API requests it needs; send nothing`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    missing: { type: 'boolean', default: false },
    voices: { type: 'boolean', default: false },
    file: { type: 'string', multiple: true, default: [] },
    law: { type: 'string', multiple: true, default: [] },
    out: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (values.help || (!values.missing && !values.voices && values.file.length === 0 && positionals.length === 0)) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

const log = (line: string) => console.log(line);
const warn = (line: string) => console.warn(`warning: ${line}`);
const outRoot = values.out ? resolve(values.out) : join(ROOT, 'public', 'audio');
const synth = new Synthesiser(join(ROOT, '.cache', 'tts'), log);
const ctx: BuildContext = {
  root: ROOT,
  outRoot,
  publicDir: join(ROOT, 'public'),
  characters: JSON.parse(readFileSync(join(ROOT, 'content', 'characters.json'), 'utf8')) as Record<string, Character>,
  laws: new LawLibrary(join(ROOT, 'content', 'law'), values.law.map((path) => resolve(path)), ROOT),
  synth,
  dryRun: values['dry-run'],
  pending: new Set(),
  log,
  warn,
};

/** Texts to build: a path, and the id its file name promises (content/texts/<id>.json). */
const jobs: { path: string; id?: string }[] = [];
for (const id of positionals) jobs.push({ path: join(TEXTS_DIR, `${id}.json`), id });
for (const path of values.file) jobs.push({ path: resolve(path) });
if (values.missing) {
  const all = existsSync(TEXTS_DIR) ? readdirSync(TEXTS_DIR).filter((f) => f.endsWith('.json')).sort() : [];
  const missing = all.filter((f) => !hasAudio(basename(f, '.json'), outRoot));
  log(`--missing: ${missing.length} of ${all.length} texts have no audio`);
  for (const f of missing) jobs.push({ path: join(TEXTS_DIR, f), id: basename(f, '.json') });
}

let failures = 0;
try {
  if (values.voices) await buildVoices(ctx);
  for (const job of jobs) {
    try {
      await buildText(readText(job.path, job.id), ctx);
    } catch (err) {
      if (err instanceof TtsApiError) throw err;
      failures++;
      console.error(`error: ${(err as Error).message}`);
    }
  }
} catch (err) {
  failures++;
  console.error(`error: ${(err as Error).message}`);
  if (err instanceof TtsApiError) console.error('Stopped: the API keeps failing. Cached segments are kept; run again later.');
} finally {
  const s = synth.stats;
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  if (ctx.dryRun) {
    log(`Dry run: ${count(ctx.pending.size, 'API request')} needed for clips that are not cached.`);
  } else {
    const lowest = s.lowestRemaining === null ? 'not seen' : String(s.lowestRemaining);
    log(
      `API: ${count(s.requests, 'request')} (${s.failed} failed), ${count(s.synthesised, 'clip')} synthesised, ` +
        `${count(s.cached, 'clip')} from the cache; lowest x-rate-limit-remaining ${lowest}.`,
    );
  }
}
process.exitCode = failures > 0 ? 1 : 0;

function readText(path: string, id: string | undefined): TextEntry {
  if (!existsSync(path)) throw new Error(`${relative(ROOT, path)} not found`);
  const text = JSON.parse(readFileSync(path, 'utf8')) as TextEntry;
  const problems: string[] = [];
  if (typeof text.id !== 'string' || text.id === '') problems.push('id');
  if (!Array.isArray(text.segments)) problems.push('segments');
  else {
    text.segments.forEach((s, i) => {
      if (typeof s?.speaker !== 'string' || typeof s.text !== 'string' || typeof s.para !== 'number') problems.push(`segments[${i}]`);
    });
  }
  if (!Array.isArray(text.law) || text.law.some((l) => typeof l !== 'string')) problems.push('law');
  if (!Array.isArray(text.facts)) problems.push('facts');
  else text.facts.forEach((f, i) => typeof f?.text !== 'string' && problems.push(`facts[${i}]`));
  if (problems.length > 0) throw new Error(`${path}: missing or malformed ${problems.join(', ')}`);
  if (id !== undefined && text.id !== id) throw new Error(`${relative(ROOT, path)}: id is "${text.id}", expected "${id}"`);
  return text;
}
