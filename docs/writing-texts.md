# Writing a text

You write one text from one slot of `content/plan.json`. The text teaches the slot's planned new words and the § of its law block through a story the reader can follow on first reading. Background: DESIGN.md sections 4 (texts) and 5 (vocabulary).

## Inputs

- The slot: stage, area, type, `law`, `returns`, `newWords`, `repeat`, `characters`, `idea`, `length`, `grammar`.
- The text id you were given (`0001` ...). The file is `content/texts/<id>.json`, shaped as `TextEntry` in `src/lib/types.ts`.
- `content/law/constitution.json` and `content/law/citizenship-act.json`: the § text. Read every § the slot cites before writing.
- `content/characters.json` and the cast table in DESIGN.md 4.2: who the recurring characters are and their legal status.
- Earlier texts in `content/texts/`: what the serial has told so far. Read the two or three texts before yours.

## The story

- Level. Known words are the etLex base list (`content/vocab/base.json`: A1 in texts 1-20, A1 and A2 from text 21), every word introduced in an earlier text, the slot's `repeat` words, and character names. New words are the slot's `newWords` and `phrases`. When `newWords` has fewer words than `newWordCount`, fill the free places with general words the story needs (etLex A2 in texts 1-20, B1 later) and gloss them. Any other word is an unplanned unknown word: gloss it too; the check allows at most 1% of the story's words in texts 1-20 and 2% after. Compounds of known words count as known. The check lists every unknown word, so run it early.
- Phrases. Every phrase in `phrases` appears in the story, in any word order and form, and gets a gloss line.
- Grammar and length: the slot's `grammar` and `length` (counted in words). Texts 1-20 use the present tense and short main clauses.
- New words. Each planned new word appears at least twice, the first time in a sentence whose situation shows its meaning.
- Words to repeat. Every lemma in `repeat` appears in the story, in any form.
- Associations. Tie each new word and each § to a concrete scene: a named character, a place in Tallinn or Estonia, a thing they see or do. The reader should remember the rule by the scene.
- Segments. One segment is one sentence of narration (speaker `narrator`) or one line of a character (speaker = the character id). In dialogue, the spoken line is its own segment and the attribution is a narrator segment: `„Tere!“` (olga) + `ütleb Olga.` (narrator). Use Estonian quotes „…“. `para` numbers paragraphs from 0; a new speaker usually starts a new paragraph.
- Voices. Recurring characters speak with their voices from `content/characters.json`. A side character goes in `cast` with a name and a voice that no other speaker of this story uses (DESIGN.md 4.3: men albert first, then indrek or kalev; women any of kylli, liivika, mari, vesta that is free).
- The serial. Keep every character's legal status and history as DESIGN.md 4.2 states them, and stay consistent with what earlier texts told. The story's present is November 2026 and later.

## The law block, facts and questions

- `law`: the slot's § ids, in order. The site shows their authentic text; never retype it.
- `facts`: 3-5 key facts of the kind the exam asks, in simple Estonian, each ending with its § in brackets: `(§ 60)` for the Constitution, `(KodS § 6)` for the Citizenship Act; `ref` is the law id. Every § in the slot's `returns` comes back in a fact or a question.
- `questions`: 1-2, in the exam's format, in Estonian:
  - `truefalse`: a statement; options exactly `["õige", "vale"]`;
  - `choice`: 3-4 options, one correct, the others plausible for someone who skimmed;
  - `where` ("Kus see on kirjas?"): options are § citations.
  The `explanation` says in simple Estonian why the answer is right and cites the §.
- `editions`: for every act the text cites, the `edition` of its file in `content/law/`.
- `tags`: `"932 SE"` when the text cites a Citizenship Act § that bill 932 SE changes (DESIGN.md 2.4).

## New words

`newWords` has one line per planned new word, plus one per unavoidable unknown word: `form` as it first appears in the story, `lemma` as in the plan, `translation` in Russian. The translations are ours, made for the meaning in this law. For a legal term use the standard Russian legal term. `private/dictionary-raw.json` may be consulted to match the term the exam dictionary uses; its wording is never copied.

## Accuracy

- Every legal statement in the story, the facts, the questions and the explanations is stated by the § it cites. When unsure, stay closer to the § text.
- Local elections: Estonian citizens and citizens of other EU states aged 16 or older who live in the municipality vote (Constitution § 156(2), Local Government Council Election Act § 5(1)). Stateless people and other foreigners have not voted there since 01.03.2026.
- Neutrality: offices are named (president, peaminister), real politicians and real parties are not. Changes in the law are told as facts, without opinions.

## Done

Run `uv run scripts/lemmatize.py --texts <id>`, then `pnpm check <id>`. The text is done when the check prints `<id> ok`.
