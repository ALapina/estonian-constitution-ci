// After a batch (docs/batch.md, steps 6-7). Run: pnpm sync
// - sets `audio` on every text whose MP3s exist in public/audio/<id>/;
// - adds every glossed word to content/vocab/lexicon.json, keyed by lower-case lemma, with the
//   first text that glosses it;
// - sets `translation` and `introducedIn` of exam-vocab entries that a text glosses.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ExamWord, LexiconEntry, TextEntry } from '../src/lib/types';

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const write = (path: string, data: unknown) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');

const files = readdirSync('content/texts').filter((f) => /^\d{4}\.json$/.test(f)).sort();
const lexicon = read<Record<string, LexiconEntry>>('content/vocab/lexicon.json');
const vocab = read<ExamWord[]>('content/vocab/exam-vocab.json');
const examByLemma = new Map(vocab.filter((e) => !e.tags.includes('duplicate')).map((e) => [e.lemma.toLowerCase(), e]));

let withAudio = 0;
let added = 0;
let examSet = 0;
for (const f of files) {
  const path = `content/texts/${f}`;
  const text = read<TextEntry>(path);
  const dir = `audio/${text.id}`;
  if (existsSync(`public/${dir}/story.mp3`) && existsSync(`public/${dir}/timings.json`)) {
    const audio = { story: `${dir}/story.mp3`, law: `${dir}/law.mp3`, timings: `${dir}/timings.json` };
    if (JSON.stringify(text.audio) !== JSON.stringify(audio)) {
      text.audio = audio;
      write(path, text);
    }
    withAudio++;
  }
  for (const w of text.newWords) {
    const key = w.lemma.toLowerCase();
    const exam = examByLemma.get(key);
    if (!lexicon[key]) {
      lexicon[key] = { translation: w.translation, introducedIn: text.id, ...(exam ? { exam: exam.id } : {}) };
      added++;
    }
    if (exam && !exam.introducedIn) {
      exam.introducedIn = text.id;
      exam.translation ||= w.translation;
      examSet++;
    }
  }
}

const sorted = Object.fromEntries(Object.entries(lexicon).sort(([a], [b]) => a.localeCompare(b, 'et')));
write('content/vocab/lexicon.json', sorted);
write('content/vocab/exam-vocab.json', vocab);
console.log(`texts: ${files.length}, with audio: ${withAudio}; lexicon: +${added} (${Object.keys(sorted).length}); exam entries introduced: +${examSet}`);
