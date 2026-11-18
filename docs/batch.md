# Making a batch

A batch is the next 15 texts with audio (DESIGN.md 8). The author starts it with "next batch" and short feedback on the last batch: what was hard, which words were difficult.

1. Feedback. Move the number of new words within the curve's range (DESIGN.md 4.5) if the author found the last batch too hard or too easy. Put the author's difficult words into the `repeat` lists of the next slots. Done when every word the author named is in a `repeat` list.
2. Slots. `pnpm plan --next 15` prints the next 15 unwritten slots. Every slot needs `characters`, an `idea` that continues the arc in `content/plan.json`, and `newWords` filled up to `newWordCount` with general words the story needs (etLex A2 lemmas in texts 1-20, B1 lemmas later, from `content/vocab/base.json`). Write the missing parts into `content/plan.json`. Done when all 15 slots have all three.
3. Write. One subagent per text, in parallel. Each gets its slot, its text id and the instruction to follow docs/writing-texts.md. Done when all 15 files exist.
4. Check. `uv run scripts/lemmatize.py --texts <ids>`, then `pnpm check <ids>`. A failing text goes back to its writer with the check's output. Done when every text prints `ok`; after three failed rounds, tell the author which text is stuck and why.
5. Fact check. One fresh subagent per text gets only the text file and the § it cites, and lists every statement in the story, facts, questions and explanations that the § does not support. Fix each, then rerun step 4 for that text. Done when every fact check comes back empty.
6. Vocabulary. Add every new word's translation to `content/vocab/lexicon.json`; for exam words, set `translation` and `introducedIn` in `content/vocab/exam-vocab.json`.
7. Audio. `pnpm tts <ids>`, then set `audio` in each text. Done when every text has story.mp3, law.mp3 and timings.json.
8. Build. `pnpm build`, then open a few pages with `pnpm preview`. Done when the build passes and the pages show story, words, law block and questions.
9. Re-plan. Set `textId` on the written slots and run `pnpm plan`; read `pnpm check --report` and pass any shortfall to the next slots' `repeat` lists.
10. Report to the author, in Russian: the texts with titles, the minutes of audio, anything stuck. Commit and push only when the author asks.
