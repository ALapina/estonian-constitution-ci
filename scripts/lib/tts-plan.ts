// Turns a text into the segments of its two audio files (DESIGN.md 4.1, 4.3 and 6):
// story.mp3 from `segments`, law.mp3 from the law block (the `law` ids, then the `facts`).

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ActId, Character, LawAct, LawId, LawParagraph, LawPart, LawPoint, SpeakerId, TextEntry } from '../../src/lib/types.ts';
import { normaliseVoice } from './tts-synth.ts';
import { sentenceRanges, synthesisChunks, toSpoken } from './tts-text.ts';

/** What a timing entry points at, so the site can highlight it. */
export type SegmentRef =
  /** Story: index in `TextEntry.segments`. */
  | { segment: number }
  /** Law: one sentence of the text of a part or point, `text.slice(from, to)`. */
  | { ref: LawId; from: number; to: number }
  /** Law block: index in `TextEntry.facts`. */
  | { fact: number };

export interface PlannedSegment {
  at: SegmentRef;
  voice: string;
  /** The displayed text of the segment. */
  display: string;
  /** The spoken text in pieces of at most about 250 characters, one API request each. */
  chunks: string[];
}

/** A file is a list of paragraphs, and a paragraph is a list of segments. */
export type PlannedFile = PlannedSegment[][];

/** Start and end in seconds of a segment in its file. */
export type SegmentTiming = SegmentRef & { start: number; end: number };

export interface FileTimings {
  /** File name next to timings.json. */
  file: string;
  /** Seconds. */
  duration: number;
  /** Every segment in order. */
  segments: SegmentTiming[];
}

/** public/audio/<id>/timings.json. `law` is null when the text has no law block. */
export interface Timings {
  story: FileTimings;
  law: FileTimings | null;
}

export function segment(at: SegmentRef, voice: string, display: string): PlannedSegment {
  const spoken = toSpoken(display);
  if (!spoken) throw new Error(`empty text at ${JSON.stringify(at)}`);
  return { at, voice, display, chunks: synthesisChunks(spoken) };
}

/** The voice of a speaker: content/characters.json first, then the text's own `cast`. */
export function voiceOf(speaker: SpeakerId, text: TextEntry, characters: Record<SpeakerId, Character>): string {
  const recurring = characters[speaker];
  const local = text.cast?.[speaker];
  if (recurring && local && local.voice !== recurring.voice) {
    throw new Error(`${text.id}: cast entry "${speaker}" has voice ${local.voice}, but content/characters.json has ${recurring.voice}`);
  }
  const character = recurring ?? local;
  if (!character) throw new Error(`${text.id}: speaker "${speaker}" is in neither content/characters.json nor the text's cast`);
  return normaliseVoice(character.voice, `${text.id}: speaker "${speaker}"`);
}

/** Story audio: one segment per entry of `segments`; a change of `para` starts a paragraph. */
export function planStory(text: TextEntry, characters: Record<SpeakerId, Character>): PlannedFile {
  if (!Array.isArray(text.segments) || text.segments.length === 0) throw new Error(`${text.id}: the text has no segments`);
  const file: PlannedFile = [];
  text.segments.forEach((seg, i) => {
    const planned = segment({ segment: i }, voiceOf(seg.speaker, text, characters), seg.text);
    if (i === 0 || seg.para !== text.segments[i - 1]!.para) file.push([planned]);
    else file[file.length - 1]!.push(planned);
  });
  return file;
}

/** Speakers of a story that share a voice; DESIGN.md 4.3 allows none. */
export function sharedVoices(text: TextEntry, characters: Record<SpeakerId, Character>): string[] {
  const byVoice = new Map<string, Set<SpeakerId>>();
  for (const seg of text.segments) {
    const voice = voiceOf(seg.speaker, text, characters);
    byVoice.set(voice, (byVoice.get(voice) ?? new Set()).add(seg.speaker));
  }
  return [...byVoice].filter(([, speakers]) => speakers.size > 1).map(([voice, speakers]) => `${[...speakers].join(', ')} share the voice ${voice}`);
}

const LAW_FILES: Record<ActId, string> = { ps: 'constitution.json', kods: 'citizenship-act.json' };

/** The acts in content/law/, loaded on first use; `overrides` are LawAct files used instead. */
export class LawLibrary {
  private readonly acts = new Map<ActId, { act: LawAct; path: string }>();

  constructor(
    private readonly lawDir: string,
    overrides: string[],
    private readonly root: string,
  ) {
    for (const path of overrides) {
      const act = readAct(path);
      this.acts.set(act.act, { act, path });
    }
  }

  get(id: ActId): { act: LawAct; path: string } {
    let entry = this.acts.get(id);
    if (!entry) {
      const path = join(this.lawDir, LAW_FILES[id]);
      if (!existsSync(path)) {
        throw new Error(`${relative(this.root, path)} not found: run pnpm import:law, or pass --law <LawAct file>`);
      }
      entry = { act: readAct(path), path };
      if (entry.act.act !== id) throw new Error(`${path}: act is "${entry.act.act}", expected "${id}"`);
      this.acts.set(id, entry);
    }
    return entry;
  }

  /** Finds the §, part or point of a law id. */
  resolve(id: LawId): { paragraph: LawParagraph; part?: LawPart; point?: LawPoint } {
    const m = /^(ps|kods)-(\d+(?:_\d+)?)(?=-|$)/.exec(id);
    if (!m) throw new Error(`law id "${id}": expected an id such as ps-60, ps-8-lg2 or kods-21-lg1-p6`);
    const { act, path } = this.get(m[1] as ActId);
    const paragraphId = `${m[1]}-${m[2]}`;
    const paragraph = act.paragraphs[paragraphId];
    if (!paragraph) throw new Error(`law id "${id}": ${paragraphId} is not in ${relative(this.root, path)}`);
    if (id === paragraphId) return { paragraph };
    for (const part of paragraph.parts) {
      if (part.id === id) return { paragraph, part };
      const point = part.points.find((p) => p.id === id);
      if (point) return { paragraph, part, point };
    }
    throw new Error(`law id "${id}" is not in ${paragraphId} of ${relative(this.root, path)}`);
  }
}

function readAct(path: string): LawAct {
  const act = JSON.parse(readFileSync(path, 'utf8')) as LawAct;
  if (!(act.act in LAW_FILES) || typeof act.paragraphs !== 'object' || act.paragraphs === null) {
    throw new Error(`${path} is not a LawAct (src/lib/types.ts)`);
  }
  return act;
}

/**
 * Law audio, all in the law voice: the text of every id in `law`, then the `facts`.
 * A § id means the whole §; a part id means that part with its points; a point id means the
 * part's text before its points plus that point (consecutive points of one part share it).
 * Every sentence of a part or point text is a segment. Paragraphs, which get the longer
 * pause, are each part and each fact. Repealed parts and points are not spoken.
 */
export function planLaw(text: TextEntry, laws: LawLibrary, voice: string, warn: (line: string) => void): PlannedFile {
  const file: PlannedFile = [];
  const sentences = (ref: LawId, body: string): PlannedSegment[] =>
    sentenceRanges(body).map(({ from, to }) => segment({ ref, from, to }, voice, body.slice(from, to)));
  let introPart: LawPart | null = null;
  const seen = new Set<LawId>();
  for (const id of text.law) {
    if (seen.has(id)) {
      warn(`${text.id}: law id ${id} is listed twice; it is spoken once`);
      continue;
    }
    seen.add(id);
    const { paragraph, part, point } = laws.resolve(id);
    if (paragraph.repealed || part?.repealed || point?.repealed) {
      warn(`${text.id}: ${id} is repealed; it is not spoken`);
      introPart = null;
      continue;
    }
    if (part && point) {
      if (introPart === part) file[file.length - 1]!.push(...sentences(point.id, point.text));
      else file.push([...sentences(part.id, part.text), ...sentences(point.id, point.text)]);
      introPart = part;
      continue;
    }
    introPart = null;
    for (const p of part ? [part] : paragraph.parts) {
      if (p.repealed) continue;
      const points = p.points.filter((pt) => !pt.repealed);
      file.push([...sentences(p.id, p.text), ...points.flatMap((pt) => sentences(pt.id, pt.text))]);
    }
  }
  text.facts.forEach((fact, i) => file.push([segment({ fact: i }, voice, fact.text)]));
  return file.filter((paragraph) => paragraph.length > 0);
}
