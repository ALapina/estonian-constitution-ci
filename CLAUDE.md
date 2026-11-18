# Põhiseadus lugudes

Graded Estonian stories with audio for the Estonian citizenship exam on the Constitution and the Citizenship Act. The author studies with them for the exam on 12.12.2026; the site is public. DESIGN.md records every decision and the reason for it; BACKLOG.md holds later work.

## Language

- Repository text is English: code, comments, docs, commit messages, issues and pull requests.
- Study content is the exception: stories, law blocks, facts and questions are Estonian; translations and interface strings are Russian.
- Talk to the author in Russian.

## Map

- `content/`: everything the site is built from: texts, law, vocabulary, plan, characters. The contracts are in `src/lib/types.ts`.
- `scripts/`: importers, scheduler, checks, lemmatiser, TTS. Commands are the `package.json` scripts; Python scripts run as `uv run scripts/<name>.py`.
- `private/` (gitignored): the dictionary PDF and its raw extract, which holds the dictionary's own Russian translations. That Russian text stays in `private/`; public files carry our translations.
- Node 24: run `nvm use` in the project folder first, because the machine's nvm default is Node 22.

## Tasks

- Writing or revising a text in `content/texts/`: read docs/writing-texts.md first.
- The author asks for the next batch: follow docs/batch.md.
- Changing the plan, the checks or the audio: read the matching DESIGN.md section first (4.5 curve, 5.4 checks, 6 audio, 8 batch).
- A decision changes: edit DESIGN.md and add a row to its decision log (section 14).

## Ground truth

- Law text lives only in `content/law/`, imported from Riigi Teataja by `pnpm import:law`. Refer to provisions by law id; the site renders the text.
- A legal fact in any text is stated by the § it cites. When the § does not state it, DESIGN.md names the source.

## Git

- Commit and push only when the author asks. GitHub Pages deploys `main` through `.github/workflows/deploy.yml`.
- `public/audio/` stays out of git until the author settles the voices and the bitrate; the small voice samples in `public/audio/voices/` are committed.
