// Data contracts shared by the site (src/) and the scripts (scripts/).
// DESIGN.md sections 4, 5 and 9 explain the fields.

/** Act ids: the Constitution (põhiseadus) and the Citizenship Act (kodakondsuse seadus). */
export type ActId = 'ps' | 'kods';

/**
 * Law ids. An id is the act, then the §, then `-lg` and the part, then `-p` and the point;
 * a superscript follows `_`. Examples: `ps-65`, `ps-8-lg2` (§ 8(2)), `kods-2_1` (§ 2¹),
 * `kods-13-lg4_3` (§ 13(4³)), `kods-21-lg1-p6` (§ 21(1) p 6).
 */
export type LawId = string;

export interface LawPoint {
  id: LawId;
  /** "6", "2_1" for 2¹ */
  number: string;
  text: string;
  repealed: boolean;
}

export interface LawPart {
  id: LawId;
  /** Ordinal used in ids and citations: "1", "4_3" for 4³. The Constitution numbers parts by order. */
  number: string;
  /** What the official text shows before the part: "(1)" in the Citizenship Act, null in the Constitution. */
  label: string | null;
  /** The part's own text; when the part has points, the text before them. */
  text: string;
  points: LawPoint[];
  repealed: boolean;
}

export interface LawParagraph {
  id: LawId;
  /** "8", "2_1" for § 2¹ */
  number: string;
  /** Citizenship Act § have titles; Constitution § do not. */
  title: string | null;
  /** Chapter id, e.g. "ps-ch2". */
  chapter: string;
  parts: LawPart[];
  repealed: boolean;
}

export interface LawChapter {
  /** "ps-ch1" ... "ps-ch15", "kods-ch1" ... */
  id: string;
  /** As printed: "I" or "1" */
  number: string;
  /** Estonian title, e.g. "ÜLDSÄTTED" or "Üldsätted" */
  title: string;
  /** § ids in order */
  paragraphs: LawId[];
}

export interface LawAct {
  act: ActId;
  /** "Eesti Vabariigi põhiseadus", "Kodakondsuse seadus" */
  title: string;
  /** Riigi Teataja id of the consolidated edition, e.g. "111042025003". */
  edition: string;
  /** "RT I, 11.04.2025, 3" */
  reference: string;
  /** ISO date the edition took effect. */
  inForceFrom: string;
  /** https://www.riigiteataja.ee/akt/<edition> */
  url: string;
  /** ISO date of the import. */
  importedAt: string;
  /** The Constitution's preamble; null for acts without one. */
  preamble: string | null;
  chapters: LawChapter[];
  /** Keyed by § id, in order of the act. */
  paragraphs: Record<LawId, LawParagraph>;
}

/** A speaker id is a key of content/characters.json or of a text's `cast`. */
export type SpeakerId = string;

export interface Character {
  /** Display name in Estonian; null until the master plan names the character. */
  name: string | null;
  /** TartuNLP voice, e.g. "peeter". */
  voice: string;
  /** One line about the character, in English. */
  note?: string;
}

/** One token of annotated text: form, lemma, lexicon id. Punctuation has lemma null. */
export interface Token {
  f: string;
  l: string | null;
  /** Vabamorf part of speech: S noun, V verb, H proper name, N numeral, Z punctuation, ... */
  p?: string;
  /** Other lemmas Vabamorf kept for an ambiguous token. */
  alt?: string[];
  /** Lemmas of the parts of a compound: "koolikott" -> ["kool", "kott"]. */
  parts?: string[];
  id?: string | null;
}

/** One sentence, or one line of a character. Audio is synthesised per segment. */
export interface Segment {
  speaker: SpeakerId;
  text: string;
  /** Paragraph index; consecutive segments with the same index form one paragraph. */
  para: number;
  tokens?: Token[];
}

/** A glossary line: `valitakse ← valima — выбирать`. */
export interface NewWord {
  form: string;
  lemma: string;
  translation: string;
}

export interface Fact {
  /** Simple Estonian, ending with the § in brackets, e.g. "Riigikogus on 101 liiget. (§ 60)" */
  text: string;
  ref: LawId;
}

/**
 * truefalse: "Kas lause on õige või vale?" with options ["õige", "vale"];
 * choice: three or four options; where: "Kus see on kirjas?" with § options.
 */
export type QuestionType = 'truefalse' | 'choice' | 'where';

export interface Question {
  type: QuestionType;
  text: string;
  options: string[];
  /** Index of the one correct option. */
  answer: number;
  /** Simple Estonian, cites the §. */
  explanation: string;
  ref: LawId;
}

export type Stage = 0 | 1 | 2 | 3 | 4;
export type Area = 1 | 2 | 3 | 4;
export type TextType = 'serial' | 'side' | 'summary' | 'review';

export interface TextEntry {
  /** Permanent id in reading order: "0001". Never changes once written. */
  id: string;
  /** The plan slot the text was written from. */
  slot: string;
  stage: Stage;
  area: Area;
  type: TextType;
  title: string;
  /** § ids shown in the law block, in order. */
  law: LawId[];
  /** Edition id of every act the text cites. */
  editions: Partial<Record<ActId, string>>;
  /** For example ["932 SE"]. */
  tags: string[];
  /** Side characters of this text only: speaker id → character. */
  cast?: Record<SpeakerId, Character>;
  segments: Segment[];
  newWords: NewWord[];
  facts: Fact[];
  questions: Question[];
  audio?: {
    story: string;
    law: string;
    timings: string;
  };
}

/** One slot of the master plan (content/plan.json), DESIGN.md 8. */
export interface PlanSlot {
  /** Stable slot id, "s001". */
  id: string;
  /** Reading position. Unwritten slots may be renumbered; written ones keep their text id. */
  order: number;
  stage: Stage;
  area: Area;
  type: TextType;
  /** One of the ~20 reserve slots at the end. */
  spare: boolean;
  /** § ids for the law block. */
  law: LawId[];
  /** § ids that come back in this text's facts or questions. */
  returns: LawId[];
  /** How many new words the curve gives this slot (DESIGN.md 4.5). */
  newWordCount: number;
  /** Planned new words, as single lemmas: lemmas of exam entries, then general lemmas the agent adds with the idea. */
  newWords: string[];
  /** Multiword exam entries for this text; their words are known or new here. Glossed, not counted as new words. */
  phrases: string[];
  /** Lemmas that must appear in the story. */
  repeat: string[];
  characters: SpeakerId[];
  /** Story idea in English: who, where, what happens, which scene carries the §. */
  idea: string;
  /** Story length in words, [min, max]. */
  length: [number, number];
  /** Grammar the story may use. */
  grammar: string;
  /** Set when the text is written. */
  textId: string | null;
}

export interface Plan {
  generatedAt: string;
  /** The main serial by stage, in English. */
  arc: string[];
  slots: PlanSlot[];
}

/** content/vocab/lexicon.json maps a lemma (lower case, as Vabamorf gives it) to our translation. */
export interface LexiconEntry {
  /** Russian translation for the meaning used in the texts. */
  translation: string;
  /** Text that introduced the word; null for words from the law texts only. */
  introducedIn: string | null;
  /** Exam-vocab id when the word is on the exam list. */
  exam?: string;
}

/** One entry of the exam word list (content/vocab/exam-vocab.json). */
export interface ExamWord {
  /** Stable id, e.g. "ev-0001". */
  id: string;
  /** Headword as in the dictionary; a phrase for multiword entries. */
  lemma: string;
  multiword: boolean;
  /** For a phrase listed inside another entry: the id of that entry. */
  parent: string | null;
  /** Vabamorf lemmas used to find the entry in texts (scripts/lemmatize.py --vocab). */
  lemmas?: string[];
  /** Our Russian translation; empty until a text introduces the word. */
  translation: string;
  /** etLex level when the lemma is in the base list, else null. */
  level: 'A1' | 'A2' | 'B1' | null;
  /** Exam areas where the word occurs in the law texts. */
  areas: Area[];
  /** § ids where the word occurs. */
  refs: LawId[];
  /** general word or legal term */
  kind: 'general' | 'legal' | null;
  /** Text id that introduces the word, once written. */
  introducedIn: string | null;
  /** Target number of encounters in the course. */
  target: number;
  /** Printed page number of the dictionary (the PDF page index is page + 2). */
  page: number;
  /**
   * "extra": not in the 2009 dictionary, frequent in the current law text.
   * "xref": a "vt" cross-reference that repeats another entry; "duplicate": the same lemma under a second headword.
   * "alternatives": two words in one entry ("käsitama, käsitlema"); "prefix": a combining form ("kohtu-").
   * The scheduler does not plan xref, duplicate and prefix entries as new words.
   */
  tags: string[];
}
