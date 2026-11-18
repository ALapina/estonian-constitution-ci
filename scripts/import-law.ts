// Imports the Constitution and the Citizenship Act from Riigi Teataja into content/law/ as LawAct
// JSON (src/lib/types.ts). DESIGN.md sections 2.3, 2.4, 4.7 and 9.
//
//   pnpm import:law              download the XML and TXT exports, keep copies in .cache/law/
//   pnpm import:law --offline    use the copies in .cache/law/ instead of downloading
//
// Chapters, §, parts and points come from the TXT export. The title, the reference and the date of
// entry into force come from the XML export. The texts of the two exports must agree. Nothing is
// written unless both acts pass every check.

import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ActId, LawAct } from '../src/lib/types.ts';
import {
  applyErratum,
  buildLawAct,
  crossCheck,
  describeErratum,
  findUnit,
  formatUnit,
  validateLawAct,
  type Erratum,
  type LawUnit,
} from './lib/law-build.ts';
import { exportUrl, loadExport, type LoadedExport } from './lib/law-fetch.ts';
import { LawImportError, describe } from './lib/law-text.ts';
import { parseTxtExport, type TxtOptions } from './lib/law-txt.ts';
import { readXmlExport } from './lib/law-xml.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CACHE_DIR = join(ROOT, '.cache', 'law');
const OUTPUT_DIR = join(ROOT, 'content', 'law');
const MAX_PROBLEMS_SHOWN = 40;

interface SpotCheck {
  id: string;
  /** Returns a problem, or null when the provision has the expected shape. */
  check?: (unit: LawUnit) => string | null;
}

interface ActConfig {
  act: ActId;
  /** Riigi Teataja id of the consolidated edition (DESIGN.md section 2.4). */
  edition: string;
  /** File name in content/law/. */
  file: string;
  txt: TxtOptions;
  chapterNumbers: 'roman' | 'arabic';
  errata: Erratum[];
  /** Checks specific to the act (DESIGN.md section 2.3). */
  expect: (law: LawAct) => string[];
  /** Printed after the import for a person to compare with the official text. */
  spotChecks: SpotCheck[];
}

const ACTS: ActConfig[] = [
  {
    act: 'ps',
    edition: '111042025003',
    file: 'constitution.json',
    txt: { titledParagraphs: false, labeledParts: false },
    chapterNumbers: 'roman',
    errata: [],
    expect: expectConstitution,
    spotChecks: [
      { id: 'ps-8', check: (unit) => expectParts(unit, 5) },
      { id: 'ps-60' },
      { id: 'ps-65', check: (unit) => (countPoints(unit) > 0 ? null : 'expected points') },
      { id: 'ps-156' },
    ],
  },
  {
    act: 'kods',
    edition: '126062025008',
    file: 'citizenship-act.json',
    txt: { titledParagraphs: true, labeledParts: true },
    chapterNumbers: 'arabic',
    errata: [
      // Riigi Teataja prints the fifth point of § 2¹(3) as "1)": 3), 4), 1), 6), 7) (XML and TXT).
      { paragraph: '2_1', part: '3', after: '4', found: '1', fix: '5' },
    ],
    expect: expectCitizenshipAct,
    spotChecks: [
      { id: 'kods-2_1' },
      { id: 'kods-13-lg4_1' },
      { id: 'kods-21-lg1-p6' },
      { id: 'kods-34' },
    ],
  },
];

// Act-specific checks

function expectConstitution(law: LawAct): string[] {
  const problems: string[] = [];
  if (law.chapters.length !== 15) problems.push(`expected 15 chapters (I-XV), found ${law.chapters.length}`);
  compareIds(Object.keys(law.paragraphs), range(1, 168).map((n) => `ps-${n}`), '§ 1-168 in order', problems);
  if (law.preamble === null) problems.push('the preamble is missing');
  return problems;
}

function expectCitizenshipAct(law: LawAct): string[] {
  const problems: string[] = [];
  if (law.chapters.length < 6) problems.push(`expected at least 6 chapters, found ${law.chapters.length}`);
  const examChapters = [
    ...['1', '2', '2_1', '2_2', '2_3', '2_4'],
    ...range(3, 8).map(String),
    ...['8_1', '8_2', '8_3'],
    ...range(9, 14).map(String),
    '14_1',
    ...range(15, 30).map(String),
  ].map((n) => `kods-${n}`);
  compareIds(
    law.chapters.slice(0, 6).flatMap((chapter) => chapter.paragraphs),
    examChapters,
    'chapters 1-6: § 1-30 with § 2¹-2⁴, 8¹-8³ and 14¹',
    problems,
  );
  if (law.paragraphs['kods-11']?.repealed !== true) problems.push('§ 11 should be repealed');
  for (const n of range(31, 35)) {
    if (!law.paragraphs[`kods-${n}`]) problems.push(`§ ${n} is missing`);
  }
  if (law.preamble !== null) problems.push('unexpected preamble');
  return problems;
}

function compareIds(actual: string[], expected: string[], what: string, problems: string[]): void {
  const length = Math.max(actual.length, expected.length);
  for (let i = 0; i < length; i++) {
    if (actual[i] !== expected[i]) {
      problems.push(
        `${what}: at position ${i + 1} expected ${expected[i] ?? 'nothing'}, found ${actual[i] ?? 'nothing'} (${actual.length} found, ${expected.length} expected)`,
      );
      return;
    }
  }
}

function expectParts(unit: LawUnit, count: number): string | null {
  const found = unit.kind === 'paragraph' ? unit.paragraph.parts.length : 1;
  return found === count ? null : `expected ${count} parts, found ${found}`;
}

function countPoints(unit: LawUnit): number {
  if (unit.kind === 'point') return 1;
  const parts = unit.kind === 'paragraph' ? unit.paragraph.parts : [unit.part];
  return parts.reduce((sum, part) => sum + part.points.length, 0);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

// Import of one act

interface Imported {
  config: ActConfig;
  law: LawAct;
  path: string;
}

async function importAct(config: ActConfig, offline: boolean, importedAt: string): Promise<Imported> {
  console.log(`\n${config.act} ${config.edition}`);
  const log = (message: string): void => console.log(`  ${message}`);
  const load = (format: 'xml' | 'txt'): Promise<LoadedExport> =>
    loadExport(config.edition, format, { cacheDir: CACHE_DIR, offline, log });

  const xmlFile = await load('xml');
  const txtFile = await load('txt');
  for (const file of [xmlFile, txtFile]) {
    log(`${file.from === 'cache' ? 'cached    ' : 'downloaded'} ${(file.bytes / 1024).toFixed(0).padStart(4)} KB  ${file.url}`);
  }

  const xml = readXmlExport(xmlFile.text);
  const txt = parseTxtExport(txtFile.text, config.txt);
  const notes = [...xml.notes, ...txt.notes];
  const problems: string[] = [];

  // The edition and its metadata, in both exports.
  const { metadata } = xml;
  if (metadata.edition !== config.edition) problems.push(`the XML is edition ${metadata.edition}, not ${config.edition}`);
  if (metadata.textType !== 'terviktekst') problems.push(`the XML is "${metadata.textType}", not a consolidated text (terviktekst)`);
  const txtReference = txt.header['Avaldamismärge'];
  if (txtReference !== metadata.reference) problems.push(`the reference is "${txtReference}" in the TXT and "${metadata.reference}" in the XML`);
  const txtStart = isoDate(txt.header['Redaktsiooni jõustumise kp']);
  if (txtStart !== metadata.inForceFrom) problems.push(`the edition takes effect on ${txtStart} in the TXT and on ${metadata.inForceFrom} in the XML`);
  const validUntil = txt.header['Redaktsiooni kehtivuse lõpp'];
  if (validUntil === undefined) {
    problems.push('the TXT header has no "Redaktsiooni kehtivuse lõpp" line');
  } else if (validUntil !== 'Hetkel kehtiv') {
    notes.push(`WARNING: Riigi Teataja says this edition is valid until ${validUntil}; a newer edition may be in force`);
  }
  if (xml.outsideChapters.length > 0) {
    notes.push(`XML: ${describeList(xml.outsideChapters)} sit outside every chapter; chapters come from the TXT`);
  }

  for (const erratum of config.errata) {
    const fixedInTxt = applyErratum(txt.chapters.flatMap((chapter) => chapter.paragraphs), erratum);
    const fixedInXml = applyErratum(xml.paragraphs, erratum);
    if (fixedInTxt || fixedInXml) notes.push(`erratum: ${describeErratum(erratum)}`);
    if (!fixedInTxt || !fixedInXml) {
      const missing = [fixedInTxt ? '' : 'TXT', fixedInXml ? '' : 'XML'].filter(Boolean).join(' and ');
      notes.push(`WARNING: the erratum "${describeErratum(erratum)}" does not match the ${missing}; remove it if Riigi Teataja fixed the text`);
    }
  }

  const comparison = crossCheck(txt, xml);
  problems.push(...comparison.problems.map((problem) => `TXT and XML disagree: ${problem}`));

  const law = buildLawAct({
    act: config.act,
    title: metadata.title,
    edition: metadata.edition,
    reference: metadata.reference,
    inForceFrom: metadata.inForceFrom,
    importedAt,
    preamble: txt.preamble,
    chapters: txt.chapters,
  });
  problems.push(...validateLawAct(law, { chapterNumbers: config.chapterNumbers, ...config.txt }));
  problems.push(...config.expect(law));
  for (const spot of config.spotChecks) {
    const unit = findUnit(law, spot.id);
    const problem = unit ? spot.check?.(unit) ?? null : 'not found';
    if (problem) problems.push(`spot check ${spot.id}: ${problem}`);
  }

  for (const note of notes) log(note);
  if (problems.length > 0) {
    const shown = problems.slice(0, MAX_PROBLEMS_SHOWN).map((problem) => `  - ${problem}`);
    if (problems.length > MAX_PROBLEMS_SHOWN) shown.push(`  ... and ${problems.length - MAX_PROBLEMS_SHOWN} more`);
    throw new LawImportError(`${config.act} ${config.edition}: ${problems.length} problem(s)\n${shown.join('\n')}`);
  }
  log(
    `TXT and XML agree: ${comparison.paragraphs} §, ${comparison.parts} parts, ${comparison.points} points` +
      (law.preamble !== null ? ', the preamble' : ''),
  );
  return { config, law, path: join(OUTPUT_DIR, config.file) };
}

/** "01.03.2026" → "2026-03-01". */
function isoDate(estonian: string | undefined): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(estonian ?? '');
  return match ? `${match[3]}-${match[2]}-${match[1]}` : `"${estonian}"`;
}

/** ["104", "105", "106"] → "§ 104-106"; other lists are joined with commas. */
function describeList(numbers: string[]): string {
  const plain = numbers.every((n) => /^\d+$/.test(n));
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  if (plain && first !== undefined && last !== undefined && Number(last) - Number(first) === numbers.length - 1) {
    return numbers.length === 1 ? describe(first) : `§ ${first}-${last}`;
  }
  return numbers.map((n) => describe(n)).join(', ');
}

function localDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Output

function printSummary(results: Imported[]): void {
  console.log('\nSummary');
  for (const { config, law, path } of results) {
    const paragraphs = Object.values(law.paragraphs);
    const parts = paragraphs.flatMap((paragraph) => paragraph.parts);
    const points = parts.flatMap((part) => part.points);
    const repealed = (items: Array<{ repealed: boolean }>): string => {
      const count = items.filter((item) => item.repealed).length;
      return count > 0 ? ` (${count} repealed)` : '';
    };
    const preamble = law.preamble !== null ? `, preamble of ${law.preamble.split('\n').length} lines` : '';
    console.log(`  ${config.act.padEnd(5)}${law.title}, ${law.reference}, in force from ${law.inForceFrom}`);
    console.log(
      `       ${law.chapters.length} chapters, ${paragraphs.length} §${repealed(paragraphs)}, ` +
        `${parts.length} parts${repealed(parts)}, ${points.length} points${repealed(points)}${preamble}`,
    );
    console.log(`       wrote ${relative(ROOT, path)}`);
  }
}

function printSpotChecks(results: Imported[]): void {
  console.log('\nSpot checks: compare with the TXT export');
  for (const { config, law } of results) {
    console.log(`  (${exportUrl(config.edition, 'txt')})`);
    for (const spot of config.spotChecks) {
      const unit = findUnit(law, spot.id);
      if (!unit) continue;
      console.log(`\n  ${spot.id}`);
      for (const line of formatUnit(law, unit)) console.log(`    ${line}`);
    }
    console.log('');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== '--offline');
  if (unknown.length > 0) {
    throw new LawImportError(`unknown argument ${unknown.join(' ')}; usage: pnpm import:law [--offline]`);
  }
  const offline = args.includes('--offline');
  const importedAt = localDate(new Date());

  console.log(`Law import from Riigi Teataja, ${importedAt}${offline ? ' (offline: .cache/law)' : ''}`);
  const results: Imported[] = [];
  for (const config of ACTS) results.push(await importAct(config, offline, importedAt));

  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const { law, path } of results) await writeFile(path, `${JSON.stringify(law, null, 2)}\n`);

  printSummary(results);
  printSpotChecks(results);
}

main().catch((error: unknown) => {
  if (error instanceof LawImportError) {
    console.error(`\nLaw import failed; nothing was written.\n${error.message}`);
  } else {
    console.error('\nLaw import failed with an unexpected error; nothing was written.');
    console.error(error);
  }
  process.exitCode = 1;
});
