// Reads the XML export of an act (schema tyviseadus_1_10.02.2010): metadata, chapters and the text
// of every §. The importer takes the metadata from here and compares the text with the TXT export.
// Chapter membership and part order come from the TXT export, because the Constitution's XML has
// § 104-110 outside chapter VII and no part numbers (DESIGN.md section 9).

import {
  LawImportError,
  collapseLines,
  collapseSpaces,
  describe,
  numberKey,
  superscript,
  type RawParagraph,
  type RawPart,
  type RawPoint,
} from './law-text.ts';

// A minimal XML parser: elements, attributes, text, CDATA. Enough for the Riigi Teataja exports,
// which are machine-made and well formed; anything else fails with the offset.

export interface XmlElement {
  /** Local name, without a namespace prefix. */
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

export type XmlNode = XmlElement | string;

const TOKEN = new RegExp(
  [
    String.raw`<!\[CDATA\[([\s\S]*?)\]\]>`, // 1: CDATA
    String.raw`<!--[\s\S]*?-->`,
    String.raw`<\?[\s\S]*?\?>`,
    String.raw`<!DOCTYPE[^>]*>`,
    String.raw`<\/([^\s>]+)\s*>`, // 2: closing tag
    String.raw`<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>`, // 3: name, 4: attributes, 5: self-closing
    String.raw`([^<]+)`, // 6: text
  ].join('|'),
  'y',
);

const ATTRIBUTE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export function parseXml(source: string): XmlElement {
  const document: XmlElement = { name: '#document', attrs: {}, children: [] };
  const stack: XmlElement[] = [document];
  const rawNames: string[] = [];
  let position = 0;

  while (position < source.length) {
    TOKEN.lastIndex = position;
    const match = TOKEN.exec(source);
    if (!match) {
      throw new LawImportError(`XML: cannot parse at offset ${position}: ${JSON.stringify(source.slice(position, position + 40))}`);
    }
    position = TOKEN.lastIndex;
    const parent = stack[stack.length - 1]!;
    const [, cdata, closing, opening, attributes, selfClosing, text] = match;

    if (cdata !== undefined) {
      parent.children.push(htmlToText(cdata));
    } else if (closing !== undefined) {
      if (stack.length === 1 || rawNames[rawNames.length - 1] !== closing) {
        throw new LawImportError(`XML: unexpected </${closing}> at offset ${match.index}`);
      }
      stack.pop();
      rawNames.pop();
    } else if (opening !== undefined) {
      const element: XmlElement = { name: localName(opening), attrs: {}, children: [] };
      for (const attribute of (attributes ?? '').matchAll(ATTRIBUTE)) {
        element.attrs[localName(attribute[1]!)] = decodeEntities(attribute[2] ?? attribute[3] ?? '');
      }
      parent.children.push(element);
      if (selfClosing !== '/') {
        stack.push(element);
        rawNames.push(opening);
      }
    } else if (text !== undefined) {
      parent.children.push(decodeEntities(text));
    }
  }

  if (stack.length !== 1) {
    throw new LawImportError(`XML: the document ends inside <${rawNames[rawNames.length - 1]}>; the download may be truncated`);
  }
  const roots = elements(document);
  if (roots.length !== 1) throw new LawImportError(`XML: expected one root element, found ${roots.length}`);
  return roots[0]!;
}

function localName(name: string): string {
  return name.slice(name.indexOf(':') + 1);
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entity, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(Number(body.slice(1)));
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
    const value = named[body];
    if (value === undefined) throw new LawImportError(`XML: unknown entity ${entity}`);
    return value;
  });
}

/** CDATA in these exports holds small HTML fragments, such as "§ 2<sup>1</sup>. ". */
function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<sup>\s*(\d+)\s*<\/sup>/gi, (_match, digits: string) => superscript(digits))
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  );
}

export function elements(node: XmlElement, name?: string): XmlElement[] {
  return node.children.filter(
    (child): child is XmlElement => typeof child !== 'string' && (name === undefined || child.name === name),
  );
}

function firstElement(node: XmlElement, name: string): XmlElement | undefined {
  return elements(node, name)[0];
}

function requireElement(node: XmlElement, name: string, context: string): XmlElement {
  const found = firstElement(node, name);
  if (!found) throw new LawImportError(`XML: <${node.name}> has no <${name}> (${context})`);
  return found;
}

function descendants(node: XmlElement, name: string, found: XmlElement[] = []): XmlElement[] {
  for (const child of elements(node)) {
    if (child.name === name) found.push(child);
    descendants(child, name, found);
  }
  return found;
}

function plainText(node: XmlNode): string {
  return typeof node === 'string' ? node : node.children.map(plainText).join('');
}

// Text of the act

/** Renders mixed content: superscripts, line breaks, link texts; amendment notes are left out. */
function renderInline(node: XmlNode): string {
  if (typeof node === 'string') return node;
  switch (node.name) {
    case 'sup':
      return superscript(collapseSpaces(plainText(node)));
    case 'reavahetus':
    case 'br':
      return '\n';
    case 'muutmismarge':
    case 'viideURID':
      return '';
    case 'viide':
      return elements(node, 'kuvatavTekst').map(renderInline).join('');
    default:
      return node.children.map(renderInline).join('');
  }
}

/** A <sisuTekst> holds elements only; the whitespace between them is layout, not text. */
function renderContent(sisuTekst: XmlElement): string {
  return elements(sisuTekst).map(renderInline).join('');
}

function renderContents(parent: XmlElement): string {
  return collapseSpaces(elements(parent, 'sisuTekst').map(renderContent).join(' '));
}

/** A repealed provision has no text, only an amendment note that starts with "Kehtetu". */
function hasRepealMark(element: XmlElement): boolean {
  return elements(element, 'muutmismarge').some((note) =>
    elements(note, 'tavatekst').some((text) => /^\s*kehtetu\b/i.test(plainText(text))),
  );
}

function readNumber(element: XmlElement, name: string, context: string): string {
  const numberElement = requireElement(element, name, context);
  return numberKey(collapseSpaces(plainText(numberElement)), numberElement.attrs['ylaIndeks'] ?? null);
}

function readPoint(element: XmlElement, paragraph: string, part: { number: string | null; index: number }): RawPoint {
  const number = readNumber(element, 'alampunktNr', describe(paragraph, part));
  const text = renderContents(element);
  const repealed = text === '' && hasRepealMark(element);
  if (text === '' && !repealed) {
    throw new LawImportError(`XML: ${describe(paragraph, part, number)} has no text and no repeal note`);
  }
  return { number, text, repealed };
}

function readPart(element: XmlElement, paragraph: string, index: number): RawPart {
  const numberElement = firstElement(element, 'loigeNr');
  const number = numberElement ? readNumber(element, 'loigeNr', describe(paragraph)) : null;
  const where = { number, index };
  const text = renderContents(element);
  const points = elements(element, 'alampunkt').map((point) => readPoint(point, paragraph, where));
  const repealed = text === '' && points.length === 0 && hasRepealMark(element);
  if (text === '' && !repealed) {
    throw new LawImportError(`XML: ${describe(paragraph, where)} has no text and no repeal note`);
  }
  return { number, text, repealed, points };
}

/** The Constitution's XML carries the editorial note "Õiend" as a last part of § 168. */
function isEditorialNote(part: XmlElement): boolean {
  const first = firstElement(part, 'sisuTekst');
  return first !== undefined && /^\s*Õiend\s/.test(renderContent(first));
}

function readParagraph(element: XmlElement, notes: string[]): RawParagraph {
  const number = readNumber(element, 'paragrahvNr', '<paragrahv>');
  const titleElement = firstElement(element, 'paragrahvPealkiri');
  const title = titleElement ? collapseSpaces(renderInline(titleElement)) || null : null;
  const parts: RawPart[] = [];

  // A § can hold its text directly, without a part (Citizenship Act § 37).
  const direct = renderContents(element);
  if (direct !== '') parts.push({ number: null, text: direct, repealed: false, points: [] });

  for (const part of elements(element, 'loige')) {
    if (isEditorialNote(part)) {
      notes.push(`XML: left out the editorial note "Õiend" stored as a part of ${describe(number)}`);
      continue;
    }
    parts.push(readPart(part, number, parts.length));
  }

  const repealed = parts.length === 0 && hasRepealMark(element);
  if (parts.length === 0 && !repealed) {
    throw new LawImportError(`XML: ${describe(number)} has no text and no repeal note`);
  }
  return { number, title, repealed, parts };
}

// Metadata

export interface XmlMetadata {
  title: string;
  /** globaalID: the id of the consolidated edition. */
  edition: string;
  /** "RT I, 11.04.2025, 3" */
  reference: string;
  /** ISO date the edition took effect. */
  inForceFrom: string;
  /** "terviktekst" for a consolidated text. */
  textType: string;
}

function readMetadata(root: XmlElement): XmlMetadata {
  const meta = requireElement(root, 'metaandmed', 'act metadata');
  const name = requireElement(requireElement(root, 'aktinimi', 'act title'), 'nimi', 'act title');
  const published = requireElement(meta, 'avaldamismarge', 'publication of the edition');
  const validity = requireElement(meta, 'kehtivus', 'validity of the edition');
  const field = (parent: XmlElement, tag: string): string =>
    collapseSpaces(plainText(requireElement(parent, tag, `<${parent.name}>`)));

  const start = field(validity, 'kehtivuseAlgus');
  const inForceFrom = /^\d{4}-\d{2}-\d{2}/.exec(start)?.[0];
  if (!inForceFrom) throw new LawImportError(`XML: unexpected date of entry into force: "${start}"`);

  return {
    title: collapseSpaces(renderInline(requireElement(name, 'pealkiri', 'act title'))),
    edition: field(meta, 'globaalID'),
    reference: formatReference(published, field),
    inForceFrom,
    textType: field(meta, 'tekstiliik'),
  };
}

/** "RT I, 11.04.2025, 3" since 2010; "RT I 2003, 29, 174" before. */
function formatReference(published: XmlElement, field: (parent: XmlElement, tag: string) => string): string {
  const part = field(published, 'RTosa');
  const article = field(published, 'RTartikkel');
  if (firstElement(published, 'avaldamineKuupaev')) {
    const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(field(published, 'avaldamineKuupaev'));
    if (!date) throw new LawImportError('XML: unexpected publication date');
    return `${part}, ${date[3]}.${date[2]}.${date[1]}, ${article}`;
  }
  return `${part} ${field(published, 'RTaasta')}, ${field(published, 'RTnr')}, ${article}`;
}

// The whole export

export interface XmlChapter {
  number: string;
  title: string;
  /** Number keys of the § inside the chapter element. */
  paragraphs: string[];
}

export interface XmlExport {
  metadata: XmlMetadata;
  preamble: string | null;
  chapters: XmlChapter[];
  /** Every § in document order, wherever it sits. */
  paragraphs: RawParagraph[];
  /** Number keys of § that sit outside every chapter element. */
  outsideChapters: string[];
  notes: string[];
}

export function readXmlExport(source: string): XmlExport {
  const root = parseXml(source);
  if (root.name !== 'oigusakt') {
    throw new LawImportError(`XML: the root element is <${root.name}>, not <oigusakt>; is this a Riigi Teataja act?`);
  }
  const notes: string[] = [];
  const content = requireElement(root, 'sisu', 'act content');

  const chapters = descendants(content, 'peatykk').map((chapter) => ({
    number: collapseSpaces(plainText(requireElement(chapter, 'peatykkNr', 'chapter'))),
    title: collapseSpaces(renderInline(requireElement(chapter, 'peatykkPealkiri', 'chapter'))),
    paragraphs: descendants(chapter, 'paragrahv').map((paragraph) => readNumber(paragraph, 'paragrahvNr', '<paragrahv>')),
  }));
  const paragraphs = descendants(content, 'paragrahv').map((paragraph) => readParagraph(paragraph, notes));
  const inChapters = new Set(chapters.flatMap((chapter) => chapter.paragraphs));
  const outsideChapters = paragraphs.map((paragraph) => paragraph.number).filter((number) => !inChapters.has(number));

  const preamble = collapseLines(elements(content, 'sisuTekst').map(renderContent).join('\n'));

  return {
    metadata: readMetadata(root),
    preamble: preamble === '' ? null : preamble,
    chapters,
    paragraphs,
    outsideChapters,
    notes,
  };
}
