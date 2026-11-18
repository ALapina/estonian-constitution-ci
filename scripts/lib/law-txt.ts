// Parses the TXT export of an act (an undocumented endpoint, see law-fetch.ts). The importer takes
// chapters, §, parts and points from here. Layout of the export, as of November 2026:
//
//   Key: value lines           Väljaandja, Akti liik, ..., Avaldamismärge
//   Title
//   "Vastu võetud ..." block   adoption; skipped
//   "Muudetud järgmiste aktidega" block   list of amending acts; skipped
//   preamble lines             Constitution only
//   I. peatükk ÜLDSÄTTED       chapter heading ("1. peatükk Üldsätted" in the Citizenship Act)
//   § 1. text | § 1. Title     the Constitution starts the first part on the heading line;
//                              the Citizenship Act puts the § title there
//   (1) text                   a part; the Constitution has no labels, blank lines separate its parts
//   1) text                    a point, on the line after its part or the previous point
//   [RT I, ... - jõust. ...]   amendment note on its own line; not normative text, dropped
//   [Kehtetu - RT I, ...]      repealed: alone for a whole §, or after a part or point label
//   Õiend                      editorial note after the last § of the Constitution; ignored
//
// Superscripts are written "^1" ("§ 2^1.", "(3^1)", "2^1)"). Inside text the export adds a space
// after each one ("§ 15^5  tähenduses", "2^1 . lõikes"); that space is removed.

import {
  LawImportError,
  collapseLines,
  collapseSpaces,
  describe,
  numberKey,
  superscript,
  type RawChapter,
  type RawParagraph,
  type RawPart,
} from './law-text.ts';

export interface TxtOptions {
  /** § headings carry a title (Citizenship Act) rather than the start of the first part (Constitution). */
  titledParagraphs: boolean;
  /** Parts carry labels such as "(1)" and "(3^1)" (Citizenship Act). */
  labeledParts: boolean;
}

export interface TxtExport {
  /** The "Key: value" lines at the top, e.g. "Avaldamismärge" → "RT I, 11.04.2025, 3". */
  header: Record<string, string>;
  title: string;
  preamble: string | null;
  chapters: RawChapter[];
  notes: string[];
}

const HEADER_LINE = /^([^:]+):\s*(.*)$/;
const CHAPTER = /^([IVXLC]+|\d+)\.\s+peatükk\s+(\S.*)$/;
const PARAGRAPH = /^§\s*(\d+)(?:\^(\d+))?\.(?:\s+(.*))?$/;
const PART = /^\((\d+)(?:\^(\d+))?\)\s*(.*)$/;
const POINT = /^(\d+)(?:\^(\d+))?\)\s*(.*)$/;
const AMENDMENT_NOTE = /^\[RT\b[^\]]*\]$/;
const REPEALED = /^\[kehtetu\b[^\]]*\]$/i;
const ADOPTION_BLOCK = /^Vastu võetud\b/;
const AMENDMENTS_BLOCK = /^Muudetud järgmiste aktidega$/;
const EDITORIAL_NOTE = 'Õiend';

export function parseTxtExport(source: string, options: TxtOptions): TxtExport {
  const lines = source.split('\n').map((line) => line.trim());
  const notes: string[] = [];
  let index = 0;

  function fail(lineIndex: number, message: string): never {
    throw new LawImportError(`TXT line ${lineIndex + 1}: ${message}: ${JSON.stringify(lines[lineIndex] ?? '')}`);
  }
  function skipBlank(): void {
    while (index < lines.length && lines[index] === '') index++;
  }
  /** Text with "^n" turned into superscript digits and whitespace collapsed. */
  function clean(text: string, lineIndex: number): string {
    const result = collapseSpaces(text.replace(/\^(\d+) ?/g, (_match, digits: string) => superscript(digits)));
    if (result.includes('^')) fail(lineIndex, 'unexpected "^"');
    return result;
  }

  // Header: "Key: value" lines up to the first blank line.
  const header: Record<string, string> = {};
  skipBlank();
  while (index < lines.length && lines[index] !== '') {
    const match = HEADER_LINE.exec(lines[index]!) ?? fail(index, 'expected a "Key: value" header line');
    header[match[1]!.trim()] = match[2]!.trim();
    index++;
  }

  // Title: one line on its own.
  skipBlank();
  const titleIndex = index;
  const title = clean(lines[index] ?? '', index);
  if (title === '') fail(index, 'expected the title of the act');
  index++;
  if (index < lines.length && lines[index] !== '') fail(index, 'expected a blank line after the title');

  // Blocks before the first chapter: adoption, list of amending acts, preamble.
  const preambleLines: string[] = [];
  for (;;) {
    skipBlank();
    const line = lines[index];
    if (line === undefined) fail(titleIndex, 'no chapter heading after the title');
    if (CHAPTER.test(line)) break;
    if (PARAGRAPH.test(line)) fail(index, 'a § before the first chapter heading');
    const skip = ADOPTION_BLOCK.test(line) || AMENDMENTS_BLOCK.test(line);
    while (index < lines.length && lines[index] !== '') {
      if (!skip && !AMENDMENT_NOTE.test(lines[index]!)) preambleLines.push(clean(lines[index]!, index));
      index++;
    }
  }
  const preamble = collapseLines(preambleLines.join('\n'));

  // Body.
  const chapters: RawChapter[] = [];
  let chapter: RawChapter | null = null;
  let paragraph: RawParagraph | null = null;
  let paragraphLine = 0;
  let part: RawPart | null = null;
  let afterBlank = true;

  function closeParagraph(): void {
    if (!paragraph || !chapter) return;
    if (!paragraph.repealed && paragraph.parts.length === 0) {
      fail(paragraphLine, `${describe(paragraph.number)} has no text`);
    }
    if (options.labeledParts && paragraph.parts.length > 1 && paragraph.parts.some((p) => p.number === null)) {
      fail(paragraphLine, `${describe(paragraph.number)} mixes labelled and unlabelled parts`);
    }
    chapter.paragraphs.push(paragraph);
    paragraph = null;
    part = null;
  }

  for (; index < lines.length; index++) {
    const line = lines[index]!;
    if (line === '') {
      afterBlank = true;
      continue;
    }
    if (AMENDMENT_NOTE.test(line)) continue;

    if (line === EDITORIAL_NOTE) {
      const after = paragraph ? describe(paragraph.number) : 'the last §';
      notes.push(`TXT: left out the editorial note "${EDITORIAL_NOTE}" after ${after}`);
      break;
    }

    const chapterMatch = CHAPTER.exec(line);
    if (chapterMatch) {
      closeParagraph();
      chapter = { number: chapterMatch[1]!, title: clean(chapterMatch[2]!, index), paragraphs: [] };
      chapters.push(chapter);
      afterBlank = false;
      continue;
    }

    const paragraphMatch = PARAGRAPH.exec(line);
    if (paragraphMatch) {
      closeParagraph();
      if (!chapter) fail(index, 'a § before the first chapter heading');
      const opened: RawParagraph = {
        number: numberKey(paragraphMatch[1]!, paragraphMatch[2]),
        title: null,
        repealed: false,
        parts: [],
      };
      const rest = paragraphMatch[3] ?? '';
      if (REPEALED.test(rest)) {
        opened.repealed = true;
      } else if (options.titledParagraphs) {
        opened.title = clean(rest, index);
        if (opened.title === '') fail(index, `${describe(opened.number)} has no title`);
      } else if (rest !== '') {
        part = { number: null, text: clean(rest, index), repealed: false, points: [] };
        opened.parts.push(part);
      }
      paragraph = opened;
      paragraphLine = index;
      afterBlank = false;
      continue;
    }

    if (!paragraph) fail(index, 'text outside a §');
    const current: RawParagraph = paragraph;
    if (current.repealed) fail(index, `text after the repeal note of ${describe(current.number)}`);

    const partMatch = options.labeledParts ? PART.exec(line) : null;
    const pointMatch = partMatch ? null : POINT.exec(line);

    if (partMatch) {
      if (!afterBlank) fail(index, 'a part label not at the start of a block');
      const rest = partMatch[3]!;
      const repealed = REPEALED.test(rest);
      const text = repealed ? '' : clean(rest, index);
      if (!repealed && text === '') fail(index, 'a part without text');
      part = { number: numberKey(partMatch[1]!, partMatch[2]), text, repealed, points: [] };
      current.parts.push(part);
    } else if (pointMatch) {
      const owner: RawPart | null = part;
      if (afterBlank || !owner) fail(index, 'a point that does not follow its part');
      if (owner.repealed) fail(index, 'a point in a repealed part');
      const rest = pointMatch[3]!;
      const repealed = REPEALED.test(rest);
      const text = repealed ? '' : clean(rest, index);
      if (!repealed && text === '') fail(index, 'a point without text');
      owner.points.push({ number: numberKey(pointMatch[1]!, pointMatch[2]), text, repealed });
    } else if (REPEALED.test(line)) {
      if (!afterBlank) fail(index, 'a repeal note inside a block');
      if (current.parts.length === 0) {
        // The whole § is repealed: "§ 11. Title", a blank line, "[Kehtetu - ...]".
        current.repealed = true;
      } else if (!options.labeledParts) {
        part = { number: null, text: '', repealed: true, points: [] };
        current.parts.push(part);
      } else {
        fail(index, 'a repeal note without a part label');
      }
    } else {
      // Unlabelled text starts a part; it never continues the line before it.
      if (!afterBlank) fail(index, 'a line that continues the one before it');
      part = { number: null, text: clean(line, index), repealed: false, points: [] };
      current.parts.push(part);
    }
    afterBlank = false;
  }
  closeParagraph();

  if (chapters.length === 0) throw new LawImportError('TXT: no chapters found');
  for (const found of chapters) {
    if (found.paragraphs.length === 0) throw new LawImportError(`TXT: chapter ${found.number} has no §`);
  }

  return { header, title, preamble: preamble === '' ? null : preamble, chapters, notes };
}
