# Making a batch

A batch is the next 15 texts with audio (DESIGN.md 8). The author starts it with "next batch" and short feedback on the last batch: what was hard, which words were difficult.

1. Feedback. Move the number of new words within the curve's range (DESIGN.md 4.5) if the author found the last batch too hard or too easy. Put the author's difficult words into the `repeat` lists of the next slots. Done when every word the author named is in a `repeat` list.
2. Slots. `pnpm plan --next 15` prints the next 15 unwritten slots. Every slot needs `characters`, an `idea` that continues the arc in `content/plan.json`, and `newWords` filled up to `newWordCount` with general words the story needs (etLex A2 lemmas in texts 1-20, B1 lemmas later, from `content/vocab/base.json`). Write the missing parts into `content/plan.json`. Done when all 15 slots have all three.
3. Write. Writer subagents in parallel, each with a run of consecutive texts (five per writer keeps the serial smooth). Each gets its slots, its text ids and the instruction to follow docs/writing-texts.md. Done when all 15 files exist.
4. Check. `uv run scripts/lemmatize.py --texts <ids>`, then `pnpm check <ids>`. A failing text goes back to its writer with the check's output. Done when every text prints `ok`; after three failed rounds, tell the author which text is stuck and why.
5. Review. A fresh subagent per writer's run, which did not write the texts, lists every statement in the story, facts, questions and explanations that the cited § does not support, plus Estonian language errors, wrong Russian translations and questions with more than one defensible answer. Then one reader takes all 15 texts as one serial and lists contradictions between them. Fix each finding, then rerun step 4 for that text. Done when the reviews come back empty or every finding is fixed or answered.
6. Audio. `pnpm tts <ids>` (about a minute per text; run it in the background). Done when every text has story.mp3, law.mp3 and timings.json in `public/audio/<id>/`.
7. Vocabulary and audio fields. `pnpm sync` adds the new words to `content/vocab/lexicon.json`, marks exam words as introduced in `content/vocab/exam-vocab.json`, and sets `audio` in each text.
8. Build. `pnpm build`, then open a few pages with `pnpm preview`. Done when the build passes and the pages show story, words, law block and questions.
9. Re-plan. `pnpm plan` marks the written slots with their text ids and re-plans the rest from what was written; read `pnpm check --report` and pass any shortfall to the next slots' `repeat` lists.
10. Report to the author, in Russian: the texts with titles, the minutes of audio, anything stuck. Commit and push only when the author asks.
