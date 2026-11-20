// Master plan scheduler (DESIGN.md 4.4, 4.5, 8).
//   pnpm plan             rebuild the unwritten slots of content/plan.json; written slots, ideas,
//                         characters and general new words are kept
//   pnpm plan --next N    print the next N unwritten slots
//
// The scheduler fills slot structure: stage, area, type, length, grammar, law block, § returns,
// planned exam words and words to repeat. The agent adds characters, the idea and general words.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type {
  Area,
  ExamWord,
  LawAct,
  LawId,
  LawParagraph,
  Plan,
  PlanSlot,
  Stage,
  TextEntry,
  TextType,
  Token,
} from '../src/lib/types';

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const PLAN = 'content/plan.json';

// ---- Shape of the course --------------------------------------------------------------------

const PLANNED = 230;
const SPARE = 20;

const STAGES: { stage: Stage; from: number; to: number }[] = [
  { stage: 0, from: 1, to: 20 },
  { stage: 1, from: 21, to: 90 },
  { stage: 2, from: 91, to: 130 },
  { stage: 3, from: 131, to: 200 },
  { stage: 4, from: 201, to: 230 },
];

const CURVE: { upTo: number; length: [number, number]; newWords: [number, number]; grammar: string }[] = [
  { upTo: 20, length: [120, 200], newWords: [5, 6], grammar: 'present tense, simple sentences' },
  { upTo: 80, length: [200, 300], newWords: [7, 8], grammar: 'past tense, clauses with et and kui' },
  { upTo: 160, length: [300, 400], newWords: [8, 10], grammar: 'impersonal passive -takse/-ti, peab, võib' },
  { upTo: 200, length: [400, 500], newWords: [6, 10], grammar: 'closer to legal language' },
  { upTo: Infinity, length: [400, 500], newWords: [0, 2], grammar: 'legal language' },
];

const REPEAT_CAP: Record<TextType, (stage: Stage) => number> = {
  serial: (s) => [6, 8, 10, 12, 12][s],
  side: (s) => [6, 8, 10, 12, 12][s],
  summary: () => 16,
  review: () => 20,
};

// Stage 0 is curated (DESIGN.md 4.4): chapters I and III in detail, then a first look at areas 2-4.
// Overview § come back in full in their own stage; area 1 § are done here.
const STAGE0: Record<number, { law: LawId[]; area: Area; type: TextType }> = {
  1: { law: ['ps-1'], area: 1, type: 'serial' },
  2: { law: ['ps-2'], area: 1, type: 'serial' },
  3: { law: ['ps-3'], area: 1, type: 'serial' },
  4: { law: ['ps-4'], area: 1, type: 'serial' },
  6: { law: ['ps-5'], area: 1, type: 'serial' },
  7: { law: ['ps-6'], area: 1, type: 'serial' },
  8: { law: ['ps-7'], area: 1, type: 'serial' },
  9: { law: ['ps-56'], area: 1, type: 'serial' },
  11: { law: ['ps-57'], area: 1, type: 'serial' },
  12: { law: ['ps-58'], area: 1, type: 'side' },
  13: { law: ['ps-9', 'ps-12'], area: 2, type: 'serial' },
  14: { law: ['ps-59', 'ps-77', 'ps-86'], area: 3, type: 'serial' },
  16: { law: ['ps-8-lg1', 'kods-2'], area: 4, type: 'serial' },
  17: { law: ['ps-146'], area: 3, type: 'side' },
  18: { law: ['kods-6'], area: 4, type: 'serial' },
  19: { law: ['ps-54', 'ps-55'], area: 2, type: 'serial' },
};

// Related § of chapters VII-X for area 3 (author, 18.11; DESIGN.md 2.3): laws, budget, treaties, defence.
const PS_RELATED = [
  'ps-102', 'ps-103', 'ps-104', 'ps-105', 'ps-107', 'ps-108', 'ps-109', 'ps-110',
  'ps-115', 'ps-119', 'ps-121', 'ps-123', 'ps-127', 'ps-128', 'ps-129',
];

// Stage 4 review blocks by area.
const REVIEW_BLOCKS: { area: Area; from: number; to: number }[] = [
  { area: 1, from: 201, to: 204 },
  { area: 2, from: 205, to: 213 },
  { area: 3, from: 214, to: 223 },
  { area: 4, from: 224, to: 230 },
];

// ---- Inputs ----------------------------------------------------------------------------------

const ps = read<LawAct>('content/law/constitution.json');
const kods = read<LawAct>('content/law/citizenship-act.json');
const vocab = read<ExamWord[]>('content/vocab/exam-vocab.json');
const old: Plan | null = existsSync(PLAN) ? read<Plan>(PLAN) : null;
const written = new Map(
  readdirSync('content/texts')
    .filter((f) => /^\d{4}\.json$/.test(f))
    .map((f) => read<TextEntry>(`content/texts/${f}`))
    .map((t) => [t.slot, t]),
);

const paraNum = (p: LawParagraph) => Number(p.number.split('_')[0]) + (p.number.includes('_') ? Number(p.number.split('_')[1]) / 10 : 0);
const psParas = Object.values(ps.paragraphs).filter((p) => !p.repealed);
const kodsParas = Object.values(kods.paragraphs).filter((p) => !p.repealed);
const chapterOf = (p: LawParagraph) => p.chapter;

function paragraphText(p: LawParagraph): string {
  return p.parts.map((x) => [x.text, ...x.points.map((y) => y.text)].join(' ')).join(' ');
}

interface Unit {
  ids: LawId[];
  para: LawId;
  weight: number;
  parts: { id: LawId; weight: number }[];
}

const unitOf = (p: LawParagraph): Unit => ({
  ids: [p.id],
  para: p.id,
  weight: paragraphText(p).length,
  parts: p.parts.filter((x) => !x.repealed).map((x) => ({ id: x.id, weight: [x.text, ...x.points.map((y) => y.text)].join(' ').length })),
});

const byIds = (ids: LawId[]) => ids.map((id) => {
  const p = ps.paragraphs[id] ?? kods.paragraphs[id];
  if (!p) throw new Error(`plan: unknown § ${id}`);
  return unitOf(p);
});

const stageUnits: Record<1 | 2 | 3, Unit[]> = {
  1: psParas.filter((p) => chapterOf(p) === 'ps-ch2' && p.id !== 'ps-8').map(unitOf),
  2: [ps.paragraphs['ps-8'], ...kodsParas.filter((p) => paraNum(p) <= 35)].map(unitOf),
  3: [
    ...psParas.filter((p) => ['ps-ch4', 'ps-ch5', 'ps-ch6'].includes(chapterOf(p))).map(unitOf),
    ...byIds(PS_RELATED),
    ...psParas.filter((p) => chapterOf(p) === 'ps-ch13').map(unitOf),
  ],
};

// ---- Partition: consecutive § into n slots of 1-3 §, balanced by text length ------------------

function partition(units: Unit[], n: number): Unit[][] {
  let items = [...units];
  // Too few § for the slots: split the longest § with several parts into two halves.
  while (items.length < n) {
    const i = items.reduce((best, u, k) => (u.parts.length > 1 && u.weight > (items[best]?.weight ?? -1) ? k : best), -1);
    if (i < 0) break;
    const u = items[i];
    const half = Math.ceil(u.parts.length / 2);
    const a = u.parts.slice(0, half);
    const b = u.parts.slice(half);
    const mk = (ps: typeof a): Unit => ({ ids: ps.map((x) => x.id), para: u.para, weight: ps.reduce((s, x) => s + x.weight, 0), parts: ps });
    items.splice(i, 1, mk(a), mk(b));
  }
  const m = items.length;
  if (m > 3 * n) throw new Error(`plan: ${m} § do not fit ${n} slots`);
  const target = items.reduce((s, u) => s + u.weight, 0) / n;
  // cost[g][i]: best cost to put the first i items into g groups
  const cost = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const back = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(-1));
  cost[0][0] = 0;
  for (let g = 1; g <= n; g++) {
    for (let i = 1; i <= m; i++) {
      for (let size = 1; size <= 3 && size <= i; size++) {
        const prev = cost[g - 1][i - size];
        if (prev === Infinity) continue;
        const w = items.slice(i - size, i).reduce((s, u) => s + u.weight, 0);
        const c = prev + (w - target) ** 2;
        if (c < cost[g][i]) {
          cost[g][i] = c;
          back[g][i] = size;
        }
      }
    }
  }
  if (cost[n][m] === Infinity) {
    // Fewer items than slots even after splitting: one item per slot, the rest of the slots stay empty.
    return Array.from({ length: n }, (_, k) => (items[k] ? [items[k]] : []));
  }
  const groups: Unit[][] = [];
  for (let g = n, i = m; g > 0; g--) {
    const size = back[g][i];
    groups.unshift(items.slice(i - size, i));
    i -= size;
  }
  return groups;
}

// ---- Slots ----------------------------------------------------------------------------------

const curveFor = (order: number) => CURVE.find((c) => order <= c.upTo)!;
const stageOf = (order: number): Stage => STAGES.find((s) => order >= s.from && order <= s.to)?.stage ?? 4;
const isSummary = (order: number) => order <= 200 && order % 5 === 0;

const slots: PlanSlot[] = [];
for (let order = 1; order <= PLANNED + SPARE; order++) {
  const spare = order > PLANNED;
  const stage = spare ? 4 : stageOf(order);
  const c = curveFor(spare ? 201 : order);
  const summary = !spare && isSummary(order);
  // Main serial vs side stories: in each run of four non-summary texts, the fourth is a side story.
  const type: TextType = stage === 4 ? 'review' : summary ? 'summary' : ((order % 5) === 4 ? 'side' : 'serial');
  slots.push({
    id: `s${String(order).padStart(3, '0')}`,
    order,
    stage,
    area: 1,
    type,
    spare,
    law: [],
    returns: [],
    newWordCount: summary || stage === 4 ? c.newWords[0] : c.newWords[1],
    newWords: [],
    phrases: [],
    repeat: [],
    characters: [],
    idea: '',
    length: c.length,
    grammar: c.grammar,
    textId: null,
  });
}

// Stage 0, curated
for (const [order, s] of Object.entries(STAGE0)) {
  const slot = slots[Number(order) - 1];
  Object.assign(slot, s);
}

// Stages 1-3, partitioned in chapter order
const areaOfPara = (id: LawId): Area => {
  if (id.startsWith('kods-') || id.startsWith('ps-8')) return 4;
  const ch = (ps.paragraphs[id.split('-lg')[0]] ?? ps.paragraphs[id])?.chapter;
  if (ch === 'ps-ch1' || ch === 'ps-ch3') return 1;
  if (ch === 'ps-ch2') return 2;
  return 3;
};
for (const st of [1, 2, 3] as const) {
  const range = STAGES.find((s) => s.stage === st)!;
  const open = slots.filter((s) => s.order >= range.from && s.order <= range.to && s.type !== 'summary');
  const groups = partition(stageUnits[st], open.length);
  open.forEach((slot, k) => {
    slot.law = groups[k].flatMap((u) => u.ids);
    slot.area = slot.law.length ? areaOfPara(groups[k][0].para) : (st === 1 ? 2 : st === 2 ? 4 : 3);
  });
}

// Summaries take the area most of their four texts have
for (const slot of slots.filter((s) => s.type === 'summary')) {
  const prev = slots.slice(slot.order - 5, slot.order - 1);
  const count = new Map<Area, number>();
  for (const p of prev) count.set(p.area, (count.get(p.area) ?? 0) + 1);
  slot.area = [...count].sort((a, b) => b[1] - a[1])[0][0];
}

// Review blocks
for (const b of REVIEW_BLOCKS) for (let o = b.from; o <= b.to; o++) slots[o - 1].area = b.area;
for (const slot of slots.filter((s) => s.spare)) slot.area = 2;

// ---- § returns: next summary, one later text, one review text --------------------------------

const paraIdOf = (id: LawId) => id.split('-lg')[0];
const RETURN_CAP: Record<TextType, number> = { serial: 2, side: 2, summary: 8, review: 12 };
const addReturn = (slot: PlanSlot | undefined, para: LawId): boolean => {
  if (!slot || slot.returns.includes(para) || slot.law.some((l) => paraIdOf(l) === para)) return false;
  if (slot.returns.length >= RETURN_CAP[slot.type]) return false;
  slot.returns.push(para);
  return true;
};
for (const slot of slots.filter((s) => s.stage < 4 && s.law.length)) {
  for (const para of [...new Set(slot.law.map(paraIdOf))]) {
    const nextSummary = slots.find((s) => s.order > slot.order && s.type === 'summary');
    addReturn(nextSummary, para);
    const later = slots
      .filter((s) => s.order >= slot.order + 6 && s.order <= slot.order + 25 && s.stage < 4 && s.type !== 'summary')
      .sort((a, b) => a.returns.length - b.returns.length || Number(b.area === slot.area) - Number(a.area === slot.area));
    for (const s of later) if (addReturn(s, para)) break;
    const review = slots
      .filter((s) => s.type === 'review' && !s.spare && s.area === areaOfPara(para))
      .sort((a, b) => a.returns.length - b.returns.length || a.order - b.order);
    for (const s of review) if (addReturn(s, para)) break;
  }
}

// ---- Written slots are frozen as written ----------------------------------------------------

const introducedAt = new Map<string, number>(); // lemma -> slot order where it is a new word
for (const slot of slots) {
  const text = written.get(slot.id);
  if (!text) continue;
  const prev = old?.slots.find((s) => s.id === slot.id);
  Object.assign(slot, prev ?? {}, {
    textId: text.id,
    law: text.law,
    newWords: text.newWords.map((w) => w.lemma).filter((l) => !l.includes(' ')),
    phrases: text.newWords.map((w) => w.lemma).filter((l) => l.includes(' ')),
  });
  slot.newWordCount = slot.newWords.length;
  for (const l of slot.newWords) introducedAt.set(l.toLowerCase(), slot.order);
}

// ---- What the agent added to unwritten slots stays: characters, idea, general words -----------

const SKIP_TAGS = new Set(['xref', 'duplicate', 'prefix']);
const entries = vocab.filter((e) => !e.tags.some((t) => SKIP_TAGS.has(t)) && (e.lemmas?.length ?? 0) > 0);
const examLemmas = new Set(entries.flatMap((e) => e.lemmas!));
for (const slot of slots) {
  if (slot.textId) continue;
  const prev = old?.slots.find((s) => s.id === slot.id);
  if (!prev) continue;
  slot.characters = prev.characters;
  slot.idea = prev.idea;
  const general = prev.newWords.filter((w) => !examLemmas.has(w.toLowerCase()));
  slot.newWords.push(...general.slice(0, slot.newWordCount));
  for (const l of slot.newWords) introducedAt.set(l.toLowerCase(), slot.order);
}

// ---- Exam words: taught as single lemmas; multiword entries come as phrases -------------------

const lawTokens = read<Record<string, { para: LawId; tokens: { l: string | null; alt?: string[] }[] }>>('content/law/tokens.json');
const base = read<{ lemmas: { lemma: string; level: string }[] }>('content/vocab/base.json');
const levelOf = new Map<string, string>();
for (const b of base.lemmas) {
  const k = b.lemma.toLowerCase();
  if (!levelOf.has(k) || b.level < levelOf.get(k)!) levelOf.set(k, b.level);
}
const lemmaRefs = new Map<string, Set<LawId>>();
for (const unit of Object.values(lawTokens)) {
  for (const t of unit.tokens) {
    for (const l of [t.l, ...(t.alt ?? [])]) {
      if (!l) continue;
      const k = l.toLowerCase();
      if (!lemmaRefs.has(k)) lemmaRefs.set(k, new Set());
      lemmaRefs.get(k)!.add(unit.para);
    }
  }
}

// Teaching units: every lemma of an exam entry that is not A1. A2 lemmas count as known from
// text 21 (DESIGN.md 4.5), so they are taught only where a stage 0 law block needs them.
interface WordUnit {
  lemma: string;
  entries: number;
  refs: Set<LawId>;
  a2: boolean;
}
const units = new Map<string, WordUnit>();
for (const e of entries) {
  for (const l of e.lemmas!) {
    if (levelOf.get(l) === 'A1' || /\d/.test(l) || l.length < 2) continue;
    const u = units.get(l) ?? { lemma: l, entries: 0, refs: lemmaRefs.get(l) ?? new Set<LawId>(), a2: levelOf.get(l) === 'A2' };
    u.entries++;
    units.set(l, u);
  }
}
const capacity = (s: PlanSlot) => s.newWordCount - s.newWords.length;
const examSlots = slots.filter((s) => !s.spare && s.stage < 4 && !s.textId);
const priority = (a: WordUnit, b: WordUnit) =>
  b.entries - a.entries || b.refs.size - a.refs.size || a.lemma.localeCompare(b.lemma, 'et');

// 1. A lemma goes into the first slot whose law block contains it.
for (const slot of examSlots) {
  const paras = new Set(slot.law.map(paraIdOf));
  const cands = [...units.values()]
    .filter((u) => !introducedAt.has(u.lemma) && (!u.a2 || slot.stage === 0) && [...u.refs].some((r) => paras.has(r)))
    .sort(priority);
  for (const u of cands) {
    if (capacity(slot) <= 0) break;
    slot.newWords.push(u.lemma);
    introducedAt.set(u.lemma, slot.order);
  }
}

// 2. The rest go into a slot of their area's stage; lemmas found in no exam § spread over stages 1-3.
const stageForArea: Record<Area, Stage> = { 1: 0, 2: 1, 3: 3, 4: 2 };
const AREA3_CHAPTERS = new Set(['ps-ch4', 'ps-ch5', 'ps-ch6', 'ps-ch13']);
const areaOfRef = (r: LawId): Area | null => {
  if (r.startsWith('kods-')) return Number(r.split('-')[1].split('_')[0]) <= 35 ? 4 : null;
  if (r === 'ps-8') return 4;
  const ch = ps.paragraphs[r]?.chapter ?? '';
  if (ch === 'ps-ch1' || ch === 'ps-ch3') return 1;
  if (ch === 'ps-ch2') return 2;
  return AREA3_CHAPTERS.has(ch) || PS_RELATED.includes(r) ? 3 : null;
};
const unplaced: string[] = [];
for (const u of [...units.values()].filter((x) => !introducedAt.has(x.lemma) && !x.a2).sort(priority)) {
  const areas = [...new Set([...u.refs].map(areaOfRef).filter((a): a is Area => a !== null))];
  const stages: Stage[] = areas.length ? areas.map((a) => stageForArea[a]).filter((s) => s > 0) : [1, 2, 3];
  const byRoom = (a: PlanSlot, b: PlanSlot) => capacity(b) - capacity(a) || a.order - b.order;
  const slot =
    examSlots.filter((s) => capacity(s) > 0 && (stages.length ? stages.includes(s.stage) : s.stage > 0)).sort(byRoom)[0] ??
    examSlots.filter((s) => capacity(s) > 0 && s.stage > 0).sort(byRoom)[0];
  if (!slot) {
    unplaced.push(u.lemma);
    continue;
  }
  slot.newWords.push(u.lemma);
  introducedAt.set(u.lemma, slot.order);
}

// 3. A multiword entry is a phrase of the first slot where all its words are known or already
//    introduced, preferably a slot within 30 texts whose law block contains the phrase.
const PHRASE_CAP = (s: PlanSlot) => (s.stage === 0 ? 1 : s.type === 'summary' ? 3 : 2);
const readyAt = (seq: string[]) =>
  Math.max(
    1,
    ...seq.map((l) => {
      const lv = levelOf.get(l);
      if (lv === 'A1' || /\d/.test(l) || l.length < 2) return 1;
      return introducedAt.get(l) ?? (lv === 'A2' ? 21 : Infinity);
    }),
  );
const writtenPhrases = new Set(slots.filter((s) => s.textId).flatMap((s) => s.phrases.map((x) => x.toLowerCase())));
const unplacedPhrases: string[] = [];
for (const e of entries.filter((x) => x.lemmas!.length > 1 && !writtenPhrases.has(x.lemma.toLowerCase()))) {
  const ready = readyAt(e.lemmas!);
  const refs = new Set(e.refs);
  const open = examSlots.filter((s) => s.order >= ready && s.phrases.length < PHRASE_CAP(s));
  const inLaw = (s: PlanSlot) => s.law.some((l) => refs.has(paraIdOf(l)));
  // The phrase's own § if a later law block has it; otherwise a text of its area's stage (stages 1-3
  // when it occurs in no exam §), the one with the fewest phrases. Stage 0 takes only phrases of its own §.
  const areas = [...new Set([...refs].map(areaOfRef).filter((a): a is Area => a !== null))];
  const stages: Stage[] = areas.length ? areas.map((a) => stageForArea[a]).filter((x) => x > 0) : [1, 2, 3];
  const fewest = (a: PlanSlot, b: PlanSlot) => a.phrases.length - b.phrases.length || a.order - b.order;
  const slot =
    open.find(inLaw) ??
    open.filter((s) => s.stage > 0 && (stages.length ? stages.includes(s.stage) : true)).sort(fewest)[0] ??
    open.filter((s) => s.stage > 0).sort(fewest)[0];
  if (!slot) {
    unplacedPhrases.push(e.lemma);
    continue;
  }
  slot.phrases.push(e.lemma);
}

// ---- Words to repeat: window rule, then spaced repetition (DESIGN.md 4.5) ----------------------
// Written slots keep the lists they were written with. Every introduced word and phrase gets up to
// three texts in its window (n+1..n+10), minus the written texts there that already use it; when the
// window has passed with a shortfall, the next unwritten slots take it. Then one spaced text
// (n+15..n+40) and one review text of its area.

const storyOf = new Map<number, Token[]>();
for (const slot of slots) {
  const t = written.get(slot.id);
  if (t) storyOf.set(slot.order, t.segments.flatMap((x) => x.tokens ?? []));
}
const seqByLemma = new Map(entries.map((e) => [e.lemma.toLowerCase(), e.lemmas!]));
const seqOf = (w: string) => seqByLemma.get(w.toLowerCase()) ?? w.toLowerCase().split(/\s+/);
const lemmasOf = (t: Token) => [t.l, ...(t.alt ?? [])].filter((x): x is string => !!x).map((x) => x.toLowerCase());
const occursIn = (seq: string[], toks: Token[]) => {
  // Same matching as scripts/check.ts: words of a multiword item also match surface forms.
  const sets = toks
    .filter((t) => t.p !== 'Z')
    .map((t) => new Set(seq.length > 1 ? [...lemmasOf(t), t.f.toLowerCase()] : lemmasOf(t)));
  const width = seq.length + 3;
  for (let i = 0; i < Math.max(1, sets.length - width + 1); i++) {
    const win = sets.slice(i, i + width);
    if (seq.every((x) => win.some((w) => w.has(x)))) return true;
  }
  return false;
};

const open = (s: PlanSlot) => !s.textId && !s.spare;
for (const slot of slots) if (open(slot)) slot.repeat = [];
const firstOpen = slots.find(open)?.order ?? Infinity;
const repeatCap = (s: PlanSlot) => REPEAT_CAP[s.type](s.stage);
const addRepeat = (s: PlanSlot | undefined, w: string) => {
  if (!s || !open(s) || s.repeat.includes(w) || s.newWords.includes(w) || s.phrases.includes(w)) return false;
  if (s.repeat.length >= repeatCap(s)) return false;
  s.repeat.push(w);
  return true;
};
const pick = (from: number, to: number, w: string, pred: (s: PlanSlot) => boolean = () => true) => {
  const cands = slots.filter((s) => s.order >= from && s.order <= to && open(s) && pred(s));
  cands.sort((a, b) => a.repeat.length / repeatCap(a) - b.repeat.length / repeatCap(b) || a.order - b.order);
  for (const s of cands) if (addRepeat(s, w)) return true;
  return false;
};
for (const slot of slots.filter((s) => !s.spare)) {
  for (const w of [...slot.newWords, ...slot.phrases]) {
    const n = slot.order;
    const seq = seqOf(w);
    let hits = 0;
    for (let o = n + 1; o <= n + 10; o++) {
      const toks = storyOf.get(o);
      if (toks && occursIn(seq, toks)) hits++;
    }
    let need = Math.max(0, 3 - hits);
    const summary = slots.find((s) => open(s) && s.order > n && s.order <= n + 4 && s.type === 'summary');
    if (need > 0 && addRepeat(summary, w)) need--;
    while (need > 0 && pick(Math.max(n + 1, firstOpen), n + 10, w)) need--;
    while (need > 0 && pick(firstOpen, firstOpen + 9, w)) need--;
    pick(Math.max(n + 15, firstOpen), Math.max(n + 40, firstOpen + 25), w);
    pick(201, 230, w, (s) => s.area === slot.area);
  }
}

// ---- Output ---------------------------------------------------------------------------------

const arc = old?.arc ?? [];
const plan: Plan = { generatedAt: new Date().toISOString().slice(0, 10), arc, slots };
const args = process.argv.slice(2);
if (args[0] === '--next') {
  const n = Number(args[1] ?? 15);
  const next = (old ?? plan).slots.filter((s) => !s.textId && !s.spare).slice(0, n);
  for (const s of next) {
    console.log(`${s.id} #${s.order} stage ${s.stage} area ${s.area} ${s.type}  law: ${s.law.join(', ') || '-'}  returns: ${s.returns.join(', ') || '-'}`);
    console.log(`  new (${s.newWords.length}/${s.newWordCount}): ${s.newWords.join(', ')}`);
    console.log(`  phrases: ${s.phrases.join(' | ') || '-'}`);
    console.log(`  repeat: ${s.repeat.join(', ')}`);
    console.log(`  characters: ${s.characters.join(', ') || '-'}  idea: ${s.idea || '-'}`);
  }
} else {
  writeFileSync(PLAN, JSON.stringify(plan, null, 2) + '\n');
  const lawCovered = new Set(slots.flatMap((s) => s.law.map(paraIdOf)));
  const thin = [...lawCovered].filter((p) => slots.filter((s) => s.returns.includes(p)).length < 2);
  const taught = [...units.values()].filter((u) => !u.a2 && introducedAt.has(u.lemma)).length;
  const a2InStage0 = [...units.values()].filter((u) => u.a2 && introducedAt.has(u.lemma)).length;
  console.log(`${PLAN}: ${slots.length} slots (${PLANNED} planned, ${SPARE} spare)`);
  console.log(`§ in law blocks: ${lawCovered.size}; with fewer than 2 returns: ${thin.length} ${thin.slice(0, 10).join(', ')}`);
  console.log(`exam lemmas to teach: ${[...units.values()].filter((u) => !u.a2).length}; placed: ${taught}; not placed: ${unplaced.length} ${unplaced.slice(0, 10).join(', ')}`);
  console.log(`A2 lemmas taught in stage 0: ${a2InStage0}`);
  console.log(`phrases placed: ${slots.reduce((n, x) => n + x.phrases.length, 0)}; not placed: ${unplacedPhrases.length} ${unplacedPhrases.slice(0, 10).join(' | ')}`);
  const free = examSlots.reduce((n, x) => n + Math.max(0, capacity(x)), 0);
  console.log(`new-word places left for general words: ${free}`);
}
