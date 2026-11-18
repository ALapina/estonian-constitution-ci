import charactersJson from '../../content/characters.json';
import type {
  ActId,
  Character,
  LawAct,
  LawChapter,
  LawId,
  LawParagraph,
  LawPart,
  LawPoint,
  Stage,
  TextEntry,
} from './types';

const textModules = import.meta.glob<TextEntry>('../../content/texts/*.json', {
  eager: true,
  import: 'default',
});
const lawModules = import.meta.glob<LawAct>('../../content/law/*.json', {
  eager: true,
  import: 'default',
});

export const characters = charactersJson as Record<string, Character>;

export function allTexts(): TextEntry[] {
  return Object.values(textModules).sort((a, b) => a.id.localeCompare(b.id));
}

export const STAGE_TITLES: Record<Stage, string> = {
  0: 'Этап 0. Обзор',
  1: 'Этап 1. Права и свободы',
  2: 'Этап 2. Гражданство',
  3: 'Этап 3. Институты власти',
  4: 'Этап 4. Повторение',
};

export const ACT_HEADINGS: Record<ActId, string> = {
  ps: 'Põhiseadus ütleb',
  kods: 'Kodakondsuse seadus ütleb',
};

export function lawAct(act: ActId): LawAct | undefined {
  return Object.values(lawModules).find((a) => a.act === act);
}

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

/** "2_1" -> "2¹" */
export function displayNumber(n: string): string {
  const [main, sup] = n.split('_');
  return sup ? main + [...sup].map((d) => SUPERSCRIPT[d] ?? d).join('') : main;
}

export interface ResolvedLaw {
  id: LawId;
  act: LawAct;
  chapter: LawChapter | undefined;
  paragraph: LawParagraph;
  part?: LawPart;
  point?: LawPoint;
}

const LAW_ID = /^(ps|kods)-(\d+(?:_\d+)?)(?:-lg(\d+(?:_\d+)?))?(?:-p(\d+(?:_\d+)?))?$/;

export function resolveLaw(id: LawId): ResolvedLaw | undefined {
  const m = LAW_ID.exec(id);
  if (!m) return undefined;
  const act = lawAct(m[1] as ActId);
  const paragraph = act?.paragraphs[`${m[1]}-${m[2]}`];
  if (!act || !paragraph) return undefined;
  const part = m[3] ? paragraph.parts.find((p) => p.number === m[3]) : undefined;
  const point = part && m[4] ? part.points.find((p) => p.number === m[4]) : undefined;
  if ((m[3] && !part) || (m[4] && !point)) return undefined;
  const chapter = act.chapters.find((c) => c.id === paragraph.chapter);
  return { id, act, chapter, paragraph, part, point };
}

/** "§ 8", "§ 8 lg 2", "§ 21 lg 1 p 6", "§ 2¹" */
export function citation(id: LawId): string {
  const m = LAW_ID.exec(id);
  if (!m) return id;
  let s = `§ ${displayNumber(m[2])}`;
  if (m[3]) s += ` lg ${displayNumber(m[3])}`;
  if (m[4]) s += ` p ${displayNumber(m[4])}`;
  return s;
}

/** Link to the § in the current edition on Riigi Teataja. */
export function riigiTeatajaUrl(act: LawAct, paragraph?: LawParagraph): string {
  const base = `https://www.riigiteataja.ee/akt/${act.edition}?leiaKehtiv`;
  if (!paragraph || paragraph.number.includes('_')) return base;
  return `${base}#para${paragraph.number}`;
}
