// Shared pieces of the law importer (scripts/import-law.ts): the error type, the intermediate
// structure that both Riigi Teataja exports are parsed into, and helpers for numbers and text.

/** Any problem with the sources or the result. The importer prints the message and exits with code 1. */
export class LawImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LawImportError';
  }
}

// Intermediate structure. Numbers are keys: "8", "2_1" for 2¹. Ids are assigned later.

export interface RawPoint {
  number: string;
  text: string;
  repealed: boolean;
}

export interface RawPart {
  /** From the label "(3^1)" → "3_1"; null when the official text shows no label. */
  number: string | null;
  /** The text before the points, if any. Empty when repealed. */
  text: string;
  repealed: boolean;
  points: RawPoint[];
}

export interface RawParagraph {
  number: string;
  title: string | null;
  /** A repealed § has no parts. */
  repealed: boolean;
  parts: RawPart[];
}

export interface RawChapter {
  /** As printed: "I", "1". */
  number: string;
  title: string;
  paragraphs: RawParagraph[];
}

// Numbers

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** "12" → "¹²". */
export function superscript(digits: string): string {
  if (!/^\d+$/.test(digits)) {
    throw new LawImportError(`A superscript is not a number: "${digits}"`);
  }
  return [...digits].map((digit) => SUPERSCRIPT_DIGITS.charAt(Number(digit))).join('');
}

/** "2" with superscript "1" → "2_1"; "8" without one → "8". */
export function numberKey(base: string, sup?: string | null): string {
  if (!/^\d+$/.test(base) || (sup != null && !/^\d+$/.test(sup))) {
    throw new LawImportError(`Not a provision number: "${base}"${sup != null ? ` with superscript "${sup}"` : ''}`);
  }
  return sup != null ? `${Number(base)}_${Number(sup)}` : String(Number(base));
}

/** "2_1" → [2, 1], "8" → [8, 0]. */
export function splitKey(key: string): [number, number] {
  const match = /^(\d+)(?:_(\d+))?$/.exec(key);
  if (!match) throw new LawImportError(`Not a number key: "${key}"`);
  return [Number(match[1]), match[2] !== undefined ? Number(match[2]) : 0];
}

/** "2_1" → "2¹", as the official text prints it. */
export function displayNumber(key: string): string {
  const [base, sup] = splitKey(key);
  return sup > 0 ? `${base}${superscript(String(sup))}` : String(base);
}

/** True when `next` directly follows `previous`: 2 → 3, 2 → 2_1, 2_1 → 2_2, 2_3 → 3. */
export function isNextKey(previous: string, next: string): boolean {
  const [base, sup] = splitKey(previous);
  const [nextBase, nextSup] = splitKey(next);
  return (nextBase === base && nextSup === sup + 1) || (nextBase === base + 1 && nextSup === 0);
}

/** 15 → "XV". */
export function toRoman(value: number): string {
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let rest = value;
  let roman = '';
  for (const [amount, letters] of table) {
    while (rest >= amount) {
      roman += letters;
      rest -= amount;
    }
  }
  return roman;
}

// Text

/** Collapses every run of whitespace, no-break spaces and line breaks included, to one space. */
export function collapseSpaces(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Like collapseSpaces, but keeps line breaks between non-empty lines (the Constitution's preamble). */
export function collapseLines(text: string): string {
  return text
    .split('\n')
    .map(collapseSpaces)
    .filter((line) => line !== '')
    .join('\n');
}

/** Where a provision sits, for messages: "§ 2¹", "§ 13(4¹)", "§ 8 part 2", "§ 21(1) p 6". */
export function describe(paragraph: string, part?: { number: string | null; index: number }, point?: string): string {
  let where = `§ ${displayNumber(paragraph)}`;
  if (part) {
    where += part.number !== null ? `(${displayNumber(part.number)})` : ` part ${part.index + 1}`;
  }
  if (point !== undefined) where += ` p ${displayNumber(point)}`;
  return where;
}
