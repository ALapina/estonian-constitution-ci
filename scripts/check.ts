// Checks for texts (DESIGN.md 5.4).
//   pnpm check [id...]     blocking checks for the given texts (default: every text); exit 1 on failure
//   pnpm check --report    course report: window rule, encounters of exam words, returns of §
// Texts must be annotated first: uv run scripts/lemmatize.py --texts <id...>

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type {
  ActId,
  Character,
  ExamWord,
  LawAct,
  LawId,
  Plan,
  PlanSlot,
  TextEntry,
  Token,
} from '../src/lib/types';

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const VOICES = new Set(['albert', 'indrek', 'kalev', 'kylli', 'liivika', 'mari', 'meelis', 'peeter', 'tambet', 'vesta']);
// Citizenship Act § that bill 932 SE changes (DESIGN.md 2.4); texts citing them carry the tag "932 SE".
const KODS_932: Set<string> = new Set(['4', '6', '8', '9', '13', '20', '24', '28', '29', '35', '36_6']);
const CURVE: { upTo: number; length: [number, number]; newWords: [number, number] }[] = [
  { upTo: 20, length: [120, 200], newWords: [5, 6] },
  { upTo: 80, length: [200, 300], newWords: [7, 8] },
  { upTo: 160, length: [300, 400], newWords: [8, 10] },
  { upTo: 200, length: [400, 500], newWords: [6, 10] },
  { upTo: Infinity, length: [400, 500], newWords: [0, 2] },
];

const characters = read<Record<string, Character>>('content/characters.json');
const acts: Record<ActId, LawAct> = {
  ps: read<LawAct>('content/law/constitution.json'),
  kods: read<LawAct>('content/law/citizenship-act.json'),
};
const base = read<{ lemmas: { lemma: string; level: string }[] }>('content/vocab/base.json');
const examVocab: ExamWord[] = existsSync('content/vocab/exam-vocab.json')
  ? read<ExamWord[]>('content/vocab/exam-vocab.json')
  : [];
const plan: Plan | null = existsSync('content/plan.json') ? read<Plan>('content/plan.json') : null;

const textFiles = readdirSync('content/texts').filter((f) => /^\d{4}\.json$/.test(f)).sort();
const texts: TextEntry[] = textFiles.map((f) => read<TextEntry>(`content/texts/${f}`));

const baseA1 = new Set(base.lemmas.filter((l) => l.level === 'A1').map((l) => l.lemma.toLowerCase()));
const baseA2 = new Set(base.lemmas.filter((l) => l.level === 'A2').map((l) => l.lemma.toLowerCase()));
const examLemmas = new Map(examVocab.map((e) => [e.lemma.toLowerCase(), e.lemmas ?? [e.lemma.toLowerCase()]]));

const LAW_ID = /^(ps|kods)-(\d+(?:_\d+)?)(?:-lg(\d+(?:_\d+)?))?(?:-p(\d+(?:_\d+)?))?$/;

function resolves(id: LawId): boolean {
  const m = LAW_ID.exec(id);
  if (!m) return false;
  const para = acts[m[1] as ActId].paragraphs[`${m[1]}-${m[2]}`];
  if (!para) return false;
  if (!m[3]) return true;
  const part = para.parts.find((p) => p.number === m[3]);
  if (!part) return false;
  return !m[4] || part.points.some((p) => p.number === m[4]);
}

const paragraphOf = (id: LawId): string => {
  const m = LAW_ID.exec(id);
  return m ? `${m[1]}-${m[2]}` : id;
};

const lemmasOf = (t: Token): string[] =>
  [t.l, ...(t.alt ?? [])].filter((x): x is string => !!x).map((x) => x.toLowerCase());

const isWord = (t: Token): boolean => t.p !== 'Z' && t.p !== 'H' && t.p !== 'Y' && !/\d/.test(t.f);

/** Lemma sequence of a planned word: exam-vocab lemmas for exam entries, else the word itself. */
const seqOf = (lemma: string): string[] => examLemmas.get(lemma.toLowerCase()) ?? lemma.toLowerCase().split(/\s+/);

/** True when every lemma of `seq` appears within a window of seq.length + 3 words. */
function occursIn(seq: string[], tokens: Token[]): boolean {
  // A multiword item may keep a word in a fixed form ("kohtu alla andma"), so its words also match surface forms.
  const sets = tokens
    .filter((t) => t.p !== 'Z')
    .map((t) => new Set(seq.length > 1 ? [...lemmasOf(t), t.f.toLowerCase()] : lemmasOf(t)));
  if (seq.length === 1) return sets.some((s) => s.has(seq[0]));
  const width = seq.length + 3;
  for (let i = 0; i < Math.max(1, sets.length - width + 1); i++) {
    const window = sets.slice(i, i + width);
    if (seq.every((x) => window.some((w) => w.has(x)))) return true;
  }
  return false;
}

function curveFor(order: number) {
  return CURVE.find((c) => order <= c.upTo)!;
}

function slotOf(text: TextEntry): PlanSlot | undefined {
  return plan?.slots.find((s) => s.id === text.slot);
}

function checkText(text: TextEntry, earlier: TextEntry[]): string[] {
  const errors: string[] = [];
  const order = Number(text.id);
  const slot = slotOf(text);
  if (plan && !slot) errors.push(`slot "${text.slot}" is not in content/plan.json`);

  // Annotation
  const story = text.segments.flatMap((s) => s.tokens ?? []);
  if (text.segments.some((s) => !s.tokens)) {
    errors.push('segments are not annotated: run uv run scripts/lemmatize.py --texts ' + text.id);
    return errors;
  }

  // Length
  const words = story.filter((t) => t.p !== 'Z').length;
  const [min, max] = slot?.length ?? curveFor(order).length;
  if (words < min || words > max) errors.push(`story has ${words} words, expected ${min}-${max}`);

  // Planned new words: every one is glossed and used in the story
  const glossed = new Set(text.newWords.map((w) => w.lemma.toLowerCase()));
  for (const w of text.newWords) {
    if (!w.translation.trim()) errors.push(`new word "${w.lemma}" has no translation`);
    if (!occursIn(seqOf(w.lemma), story)) errors.push(`new word "${w.lemma}" does not occur in the story`);
  }
  if (slot) {
    for (const lemma of [...slot.newWords, ...slot.phrases]) {
      if (!glossed.has(lemma.toLowerCase())) errors.push(`planned new word or phrase "${lemma}" is missing from newWords`);
    }
    // Words to repeat
    for (const lemma of slot.repeat) {
      if (!occursIn(seqOf(lemma), story)) errors.push(`word to repeat "${lemma}" does not occur in the story`);
    }
  }

  // Unplanned unknown words. Known: the base list, earlier texts' glossaries, this slot's planned words
  // and phrases, and general words the writer glossed to fill the slot's free new-word places.
  const known = new Set<string>(baseA1);
  if (order > 20) for (const l of baseA2) known.add(l);
  for (const t of earlier) for (const w of t.newWords) for (const l of seqOf(w.lemma)) known.add(l);
  // Earlier slots' planned words count as known too, so texts of one batch can be written in parallel.
  for (const s of plan?.slots ?? []) {
    if (s.order < order) for (const w of [...s.newWords, ...s.phrases]) for (const l of seqOf(w)) known.add(l);
  }
  const planned =new Set([...(slot?.newWords ?? []), ...(slot?.phrases ?? [])].map((l) => l.toLowerCase()));
  const free = slot ? Math.max(0, slot.newWordCount - slot.newWords.length) : Infinity;
  const general = text.newWords.filter((w) => !planned.has(w.lemma.toLowerCase())).slice(0, free);
  for (const w of [...text.newWords.filter((x) => planned.has(x.lemma.toLowerCase())), ...general]) {
    for (const l of seqOf(w.lemma)) known.add(l);
  }
  for (const lemma of slot?.repeat ?? []) for (const l of seqOf(lemma)) known.add(l);
  for (const lemma of slot?.phrases ?? []) for (const l of seqOf(lemma)) known.add(l);
  // Character names: Vabamorf may read "Lisa" or "Mari" as common nouns.
  for (const c of [...Object.values(characters), ...Object.values(text.cast ?? {})]) {
    if (c.name) known.add(c.name.toLowerCase());
  }
  // A compound counts as known when every part is known ("koolikott": kool + kott).
  const unknown = story.filter(
    (t) => isWord(t) && !lemmasOf(t).some((l) => known.has(l)) && !(t.parts?.length && t.parts.every((p) => known.has(p))),
  );
  const limit = order <= 20 ? 0.01 : 0.02;
  if (unknown.length > Math.floor(words * limit)) {
    errors.push(
      `${unknown.length} unplanned unknown words (limit ${Math.floor(words * limit)}; free new-word places: ${free === Infinity ? 'no plan' : free}): ` +
        [...new Set(unknown.map((t) => `${t.f} (${t.l})`))].join(', '),
    );
  }
  for (const t of unknown) {
    if (!lemmasOf(t).some((l) => glossed.has(l))) errors.push(`unknown word "${t.f}" (${t.l}) has no line in newWords`);
  }

  // Law references and editions
  const refs = [...text.law, ...text.facts.map((f) => f.ref), ...text.questions.map((q) => q.ref)];
  for (const id of refs) if (!resolves(id)) errors.push(`unknown law id "${id}"`);
  for (const act of new Set(refs.map((r) => r.split('-')[0] as ActId))) {
    if (acts[act] && text.editions[act] !== acts[act].edition) {
      errors.push(`editions.${act} must be ${acts[act].edition}`);
    }
  }
  if (slot) {
    for (const id of slot.law) if (!text.law.includes(id)) errors.push(`planned law id "${id}" is missing from law`);
    const cited = new Set([...text.facts.map((f) => f.ref), ...text.questions.map((q) => q.ref)].map(paragraphOf));
    for (const id of slot.returns) {
      if (!cited.has(paragraphOf(id))) errors.push(`§ to bring back "${id}" is not in any fact or question`);
    }
  }
  const touches932 = refs.some((r) => {
    const m = LAW_ID.exec(r);
    return m?.[1] === 'kods' && KODS_932.has(m[2]);
  });
  if (touches932 && !text.tags.includes('932 SE')) errors.push('cites a § changed by 932 SE: add the tag "932 SE"');

  // Facts and questions
  const isReview = text.stage === 4;
  if (!isReview && (text.facts.length < 3 || text.facts.length > 5)) errors.push(`${text.facts.length} facts, expected 3-5`);
  for (const f of text.facts) {
    if (!/\((KodS )?§ [^)]+\)\s*$/.test(f.text)) errors.push(`fact does not end with "(§ ...)" or "(KodS § ...)": ${f.text}`);
  }
  if (!isReview && (text.questions.length < 1 || text.questions.length > 2)) {
    errors.push(`${text.questions.length} questions, expected 1-2`);
  }
  for (const q of text.questions) {
    if (q.answer < 0 || q.answer >= q.options.length) errors.push(`question "${q.text}": answer out of range`);
    if (new Set(q.options).size !== q.options.length) errors.push(`question "${q.text}": duplicate options`);
    if (q.type === 'truefalse' && q.options.join('|') !== 'õige|vale') {
      errors.push(`question "${q.text}": true/false options must be ["õige", "vale"]`);
    }
    if (q.type !== 'truefalse' && (q.options.length < 3 || q.options.length > 4)) {
      errors.push(`question "${q.text}": expected 3-4 options`);
    }
    if (!q.explanation.includes('§')) errors.push(`question "${q.text}": explanation must cite the §`);
  }

  // Voices: every speaker known; no two speakers of the story share a voice
  const voiceOf = new Map<string, string>();
  for (const seg of text.segments) {
    const c = text.cast?.[seg.speaker] ?? characters[seg.speaker];
    if (!c) {
      errors.push(`unknown speaker "${seg.speaker}"`);
      continue;
    }
    if (!VOICES.has(c.voice)) errors.push(`speaker "${seg.speaker}": unknown voice "${c.voice}"`);
    voiceOf.set(seg.speaker, c.voice);
  }
  const byVoice = new Map<string, string[]>();
  for (const [speaker, voice] of voiceOf) byVoice.set(voice, [...(byVoice.get(voice) ?? []), speaker]);
  for (const [voice, speakers] of byVoice) {
    if (speakers.length > 1) errors.push(`speakers ${speakers.join(', ')} share the voice ${voice}`);
  }

  // Local elections rule (DESIGN.md 4.2)
  const all = [...text.segments.map((s) => s.text), ...text.facts.map((f) => f.text), ...text.questions.map((q) => q.text)].join(' ');
  if (/kohalik\w*\s+(omavalitsus\w*\s+)?(volikogu\s+)?valim/i.test(all) && /ainult\s+Eesti\s+kodanik/i.test(all)) {
    errors.push('local elections: citizens of other EU states vote too; do not write "ainult Eesti kodanikud"');
  }
  return errors;
}

function report(): void {
  const encounters = new Map<string, { count: number; texts: Set<string>; first: number }>();
  const returns = new Map<string, number>();
  for (const text of texts) {
    const story = text.segments.flatMap((s) => s.tokens ?? []);
    for (const e of examVocab) {
      const seq = e.lemmas ?? [e.lemma.toLowerCase()];
      if (!occursIn(seq, story)) continue;
      const n = story.filter((t) => lemmasOf(t).includes(seq[0])).length || 1;
      const rec = encounters.get(e.id) ?? { count: 0, texts: new Set<string>(), first: Number(text.id) };
      rec.count += n;
      rec.texts.add(text.id);
      encounters.set(e.id, rec);
    }
    const cited = new Set([...text.law, ...text.facts.map((f) => f.ref), ...text.questions.map((q) => q.ref)].map(paragraphOf));
    for (const p of cited) returns.set(p, (returns.get(p) ?? 0) + 1);
  }
  const introduced = texts.flatMap((t) => t.newWords.map((w) => ({ lemma: w.lemma.toLowerCase(), at: Number(t.id) })));
  const windowMisses = introduced.filter(({ lemma, at }) => {
    const later = texts.filter((t) => Number(t.id) > at && Number(t.id) <= at + 10);
    const hits = later.filter((t) => occursIn(seqOf(lemma), t.segments.flatMap((s) => s.tokens ?? []))).length;
    const windowClosed = texts.some((t) => Number(t.id) >= at + 10);
    return windowClosed && hits < 3;
  });
  const weak = examVocab.filter((e) => encounters.has(e.id) && (encounters.get(e.id)!.count < 12 || encounters.get(e.id)!.texts.size < 4));
  console.log(`Texts: ${texts.length}`);
  console.log(`Exam words met so far: ${encounters.size} of ${examVocab.length}; below 12 encounters in 4 texts: ${weak.length}`);
  console.log(`Window rule misses (closed windows only): ${windowMisses.map((w) => `${w.lemma}@${w.at}`).join(', ') || 'none'}`);
  const thin = [...returns].filter(([, n]) => n < 3).map(([p]) => p);
  console.log(`§ cited so far: ${returns.size}; cited fewer than 3 times: ${thin.length}`);
}

const args = process.argv.slice(2);
if (args.includes('--report')) {
  report();
} else {
  const ids = args.length ? args : texts.map((t) => t.id);
  let failed = 0;
  for (const id of ids) {
    const text = texts.find((t) => t.id === id);
    if (!text) {
      console.log(`${id}: no content/texts/${id}.json`);
      failed++;
      continue;
    }
    const errors = checkText(text, texts.filter((t) => t.id < id));
    if (errors.length) {
      failed++;
      console.log(`${id} FAIL\n  - ${errors.join('\n  - ')}`);
    } else {
      console.log(`${id} ok`);
    }
  }
  process.exit(failed ? 1 : 0);
}
