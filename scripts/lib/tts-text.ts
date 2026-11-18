// Spoken text and synthesis chunks (DESIGN.md section 6).
// The displayed text never changes: these helpers only shape what is sent to the TTS API.

/** A range of a displayed text in UTF-16 code units: `text.slice(from, to)`. */
export interface TextRange {
  from: number;
  to: number;
}

/** Longest text sent in one request, in characters. Longer requests risk the server timeout. */
export const MAX_CHUNK = 250;

/** A split at a clause boundary leaves no piece shorter than this. */
const MIN_PIECE = 20;

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * The text sent to the API for a displayed text. The synthesiser expands numbers, "§" and
 * abbreviations itself ("§ 8 lg 2" is read as "paragrahv kaheksa lõige kaks") but not
 * superscripts, so "§ 2¹" becomes "§ 2 prim 1". Runs of whitespace, no-break spaces
 * included, become one space.
 */
export function toSpoken(display: string): string {
  return display
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/gu, (sup) => ` prim ${[...sup].map((c) => SUPERSCRIPT_DIGITS.indexOf(c)).join('')}`)
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Abbreviations whose full stop does not end a sentence, even before a capital letter. */
const ABBREVIATIONS = new Set(['nt', 'jne', 'jm', 'jt', 'vms', 'vt', 'nr', 'lk', 'hr', 'pr', 'dr', 'prof', 'sh', 'ca']);

/**
 * Sentence ranges of a text, trimmed. A sentence ends at ".", "!", "?" or "…", with any
 * closing quotes or brackets, when whitespace and a capital letter follow (an opening quote
 * or bracket may come before the letter). So ordinals and dates ("2016. aastal",
 * "01.07.1990") do not end a sentence.
 */
export function sentenceRanges(text: string): TextRange[] {
  const ranges: TextRange[] = [];
  let start = 0;
  for (const m of text.matchAll(/[.!?…]+["”»)\]]*(?=\s+["„“«(]?\p{Lu})/gu)) {
    const index = m.index ?? 0;
    const word = /(\p{L}+)$/u.exec(text.slice(start, index))?.[1] ?? '';
    if (m[0].startsWith('.') && ABBREVIATIONS.has(word.toLowerCase())) continue;
    const end = index + m[0].length;
    pushTrimmed(ranges, text, start, end);
    start = end;
  }
  pushTrimmed(ranges, text, start, text.length);
  return ranges;
}

function pushTrimmed(ranges: TextRange[], text: string, from: number, to: number): void {
  while (from < to && /\s/u.test(text.charAt(from))) from++;
  while (to > from && /\s/u.test(text.charAt(to - 1))) to--;
  if (to > from) ranges.push({ from, to });
}

/**
 * Splits a spoken text into pieces of at most about MAX_CHUNK characters, one API request
 * each: whole sentences where they fit, otherwise clause boundaries (see CLAUSE_BREAKS), and
 * spaces as a last resort. Neighbouring pieces are packed together while they fit.
 */
export function synthesisChunks(spoken: string, max = MAX_CHUNK): string[] {
  if (spoken.length <= max) return [spoken];
  const pieces = sentenceRanges(spoken).flatMap(({ from, to }) => splitClauses(spoken.slice(from, to), max));
  const chunks: string[] = [];
  for (const piece of pieces) {
    const last = chunks.length - 1;
    if (last >= 0 && chunks[last]!.length + 1 + piece.length <= max) chunks[last] += ` ${piece}`;
    else chunks.push(piece);
  }
  return chunks;
}

/**
 * Places to split a long sentence, strongest first: "; ", ": ", a comma before a conjunction
 * or a relative pronoun (it starts a clause), any other comma (it may sit inside a list),
 * a space before a conjunction, and any space as a last resort.
 */
const CLAUSE_BREAKS: { re: RegExp; minPiece: number }[] = [
  { re: /; /gu, minPiece: MIN_PIECE },
  { re: /: /gu, minPiece: MIN_PIECE },
  {
    re: /, (?=(?:kui|et|sest|kuid|aga|vaid|kuna|kuigi|ehkki|kuni|nagu|välja arvatud|mis|mida|mill\p{L}*|kes|keda|kell\p{L}*|kus|kuhu|kust)[\s,])/gu,
    minPiece: MIN_PIECE,
  },
  { re: /, /gu, minPiece: MIN_PIECE },
  { re: / (?=(?:ja|või|ning|ega|ehk|kui|et|mis|mida|mill\p{L}*|kes|kell\p{L}*)\s)/gu, minPiece: MIN_PIECE },
  { re: / /gu, minPiece: 1 },
];

/** Splits at the strongest boundary type present, at the position that balances the halves best. */
function splitClauses(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  for (const { re, minPiece } of CLAUSE_BREAKS) {
    let best: [string, string] | null = null;
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      // The punctuation mark stays with the left piece.
      const left = (text.slice(0, at) + m[0]).trimEnd();
      const right = text.slice(at + m[0].length).trimStart();
      if (left.length < minPiece || right.length < minPiece) continue;
      if (!best || Math.max(left.length, right.length) < Math.max(best[0].length, best[1].length)) {
        best = [left, right];
      }
    }
    if (best) return [...splitClauses(best[0], max), ...splitClauses(best[1], max)];
  }
  return [text];
}
