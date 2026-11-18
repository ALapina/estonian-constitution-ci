# Backlog

Tasks outside the plan up to the exam on 12.12.2026. Decisions and the current plan are in [DESIGN.md](DESIGN.md).

Each task has two labels:
- origin: "author" means the author asked for it or approved it; "agent idea" means an agent proposed it and the author has not approved it yet;
- priority: "required" means the site will become wrong or break without it; "optional" means it makes the project better.

Two tasks have dates before the exam, so they come first: an optional letter and a required check.

## Before the exam

### Letter to TartuNLP (author; optional; agent advice: send before about 25.11.2026)
The Neurokõne API page asks integrators to tell TartuNLP at ping@tartunlp.ai. The letter says what the project is, that it is free and non-commercial, and roughly how many requests a day it makes. It asks whether we may publish the generated audio, whether the CC BY-NC-SA 4.0 licence of the voice model covers that audio, and what credit they want. The agent drafts it; the author sends it.

### Check bill 932 SE after 25.11.2026 (agent idea; required)
The Riigikogu adopted 932 SE on 11.11.2026. Check whether the President promulgated it and under which Riigi Teataja reference it was published. Compare its final text with the list of changed § in DESIGN 2.4.

## Texts

### Update texts tagged 932 SE (author; required)
If 932 SE takes effect on 01.01.2027: re-import the Citizenship Act, find every text tagged `932 SE`, and rewrite it for the new edition. The author's exam on 12.12.2026 uses the old edition. Readers who sit the exam after 01.01.2027 learn the new one. An application for citizenship is decided under the law in force on the day it is filed (new § 20(4)).

### Watch bill 1059 SE (agent idea; required)
In proceedings since 15.10.2026, no reading yet, proposed entry into force 02.01.2027. It lets citizens by birth keep a second citizenship of an EU or EEA state, the United States, Australia, Canada, Switzerland, New Zealand or a treaty state, and lets citizens by birth who lost Estonian citizenship by accepting another one restore it. If it passes, update the texts about § 3, § 29 and restoration (§ 16-17). The young couple's husband is an Estonian citizen by birth who also holds Russian citizenship from birth. His texts say nothing about the second citizenship until this bill and 932 SE (new § 29(3)) are settled. Russia is not among the listed states.

## Infrastructure

### Move to a home server (author; optional)
Now the site runs on GitHub Pages. Later it moves to a home server. How (agent idea):
- pick the hardware (Raspberry Pi, an old laptop, a NAS) and the OS;
- expose the site without port forwarding, for example through Cloudflare Tunnel, with Caddy serving HTTPS;
- deploy by building in GitHub Actions and copying `dist/` to the server, or by building on the server;
- back up content and audio;
- change `site` and `base` in `astro.config.mjs` and rebuild. The code stays the same. A backend appears together with accounts;
- the new address is a new origin with empty browser storage, so readers keep their progress only by exporting it on the old site and importing it on the new one.

### Audio outside the repository (agent idea; optional)
Two separate limits apply:
- the repository: GitHub recommends keeping a Pages source repository under 1 GB, counting the whole git history. Keeping MP3 files outside git (for example in GitHub Releases, which has no total size limit) and pulling them in at build time solves this. The published site does not get smaller;
- the published site: at most 1 GB. To stay under it, the pages must load audio from another host, such as Cloudflare R2 or GitHub Releases, by direct links. Before moving, check that the host serves byte-range requests (Safari on iOS needs them), the right MIME type and CORS headers.

### Own speech synthesis server (agent idea; optional)
If the TartuNLP API starts to limit us or changes its terms, run synthesis locally: the text-to-speech-worker code is on GitHub under MIT, and the fastpitch-est model is on Hugging Face under CC BY-NC-SA 4.0, available after accepting its conditions.

## Rights

### Letter to Integratsiooni Sihtasutus (author; optional)
Write to info@integratsioon.ee: the project is free; the translations are ours; the public repository holds the headwords of the 2009 dictionary with our own translations; the site links to the foundation's PDF. Ask whether this is fine and how to credit the source. If they object, the list and the plan go back to `private/` (DESIGN 5.1). The agent drafts it; the author sends it.

## Users

### Simple authentication if the project grows (author; optional)
How (agent idea): sign-in by an email link or through GitHub or Google; progress and difficult words sync between devices; a backend on Node (Hono) with SQLite; possibly together with the move to the home server.

### Mobile layout (author; optional)
The site is desktop-first. Add a layout for phones: reading, the player and the word popup on a small screen.

## Language

### English (author; optional)
Interface and word translations in English. The lexicon gets a second translation language, and the interface gets a language switch. The foundation also published an Estonian-English dictionary in 2009; check the English translations against it.

## Learning

### Mock exam (agent idea; optional)
A test in the Harno format built from the questions of all texts: 24 questions, 45 minutes, pass mark 18, results by area, the law texts and the dictionary at hand as in the real exam.

### Spaced repetition of difficult words (agent idea; optional)
Short cards for the marked words with spaced repetition. Each card shows a sentence from a text the reader has read.

### Word-level highlight (agent idea; optional)
From phase 2 the site highlights the current sentence. `POST /text-to-speech/v2/verbose` returns the duration of every character, which gives the time of every word. The synthesiser expands numbers and abbreviations ("§ 8" becomes "paragrahv kaheksa"), so the expanded text has to be mapped back to the displayed words.

### Offline reading (agent idea; optional)
A PWA that keeps read and upcoming texts with their audio on the device, for reading without a network.

### Feedback on a text (agent idea; optional)
Now the author sends batch feedback in the chat. Other readers need "hard" and "error in the text" buttons. In a public GitHub repository, a link that opens a prefilled new issue needs no backend, but the reader needs a GitHub account. Otherwise use a form or a backend.
