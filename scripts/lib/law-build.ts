// Turns the parsed exports into a LawAct (src/lib/types.ts): known errata, the comparison of the
// TXT export with the XML export, ids, and the structural checks every act must pass.

import type { ActId, LawAct, LawChapter, LawId, LawParagraph, LawPart, LawPoint } from '../../src/lib/types.ts';
import {
  describe,
  displayNumber,
  isNextKey,
  toRoman,
  type RawChapter,
  type RawParagraph,
  type RawPart,
  type RawPoint,
} from './law-text.ts';
import type { TxtExport } from './law-txt.ts';
import type { XmlExport } from './law-xml.ts';

// Errata

/** A numbering error in the official text that both exports repeat. */
export interface Erratum {
  paragraph: string;
  /** Label number of the part; null for an unlabelled part. */
  part: string | null;
  /** The point before the wrong one, the wrong number as printed, and the right one. */
  after: string;
  found: string;
  fix: string;
}

/** Renumbers the point an erratum describes. Returns false when the source no longer has the error. */
export function applyErratum(paragraphs: RawParagraph[], erratum: Erratum): boolean {
  const paragraph = paragraphs.find((candidate) => candidate.number === erratum.paragraph);
  const part = paragraph?.parts.find((candidate) => candidate.number === erratum.part);
  if (!part) return false;
  const index = part.points.findIndex(
    (point, i) => point.number === erratum.found && part.points[i - 1]?.number === erratum.after,
  );
  const point = part.points[index];
  if (!point) return false;
  point.number = erratum.fix;
  return true;
}

export function describeErratum(erratum: Erratum): string {
  const part = erratum.part !== null ? `(${displayNumber(erratum.part)})` : '';
  return `§ ${displayNumber(erratum.paragraph)}${part}: the point after ${displayNumber(erratum.after)}) is numbered ${displayNumber(erratum.found)}) in Riigi Teataja; imported as ${displayNumber(erratum.fix)})`;
}

// TXT export against XML export

export interface CrossCheck {
  problems: string[];
  paragraphs: number;
  parts: number;
  points: number;
}

/**
 * Compares everything both exports contain: title, preamble, chapter headings, and for every §
 * its title, parts, points, texts and repeal marks. Chapter membership is compared only for §
 * that the XML places inside a chapter.
 */
export function crossCheck(txt: TxtExport, xml: XmlExport): CrossCheck {
  const problems: string[] = [];
  const differ = (what: string, fromTxt: unknown, fromXml: unknown): void => {
    if (fromTxt !== fromXml) {
      problems.push(`${what} differs\n      TXT: ${JSON.stringify(fromTxt)}\n      XML: ${JSON.stringify(fromXml)}`);
    }
  };
  /** Reports the first position where two lists differ. */
  const differList = (what: string, fromTxt: string[], fromXml: string[]): void => {
    for (let i = 0; i < Math.max(fromTxt.length, fromXml.length); i++) {
      if (fromTxt[i] !== fromXml[i]) {
        problems.push(
          `${what} differs at item ${i + 1}: TXT has ${fromTxt[i] ?? 'nothing'}, XML has ${fromXml[i] ?? 'nothing'} ` +
            `(${fromTxt.length} items in the TXT, ${fromXml.length} in the XML)`,
        );
        return;
      }
    }
  };

  differ('the title', txt.title, xml.metadata.title);
  differ('the preamble', txt.preamble, xml.preamble);
  differList('the chapter list', txt.chapters.map(chapterHeading), xml.chapters.map(chapterHeading));

  txt.chapters.forEach((chapter, index) => {
    const inTxt = new Set(chapter.paragraphs.map((paragraph) => paragraph.number));
    for (const number of xml.chapters[index]?.paragraphs ?? []) {
      if (!inTxt.has(number)) problems.push(`${describe(number)} is in chapter ${chapter.number} in the XML but not in the TXT`);
    }
  });

  const txtParagraphs = txt.chapters.flatMap((chapter) => chapter.paragraphs);
  differList(
    'the list of §',
    txtParagraphs.map((paragraph) => describe(paragraph.number)),
    xml.paragraphs.map((paragraph) => describe(paragraph.number)),
  );

  let parts = 0;
  let points = 0;
  const xmlByNumber = new Map(xml.paragraphs.map((paragraph) => [paragraph.number, paragraph]));
  for (const paragraph of txtParagraphs) {
    const other = xmlByNumber.get(paragraph.number);
    if (!other) continue;
    const where = describe(paragraph.number);
    differ(`${where}: the title`, paragraph.title, other.title);
    differ(`${where}: the repeal mark`, paragraph.repealed, other.repealed);
    differ(`${where}: the number of parts`, paragraph.parts.length, other.parts.length);
    paragraph.parts.forEach((part, index) => {
      const otherPart = other.parts[index];
      if (!otherPart) return;
      parts++;
      const partWhere = describe(paragraph.number, { number: part.number, index });
      differ(`${partWhere}: the label`, part.number, otherPart.number);
      differ(`${partWhere}: the repeal mark`, part.repealed, otherPart.repealed);
      differ(`${partWhere}: the text`, part.text, otherPart.text);
      differList(
        `${partWhere}: the list of points`,
        part.points.map((p) => `${displayNumber(p.number)})`),
        otherPart.points.map((p) => `${displayNumber(p.number)})`),
      );
      part.points.forEach((point, pointIndex) => {
        const otherPoint = otherPart.points[pointIndex];
        if (!otherPoint) return;
        points++;
        const pointWhere = describe(paragraph.number, { number: part.number, index }, point.number);
        differ(`${pointWhere}: the repeal mark`, point.repealed, otherPoint.repealed);
        differ(`${pointWhere}: the text`, point.text, otherPoint.text);
      });
    });
  }
  return { problems, paragraphs: txtParagraphs.length, parts, points };
}

function chapterHeading(chapter: { number: string; title: string }): string {
  return `${chapter.number}. ${chapter.title}`;
}

// Building the LawAct

export interface ActInput {
  act: ActId;
  title: string;
  edition: string;
  reference: string;
  inForceFrom: string;
  importedAt: string;
  preamble: string | null;
  chapters: RawChapter[];
}

export function buildLawAct(input: ActInput): LawAct {
  const { act } = input;
  const chapters: LawChapter[] = [];
  const paragraphs: Record<LawId, LawParagraph> = {};

  input.chapters.forEach((rawChapter, chapterIndex) => {
    const chapter: LawChapter = {
      id: `${act}-ch${chapterIndex + 1}`,
      number: rawChapter.number,
      title: rawChapter.title,
      paragraphs: [],
    };
    for (const rawParagraph of rawChapter.paragraphs) {
      const paragraph = buildParagraph(act, rawParagraph, chapter.id);
      paragraphs[paragraph.id] = paragraph;
      chapter.paragraphs.push(paragraph.id);
    }
    chapters.push(chapter);
  });

  return {
    act,
    title: input.title,
    edition: input.edition,
    reference: input.reference,
    inForceFrom: input.inForceFrom,
    url: `https://www.riigiteataja.ee/akt/${input.edition}`,
    importedAt: input.importedAt,
    preamble: input.preamble,
    chapters,
    paragraphs,
  };
}

function buildParagraph(act: ActId, raw: RawParagraph, chapter: string): LawParagraph {
  const id = `${act}-${raw.number}`;
  return {
    id,
    number: raw.number,
    title: raw.title,
    chapter,
    parts: raw.parts.map((part, index) => buildPart(id, part, index)),
    repealed: raw.repealed,
  };
}

/** Unlabelled parts (all of the Constitution's) are numbered by order and keep label null. */
function buildPart(paragraphId: LawId, raw: RawPart, index: number): LawPart {
  const number = raw.number ?? String(index + 1);
  const id = `${paragraphId}-lg${number}`;
  return {
    id,
    number,
    label: raw.number !== null ? `(${displayNumber(raw.number)})` : null,
    text: raw.text,
    points: raw.points.map((point) => buildPoint(id, point)),
    repealed: raw.repealed,
  };
}

function buildPoint(partId: LawId, raw: RawPoint): LawPoint {
  return { id: `${partId}-p${raw.number}`, number: raw.number, text: raw.text, repealed: raw.repealed };
}

// Checks every act must pass

export interface StructureRules {
  chapterNumbers: 'roman' | 'arabic';
  titledParagraphs: boolean;
  labeledParts: boolean;
}

export function validateLawAct(law: LawAct, rules: StructureRules): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const addId = (id: string): void => {
    if (ids.has(id)) problems.push(`duplicate id ${id}`);
    ids.add(id);
  };

  if (law.chapters.length === 0) problems.push('no chapters');
  law.chapters.forEach((chapter, index) => {
    const expected = rules.chapterNumbers === 'roman' ? toRoman(index + 1) : String(index + 1);
    if (chapter.number !== expected) problems.push(`chapter ${index + 1} is numbered "${chapter.number}", expected "${expected}"`);
    if (chapter.title === '') problems.push(`chapter ${chapter.number} has no title`);
    if (chapter.paragraphs.length === 0) problems.push(`chapter ${chapter.number} has no §`);
    addId(chapter.id);
  });

  const listed = law.chapters.flatMap((chapter) => chapter.paragraphs);
  const keys = Object.keys(law.paragraphs);
  if (listed.join(' ') !== keys.join(' ')) problems.push('the chapters do not list the § in the order of the act');
  checkSequence(keys.map((key) => law.paragraphs[key]!.number), 'the § numbers', problems);

  for (const chapter of law.chapters) {
    for (const id of chapter.paragraphs) {
      const paragraph = law.paragraphs[id];
      if (!paragraph) {
        problems.push(`chapter ${chapter.number} lists a missing § ${id}`);
        continue;
      }
      if (paragraph.chapter !== chapter.id) problems.push(`${id} names chapter ${paragraph.chapter}, but ${chapter.id} lists it`);
      validateParagraph(paragraph, rules, problems, addId);
    }
  }

  if (law.preamble !== null) checkText(law.preamble, 'the preamble', problems, true);
  return problems;
}

function validateParagraph(
  paragraph: LawParagraph,
  rules: StructureRules,
  problems: string[],
  addId: (id: string) => void,
): void {
  const where = describe(paragraph.number);
  addId(paragraph.id);
  if (rules.titledParagraphs && !paragraph.title) problems.push(`${where} has no title`);
  if (!rules.titledParagraphs && paragraph.title !== null) problems.push(`${where} has a title, unexpected in this act`);
  if (paragraph.title) checkText(paragraph.title, `${where}: the title`, problems);
  if (paragraph.repealed && paragraph.parts.length > 0) problems.push(`${where} is repealed but has parts`);
  if (!paragraph.repealed && paragraph.parts.length === 0) problems.push(`${where} has no parts`);

  const labelled = paragraph.parts.filter((part) => part.label !== null).length;
  if (!rules.labeledParts && labelled > 0) problems.push(`${where} has part labels, unexpected in this act`);
  if (labelled > 0 && labelled < paragraph.parts.length) problems.push(`${where} mixes labelled and unlabelled parts`);
  checkSequence(paragraph.parts.map((part) => part.number), `${where}: the part numbers`, problems);

  paragraph.parts.forEach((part, index) => {
    const partWhere = describe(paragraph.number, { number: part.label !== null ? part.number : null, index });
    addId(part.id);
    if (part.label !== null && part.label !== `(${displayNumber(part.number)})`) {
      problems.push(`${partWhere}: the label "${part.label}" does not match the number ${part.number}`);
    }
    if (part.repealed) {
      if (part.text !== '' || part.points.length > 0) problems.push(`${partWhere} is repealed but has text`);
    } else {
      checkText(part.text, partWhere, problems);
    }
    checkSequence(part.points.map((point) => point.number), `${partWhere}: the point numbers`, problems);
    for (const point of part.points) {
      addId(point.id);
      const pointWhere = `${partWhere} p ${displayNumber(point.number)}`;
      if (point.repealed) {
        if (point.text !== '') problems.push(`${pointWhere} is repealed but has text`);
      } else {
        checkText(point.text, pointWhere, problems);
      }
    }
  });
}

/** Numbers must run 1, 2, 2_1, 2_2, 3, ... without gaps or repeats. */
function checkSequence(numbers: string[], what: string, problems: string[]): void {
  if (numbers.length === 0) return;
  if (numbers[0] !== '1') problems.push(`${what} start at ${numbers[0]}, not 1`);
  for (let i = 1; i < numbers.length; i++) {
    if (!isNextKey(numbers[i - 1]!, numbers[i]!)) {
      problems.push(`${what} jump from ${numbers[i - 1]} to ${numbers[i]}`);
    }
  }
}

/** Normative text: non-empty, no leftovers of the export format, no stray whitespace. */
function checkText(text: string, where: string, problems: string[], multiline = false): void {
  const issues: string[] = [];
  if (text === '') issues.push('is empty');
  if (text.includes('^')) issues.push('contains "^"');
  if (/\[RT\b/.test(text) || /jõust\.\s*\d/.test(text)) issues.push('contains an amendment note');
  if (/\[kehtetu\b/i.test(text)) issues.push('contains a repeal note');
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(text) || (!multiline && text.includes('\n'))) issues.push('contains a control character');
  if (/\s{2,}|^\s|\s$/.test(text.replace(/\n/g, ' '))) issues.push('has stray whitespace');
  if (/[  ]/.test(text)) issues.push('contains a no-break space');
  for (const issue of issues) problems.push(`${where} ${issue}`);
}

// Looking up ids

export type LawUnit =
  | { kind: 'paragraph'; paragraph: LawParagraph }
  | { kind: 'part'; paragraph: LawParagraph; part: LawPart }
  | { kind: 'point'; paragraph: LawParagraph; part: LawPart; point: LawPoint };

export function findUnit(law: LawAct, id: LawId): LawUnit | null {
  for (const paragraph of Object.values(law.paragraphs)) {
    if (paragraph.id === id) return { kind: 'paragraph', paragraph };
    for (const part of paragraph.parts) {
      if (part.id === id) return { kind: 'part', paragraph, part };
      for (const point of part.points) {
        if (point.id === id) return { kind: 'point', paragraph, part, point };
      }
    }
  }
  return null;
}

/** The text of a §, part or point as lines, for a person to compare with the official text. */
export function formatUnit(law: LawAct, unit: LawUnit): string[] {
  const { paragraph } = unit;
  const chapter = law.chapters.find((candidate) => candidate.id === paragraph.chapter);
  const heading = `§ ${displayNumber(paragraph.number)}.${paragraph.title ? ` ${paragraph.title}` : ''}`;
  const chapterName = `chapter ${chapter?.number} ${chapter?.title}`;
  const lines: string[] = [];
  const partLine = (part: LawPart): string =>
    `${part.id.slice(paragraph.id.length + 1).padEnd(8)}${part.label ? `${part.label} ` : ''}${part.repealed ? '[repealed]' : part.text}`;
  const pointLine = (point: LawPoint): string =>
    `${''.padEnd(8)}${displayNumber(point.number)}) ${point.repealed ? '[repealed]' : point.text}`;

  if (unit.kind === 'paragraph') {
    const points = paragraph.parts.reduce((sum, part) => sum + part.points.length, 0);
    lines.push(
      `${heading}  (${chapterName}; ${paragraph.parts.length} part(s), ${points} point(s)${paragraph.repealed ? ', repealed' : ''})`,
    );
    for (const part of paragraph.parts) {
      lines.push(partLine(part));
      for (const point of part.points) lines.push(pointLine(point));
    }
  } else if (unit.kind === 'part') {
    lines.push(`${heading}  (${chapterName})`);
    lines.push(partLine(unit.part));
    for (const point of unit.part.points) lines.push(pointLine(point));
  } else {
    lines.push(`${heading}  (${chapterName})`);
    lines.push(`${unit.part.id.slice(paragraph.id.length + 1).padEnd(8)}${unit.part.label ? `${unit.part.label} ` : ''}${unit.part.text}`);
    lines.push(pointLine(unit.point));
  }
  return lines;
}
