# Põhiseadus lugudes

Working title. Graded Estonian reading texts with audio for the Estonian citizenship exam on the Constitution and the Citizenship Act ("Eesti Vabariigi põhiseaduse ja kodakondsuse seaduse tundmise eksam").

Status: design done, first texts in progress. The site will be at https://alapina.github.io/estonian-constitution-ci/ once the first batch is published.

This is a free study project, not an official resource. The official texts of the laws are published in [Riigi Teataja](https://www.riigiteataja.ee/).

## How it works

- Short stories in Estonian, from below A2 up to B1, follow a family on its way to Estonian citizenship. Side stories come at the same rules from other angles.
- Every text covers one or more paragraphs of the Constitution or the Citizenship Act and introduces a few new words from the official exam vocabulary. Earlier words come back on a schedule.
- Under each story: the new words with Russian translations, the authentic text of the paragraph with key facts, and one or two questions in the exam format.
- Every story and law block has audio from [Neurokõne](https://neurokone.ee/) by TartuNLP. The audio is generated in advance and served as static files.
- The interface is in Russian. Progress is stored in the browser; there are no accounts.

## Documents

- [DESIGN.md](DESIGN.md): goals, exam facts, text rules, characters, audio, platform, pipeline, decision log.
- [BACKLOG.md](BACKLOG.md): tasks outside the main plan, two of them dated before the exam, and ideas for later.
- [CLAUDE.md](CLAUDE.md): working instructions for the AI agents that write the texts and the code.

## Development

The whole project is built by AI agents. Prerequisites:
- Node 24 LTS (`nvm install 24`; Astro 7.4 requires Node 22.23.4 or newer) and pnpm;
- Python 3.12 through [uv](https://docs.astral.sh/uv/), for lemmatisation with EstNLTK;
- ffmpeg (`brew install ffmpeg`), for MP3 encoding.

Run `nvm use` and `pnpm install` in the project folder, then:

| Command | What it does |
|---|---|
| `pnpm dev` | local site at http://localhost:4321/estonian-constitution-ci/ |
| `pnpm build` | static site in `dist/` |
| `pnpm import:law` | imports the Constitution and the Citizenship Act from Riigi Teataja into `content/law/` |
| `pnpm import:base` | imports the etLex A1-B1 lists into `content/vocab/base.json` |
| `uv run scripts/parse_dictionary.py` | parses the exam dictionary PDF in `private/` into `content/vocab/exam-vocab.json` |
| `uv run scripts/lemmatize.py --law`, `--vocab`, `--texts <id...>` | lemmatises law texts, the word list or texts with EstNLTK |
| `pnpm plan` | rebuilds the master plan `content/plan.json`; `--next 15` prints the next slots |
| `pnpm check <id...>` | checks texts; `--report` prints the course report |
| `pnpm tts <id...>` | makes the audio of texts; `--voices` makes the voice samples |

How agents write texts: [CLAUDE.md](CLAUDE.md), [docs/writing-texts.md](docs/writing-texts.md), [docs/batch.md](docs/batch.md).

## Sources and credits

- Law texts: [Riigi Teataja](https://www.riigiteataja.ee/), the current consolidated editions. The official text is the one published in Riigi Teataja.
- Audio: Neurokõne, TartuNLP, University of Tartu. Rätsep, Lellep & Fishel (2022), "Estonian Text-to-Speech Synthesis with Non-autoregressive Transformers", Baltic Journal of Modern Computing 10(3).
- Base vocabulary: the etLex A1-A2 lists of the Eesti Keele Instituut (Sõnaveeb teacher tools), CC BY 4.0.
- The exam word list (`content/vocab/exam-vocab.json`) holds the headwords of "Eesti-vene sõnaraamat Eesti kodakondsuse taotlejale" (Integratsiooni Sihtasutus, 2009). The translations in this project are our own; no dictionary entries are copied.

## Licence

- Code (`src/`, `scripts/`, configuration): MIT, see [LICENSE](LICENSE).
- Texts, translations, the master plan and audio: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/), see [LICENSE-CONTENT](LICENSE-CONTENT).

Not covered by these licences:
- the law texts in `content/law/`: legislation is not covered by copyright (Copyright Act § 5 p 3), and the official text is published in Riigi Teataja;
- the etLex base list in `content/vocab/base.json`: CC BY 4.0, Eesti Keele Instituut;
- the headwords in `content/vocab/exam-vocab.json`, which come from the 2009 dictionary above. Our translations and data in that file are CC BY-NC-SA 4.0.

The audio is synthesised with Neurokõne (TartuNLP) under the API's terms of use; its voice model is licensed CC BY-NC-SA 4.0.
