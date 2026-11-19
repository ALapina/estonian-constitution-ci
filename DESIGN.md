# Põhiseadus lugudes: design

Working title. This document records the decisions made on 16-18.11.2026. Two kinds of readers use it: the project author and the AI agents that write the texts and the code. When a decision changes, edit this file and add a row to the decision log in section 14.

Facts about the exam, the laws, hosting and the text-to-speech API were checked against primary sources on 17-18.11.2026. Inferences and unverified points are marked "(inference)" or "(not verified)" and are listed in section 12.

Status markers. Section 14 says who made each decision: the author, or the agent for engineering choices that need no confirmation. A proposal the author has not confirmed yet carries the marker **(pending Pn)** where it appears and is listed in section 13 with an interim rule. Agents follow the interim rule until the author answers.

## 1. Goal

Prepare the author for the Estonian citizenship exam on the Constitution and the Citizenship Act on 12.12.2026 with comprehensible input: short graded stories in Estonian with audio. Together the stories cover all four exam areas and the official exam vocabulary.

- The author's Estonian is between A2 and B1. The first texts are easier than A2.
- The author reads 1-2 hours a day.
- The stories build associations. Every new word and every legal rule is tied to a character, a place and an event in the plot, so it is easier to remember.

Audience: the author first, then friends and other Russian-speaking candidates. The site is public, free and non-commercial. Nobody will promote it.

Languages:
- stories, law blocks, key facts and questions are in Estonian;
- word translations and the site interface are in Russian;
- everything written for GitHub is in English: README, DESIGN, BACKLOG, CLAUDE.md, identifiers, comments, commit messages, issue and pull request text, and the repository description. The study content is the exception: Estonian texts, Russian translations and Russian interface strings.

Not now: accounts, sync between devices, a mobile layout, interface or translations in languages other than Russian, the home server. These are in [BACKLOG.md](BACKLOG.md).

## 2. The exam

### 2.1 Format

Government regulation no. 143 of 25.09.2008 (consolidated text RT I, 28.07.2020, 11) and § 9 of the Citizenship Act (Kodakondsuse seadus, KodS) set the procedure. Harno runs the exam.

- 24 questions in Estonian. Every question has exactly one correct answer. There are no open questions.
- 45 minutes, on a computer at an exam centre.
- The pass mark is 18 correct answers out of 24 (75%). The result is shown right after the exam.
- Allowed aids: the Estonian texts of the Constitution and the Citizenship Act and a dictionary, provided in the exam room (regulation, Harno). The public sample items in EIS have these aids built into the interface: both law texts and the 2009 Estonian-Russian and Estonian-English dictionaries. Our word list comes from that Estonian-Russian dictionary. The live exam probably shows the same aids (inference).
- The public samples have two task types: "Kas lause on õige või vale?" with two options, and questions with three or four options.
- Harno does not publish how the 24 questions split across the four areas. We know only that every exam covers all four. The 17 public samples (10 on institutions, 3 on rights, 2 on general provisions, 2 on citizenship) are not a guide to the split.
- The exam is free. It runs every month except July in Tallinn, Tartu and Narva. All 16 published dates, 21.11.2026 to 18.12.2027, are Saturdays.
- Registration in EIS ends 15 days before the exam (Harno: "lõpeb 15 päeva enne"). For 12.12.2026 that is around 27.11.2026, so register earlier to be safe.
- In 2025, 989 of 1203 participants passed (82%).

### 2.2 What this means for the texts

The author confirmed the three additions for the third skill on 18.11.

The exam is open-book: the law texts and a dictionary are provided, probably on screen as in the EIS samples (inference). But there are less than two minutes per question, so there is no time to look up every answer. The candidate needs three skills:
1. understand the question in Estonian on first reading, without the dictionary;
2. know the main facts by heart;
3. know in which chapter and § to look for the rest.

The texts train the first two skills. For the third:
- every law block shows the chapter number with its Estonian title and the § number;
- the review stage has "Kus see on kirjas?" tasks: find the § that states a fact;
- the site has a "Law" page with the current texts of the exam chapters and the Citizenship Act, tap-to-translate, and links from each § to the texts that explain it (phase 2). This is the current edition. Which edition the exam shows is unknown (sections 2.4 and 12).

Questions after the texts follow the exam format: both task types, question and options in Estonian.

### 2.3 Exam areas

| # | Area | Source | Size |
|---|---|---|---|
| 1 | Basic principles of the state order | Constitution, ch. I and III: § 1-7, § 56-58 | 10 § |
| 2 | Fundamental rights, freedoms and duties | Constitution, ch. II: § 8-55 | 48 § |
| 3 | Competence of the Riigikogu, the President, the Government and the courts | Constitution, ch. IV (§ 59-76), V (§ 77-85), VI (§ 86-101), XIII (§ 146-153); related § from chapters VII-X | 51 § and about 15 related |
| 4 | Acquisition, receiving, restoration and loss of citizenship | Citizenship Act, ch. 1-6 (§ 1-30 with § 2¹-2⁴, 8¹-8³, 14¹) and § 31-35 | 42 § in force (§ 11 is repealed) |

The regulation words area 3 as competence "according to the Constitution", with no chapter numbers. We picked chapters IV, V, VI and XIII by their titles. Some of these powers sit in other chapters: laws (ch. VII), the budget (ch. VIII), treaties (ch. IX), defence (ch. X). For example, § 65 refers to § 121, and § 78 refers to § 105, 107, 109, 110 and 128. The master plan adds such § to stage 3 (author, 18.11).

The four terms of area 4, from § 2 of the Citizenship Act:

| Estonian | Russian | Meaning | § |
|---|---|---|---|
| omandamine | приобретение | by birth | 5 |
| saamine | получение | naturalisation, including children | 6-15 |
| taastamine | восстановление | for people who lost citizenship as minors | 16-17 |
| kaotamine | утрата | release (vabastamine), deprivation (äravõtmine), accepting another citizenship | 22-30 |

### 2.4 Law editions

- Constitution: edition RT I, 11.04.2025, 3, in force since 01.03.2026 (id 111042025003). The link the author started from (115052015002) is the 2015 edition. The exam chapters read the same in both: since 2011 only § 156 in chapter XIV has changed.
- Citizenship Act: edition RT I, 26.06.2025, 8, in force since 06.07.2025 (id 126062025008).
- Bill 932 SE. The Riigikogu adopted it on 11.11.2026. If the President promulgates it (decision expected around 25.11.2026), it takes effect on 01.01.2027. Per the adopted text it changes these provisions of the Citizenship Act (check against the promulgated text):
  - § 6: residence wording becomes "the last five years permanently"; new § 6(2) defines living permanently in Estonia;
  - § 13: children of stateless parents (§ 13(4) rewritten, new § 13(4³), § 13(5) changed, § 13(5¹) repealed); new transitional § 36⁶;
  - § 28(1) p 5 and § 28(4) repealed; § 29 rewritten ("deemed lost", new § 29(3));
  - § 20(3) repealed; new § 20(4): an application is decided under the law in force on the day it was filed;
  - § 24(1): foreign missions no longer accept release applications;
  - § 4, § 8(4) and § 9(3) repealed; § 35: Harno, not the expert committee, decides health-based exemptions.
  The bill does not change the four exam areas or the rule that the exam is in Estonian. The draft implementing acts keep 24 questions, 45 minutes and the pass mark of 18.
- Texts follow the edition in force on 12.12.2026, the author's exam date. Each text records the edition of every act it cites. Texts about § that 932 SE changes carry the tag `932 SE`. In January 2027 the agent updates the tagged texts (author, 18.11).
- Bill 1059 SE has been in proceedings since 15.10.2026. Under it, citizens by birth could keep a second citizenship of an EU or EEA state, the United States, Australia, Canada, Switzerland, New Zealand or a treaty state, and citizens by birth who lost Estonian citizenship by accepting another one could restore it. No reading yet; proposed entry into force 02.01.2027. We watch it.
- Outdated sources. The handbook "Abiks Eesti kodakondsuse taotlejale" (2nd edition, 2010, by Integratsiooni ja Migratsiooni Sihtasutus Meie Inimesed; Harno publishes it) is wrong in places. For example, it says stateless persons vote in local elections, which stopped on 01.03.2026. The law texts built into the EIS samples are outdated too: the Citizenship Act tool links to edition 130012025004 and the Constitution tool shows the old § 156. Facts come only from Riigi Teataja.

### 2.5 Useful materials

- Harno: the handbook in Estonian, Russian and English (24 sample questions, checked in the Estonian edition only; see 2.4 for outdated parts), 17 public samples in EIS, a free consultation before the exam (up to 1.5 hours, with a sample test).
- Integratsiooni Sihtasutus: a free 18-academic-hour preparation course for this exam, taught in Estonian, A2 required.
- Russian translations on juristaitab.ee: the Constitution (2015 edition; the Estonian text of the exam chapters has not changed since, but we did not open the Russian PDF) and the Citizenship Act (edition of 01.01.2024). They are informative only and have no legal force. We link to them and never copy them.
- Commentary on the Constitution: pohiseadus.riigioigus.ee. Agents use it to get interpretations right in the plot.

## 3. Scope and schedule

What has to be learned:
- the exam dictionary (Integratsiooni Sihtasutus, 2009): 847 entries, 617 headwords (164 of them multiword) and 230 phrases (parsed 18.11). Words that are already A1-A2 in the base list (section 5.2) count as known. The rest come down to 531 single words to teach, plus 15 A2 words that stage 0 needs, and 342 phrases built from them (section 4.5);
- about 165 legal units: 109 § of the exam chapters, about 15 related § from chapters VII-X and 42 § of the Citizenship Act.

How much reading:

| Scenario | Encounters per word | Returns to each § | Story words | Study hours | Texts |
|---|---|---|---|---|---|
| Minimum | about 8 | 1-2 | about 55 000 | 12-15 | about 170 |
| Optimum, our plan | about 12 | 3 | about 80 000 | 20-22 | about 230 |
| Safe margin | 15-20 | 4 or more | about 120 000 | 25-30 | about 330 |

Study hours are more than the story audio. Neurokõne reads about 100-110 words a minute (measured 17.11: 1547 characters gave 118 seconds of audio). In the optimum, 80 000 story words give 13-14 hours of story audio. Law blocks add about 4 hours of audio. Questions and rereading add the rest.

Plan: the optimum, about 230 texts. The master plan has about 250 slots: 230 planned texts and about 20 spare slots.

| Dates | What happens |
|---|---|
| 17.11 | design |
| 18.11 | phase 0, master plan, texts 1-15 |
| 19.11-01.12 | texts 16-200 (stages 0-3), 15 a day |
| by 27.11 | the author registers for the 12.12.2026 exam, if not registered yet |
| 02.12-03.12 | buffer for delays; writing the stage 4 texts |
| 04.12-10.12 | stage 4: about 30 review texts, 4-5 a day, plus rereading earlier texts of the same area with audio |
| 11.12 | light review |
| 12.12 | exam |

## 4. Texts

### 4.1 Parts of a text

1. Title and audio player.
2. The story. Length follows section 4.5.
3. New words, one line per planned new word, in the format `valitakse ← valima — выбирать`: the form in the text, the lemma, the Russian translation. The author first asked for 8-10 words per text; the curve in 4.5 refined the number.
4. The law block, "Põhiseadus ütleb" or "Kodakondsuse seadus ütleb":
   - the authentic text of 1-3 § or parts of a §;
   - the chapter number with its Estonian title, and the § numbers;
   - a link to Riigi Teataja and the note that the official text is published there;
   - 3-5 key facts of the kind the exam asks, in simple Estonian with the § number, for example "Riigikogus on 101 liiget. (§ 60)". The facts are in Estonian because the exam is in Estonian.
   The whole block, facts included, has its own audio file.
5. One or two questions in the exam format (section 2.2). After the reader answers, an explanation in simple Estonian with the § number appears.
6. A "read" mark and a difficulty rating: easy, fine, hard.
7. Footer: disclaimer and audio credit.

### 4.2 Serial and characters

About 70% of the texts in stages 0-3 (summary texts excluded) belong to the main serial. The rest are side stories with other characters, which come at the same § from another angle. The 70/30 split is an agent detail; the author may change it.

The main arc follows Olga to citizenship. The steps match the law: decision; the exams; the application to the Police and Border Guard Board (PPA) with a state fee of 150 €; the oath of loyalty, "Taotledes Eesti kodakondsust, tõotan olla ustav Eesti põhiseaduslikule korrale." (KodS § 6 p 7); waiting, since PPA has six months to pass the file to the Government (§ 19(3)); the Government's order (§ 20); the citizenship certificate and the passport. How and when the oath is given is set by the minister's regulation on applications (§ 19(4)). The master plan checks that regulation before the story reaches this step (not verified).

The Ivanov family lives in Tallinn, in Lasnamäe. The neighbours Mari and Jaan are Estonians.

The author approved the characters' names, family roles and jobs, Sergei's grey passport, Lisa's age, Olga preparing for the exam (17.11), the young couple, their names Maksim and Katja Saar, Nikolai's naturalisation and Maksim's grandfather (18.11). Every other detail in the table is the agent's.

| Character | Who | Topics |
|---|---|---|
| Olga Ivanova | nurse, born in Estonia, stateless. Her job requires B2 Estonian, which already meets the B1 language requirement, so she needs only the Constitution exam, like the author | naturalisation (§ 6); § 33 for people born in Estonia; health care; work |
| Sergei Ivanov | Olga's husband, driver, stateless (grey passport) | rights of everyone and rights of citizens only (for example § 48: only citizens join parties; § 57: only citizens vote in Riigikogu elections). He voted in the local elections of 19.10.2025 under the interim rule and has had no local vote since 01.03.2026 |
| Lisa Ivanova | daughter, 16, gymnasium. A citizen since 01.01.2016 under KodS § 36³: born in Estonia to stateless parents with at least five years of legal residence. This is naturalisation, not citizenship by birth | education (§ 37), freedom of expression (§ 45), voting ages (§ 57: 18 for the Riigikogu; she was 15 at the 2025 local elections) |
| Nikolai | Olga's father, 68. Came to Estonia in the 1970s as a worker, not as a soldier (§ 21(1) p 6 refuses people who served as career members of a foreign army, including reserve and retired, and spouses or registered partners who came with them). Stateless. He naturalises (author, 18.11); restoration (§ 16) is closed to him, because it covers only people who lost citizenship as minors. He settled in Estonia before 01.07.1990, so § 33 waives the long-term residence permit requirement of § 6 p 2. At 65 or older he is exempt from the writing part of the language exam (§ 34(1)). No age exempts anyone from the Constitution exam | the history of the state and the Constitution; naturalisation late in life (§ 33, § 34(1)) |
| Mari | neighbour, lawyer at the Chancellor of Justice's office (Õiguskantsleri Kantselei) | the Chancellor of Justice is chapter XII, outside the exam chapters, so her stories anchor to exam-scope §: protection of rights (§ 14, § 15), courts (ch. XIII), appointment of the Chancellor (§ 65, § 78), immunity of high officials (§ 76, § 85, § 101, § 153) |
| Jaan | Mari's husband (agent detail), member of the Riigikogu | laws, the Riigikogu, the Government, the President |
| Maksim Saar | the husband of the young couple, about 29, a software developer; author's idea, family history and name, 18.11; from Ukraine (author, 18.11). Born and raised in Kharkiv. His grandfather Johannes Saar lived in Tartu and was a citizen of the Republic of Estonia on 16.06.1940; after the war his work took him to Kharkiv, where he married and stayed (agent detail). Citizenship by birth passes from parent to child, so Maksim's father, born in Kharkiv, is an Estonian citizen by birth, and so is Maksim (KodS § 1(1), § 5(1) p 1; Constitution § 8(1)). Maksim and Katja moved to Tallinn in 2019, before the war, on residence permits (Maksim's for work). In stage 1 Maksim finds his grandfather's Estonian passport in a box of family papers and learns he has been a citizen all along. People call this repatriation; in law it is acquisition by birth, so he takes no exams. He proves his citizenship when he applies for his first Estonian passport: PPA checks it from a National Archives (Rahvusarhiiv) certificate about the grandfather and the birth certificates that link the generations. The plan keeps to the clear case. The grandfather lived in Estonia: courts disagree about descendants of optants who never moved to Estonia (Chancellor of Justice, 2024), so no story uses that case. Both links run through the father; before a story uses a chain through a mother, the agent checks the 1938 Citizenship Act (not verified) | acquisition by birth (KodS § 2(1) p 1, § 5; Constitution § 8(1)); citizenship by birth cannot be taken away (Constitution § 8(3), KodS § 28(3)); no citizen may be expelled or kept from settling in Estonia (§ 36); rights of citizens only once he is recognised: parties (§ 48), posts in state agencies (§ 30), Riigikogu elections (§ 57); § 32 for people PPA wrongly treated as citizens. Until 932 SE and 1059 SE are settled, texts do not say whether he keeps his Ukrainian citizenship: 932 SE adds § 29(3) on a citizenship by birth formalised late, and 1059 SE covers only the listed states, and Ukraine is not one of them. Texts about his passport carry the tag `932 SE` |
| Katja Saar | Maksim's wife, about 27, a Ukrainian citizen; author's idea and name, 18.11; from Ukraine (author, 18.11). The author left her status to the topics that need coverage, so the agent chose it. In Estonia since 2019 on a residence permit, first as the spouse of a foreign worker, later as the spouse of an Estonian citizen (Aliens Act, outside the exam, background only). She is in the middle of the naturalisation road while Olga is at its end: she reaches 8 years of residence in 2019 + 8 = 2027, so her application falls under the law changed by 932 SE and carries the tag | conditions of naturalisation (KodS § 6: a long-term resident's permit, 8 years of residence of which 5 permanently, B1 Estonian under § 8, the exam under § 9, income, loyalty, the oath); release from her Ukrainian citizenship (§ 12(2)); one citizenship for Estonian citizens (§ 1(2)); rights of everyone (Constitution § 9, § 12, § 29, § 34) next to rights of citizens only: no party (§ 48), no vote in Riigikogu elections (§ 57), and no vote in local elections either, because she is not an EU citizen (the local elections rule above); the duty to observe the constitutional order (§ 55). In stage 4 the family quizzes her for her future exam |

Restoration (§ 16-17) goes to a side-story character who lost Estonian citizenship as a minor. This includes a child whose parents renounced it under § 13(5) or § 36³(2). Restoration needs no language or Constitution exam. The conditions are permanent residence in Estonia on a residence permit or right of residence (§ 16(2)), proof of release from any other citizenship (§ 17(2), unless § 3 applies), and the refusal grounds of § 21. Other side characters: a judge, a teacher, a police officer, a minister, a journalist.

Rules for every story:
- The master plan checks the legal details of every arc against the current law text. Stories never invent legal facts.
- Every § and every hard word is tied to a memorable scene with a specific character.
- Local elections: Estonian citizens and citizens of other EU states aged 16 or older who live in the municipality vote (Constitution § 156(2), Local Government Council Election Act § 5(1)). Never write that only Estonian citizens vote there. The fact check applies this rule, because § 156 alone does not show it.
- The texts are politically neutral (author, 18.11): no real parties or real politicians by name, and no opinions on current politics. Parties as an institution stay in, because § 48 is exam content; if Jaan's party or faction comes up, it has no name and no programme. Offices are named (president, peaminister); real people are not. Changes in the law are told as facts. The TTS API terms forbid political purposes, and neutral texts stay well clear of that.

### 4.3 Voices

The API offers 12 Estonian voices. Ten belong to the fastpitch-est model: albert, indrek, kalev, kylli, liivika, mari, meelis, peeter, tambet, vesta. The model and licence behind lee and luukas are unknown, so we do not use them. The API accepts "külli" as an alias of "kylli".

The author chose six voices on 17.11: mari, meelis, tambet, kylli, liivika, peeter. On 18.11 the author confirmed albert, indrek, kalev and vesta for other recurring and side characters. The young couple joined the cast after that, so their two rows are the agent's picks. The author can change them after hearing the voice samples.

| Role | Character id | Voice |
|---|---|---|
| narrator | `narrator` | peeter |
| law block | `law` | mari |
| Olga | `olga` | liivika |
| Sergei | `sergei` | tambet |
| Lisa | `lisa` | kylli |
| Nikolai | `nikolai` | meelis |
| Mari, the neighbour | `neighbour-mari` | vesta |
| Jaan | `jaan` | kalev |
| Maksim Saar | `maksim` | indrek |
| Katja Saar | `katja` | mari. vesta, the only extra female voice, is the neighbour's; the law block is a separate file |
| side characters | per story | a voice no other speaker uses in that story. Men: albert first, then indrek or kalev when their characters are absent. Women: any of kylli, liivika, mari, vesta that is free in that story |

Rules:
- A recurring character always keeps the same voice.
- In one story file no two speakers share a voice. The law block is a separate file and does not count. The check script enforces this.
- Character ids differ from voice names. The TTS script takes every voice from `content/characters.json`, never from a character's name.
- The first batch includes a voice samples page with every voice in use. The author may change the mapping after listening, before any audio is committed.

### 4.4 Topic order

A spiral: an overview of everything first, then a detailed pass from everyday topics to institutions.

| Stage | Texts | Content | Level |
|---|---|---|---|
| 0. Overview | 1-20 | what the Constitution is; the four areas in simple words. Chapters I and III are short and concrete (language, flag, elections), so we cover them in detail here | below A2, then A2 |
| 1. Rights and freedoms | 21-90 | ch. II, § 8-55 | A2 |
| 2. Citizenship | 91-130 | the Citizenship Act and § 8 of the Constitution | A2 |
| 3. Institutions | 131-200 | ch. IV, V, VI, XIII and related § from ch. VII-X | A2+, then B1 |
| 4. Review | 201-230 | one block per area, "Kus see on kirjas?", questions in the exam format | B1 |

Every fifth text in stages 0-3 is a summary text (texts 5, 10, 15, and so on). The counts above include them. Stage 4 is all review. Text numbers in 4.4 and 4.5 are positions in reading order.

### 4.5 Difficulty curve

| Texts | Story length | New words per text | Grammar |
|---|---|---|---|
| 1-20 | 120-200 words, about 2 min | 5-6 | present tense, simple sentences |
| 21-80 | 200-300 words | 7-8 | past tense, clauses with *et*, *kui* |
| 81-160 | 300-400 words | 8-10 | impersonal passive *-takse/-ti*, *peab*, *võib* |
| 161-200 | 400-500 words, about 5 min | 6-10 | closer to legal language |
| 201-230 (stage 4) | 400-500 words | 0-2, repetition only | legal language |

Rows 1-200 are the author's curve of 17.11; the author's last row was "161 and on: 400-500 words, 6-10 new words". The 201-230 row is the agent's change for the review stage the author asked for. Summary texts take the lower end of the new-word range for their position.

Where the new words come from. The curve plans about 1400-1860 new words, but the exam list has only 531 single words to teach. A new word is a single lemma: the scheduler splits every exam entry into its words, and each word that is not A1 (in stage 0, not A1 or A2) goes into the first slot whose law block contains it, or else into a slot of its area's stage. A multiword entry ("kõrgeim riigivõim") becomes a phrase of the first slot where all its words are known or new, preferably a slot whose law block contains it; a phrase gets a gloss line but does not take a new-word place. The writer fills the other new-word places with general words the story needs, from the etLex A2 list in stage 0 and the B1 list later, and glosses them; the re-plan after the batch takes them from the written text.

Rules for the writers and the check script:
- Known words are the base list (section 5.2) plus every word introduced in an earlier text. In stage 0 only A1 counts as known. From text 21, A1 and A2.
- Planned new words: exactly the list in the text's plan entry.
- Words to repeat: every word on the plan entry's repeat list appears in the story.
- Unplanned unknown words: at most 1% of story tokens in stage 0 and at most 2% after that. The count covers the story only, not the law block, facts or questions, and skips proper names and numbers. Unplanned unknown words also get a gloss line and go into the lexicon. A compound counts as known when all its parts are known (Vabamorf gives the parts). The planned words of earlier slots count as known, so the texts of one batch can be written in parallel.
- Window rule (course report): a word introduced in text N appears at least three times in texts N+1 to N+10.
- Course targets (course report): every exam word appears at least 12 times in at least 4 texts. Every § returns at least 3 times. A return is the § in a law block, in a key fact or in a question.

### 4.6 Repetition

- A summary text links the four texts before it and recycles their words and §.
- Difficult words that a reader marks live only in that reader's browser. To get them repeated more often, the author exports the list (phase 2) and pastes it into the chat with the batch feedback. Before phase 2 the author lists the words in the chat.
- Stage 4 is all repetition: one block per exam area, "Kus see on kirjas?" tasks and questions in the exam format. Chapter I and III § come back here and in the summary texts.

### 4.7 Accuracy

- A script imports the law texts from the current Riigi Teataja editions into `content/law/`. The law block refers to § by id; agents never retype law text, so it cannot drift.
- A story must not contradict the law. An independent agent checks every text against the § it cites.
- Key facts and correct answers cite a specific §.
- Every page shows a disclaimer: this is study material; the official text of the law is on riigiteataja.ee.

## 5. Vocabulary

### 5.1 The exam word list

- Source: "Eesti-vene sõnaraamat Eesti kodakondsuse taotlejale" (Integratsiooni Sihtasutus, 2009). The foundation publishes the PDF for free on integratsioon.ee; Harno hosts it too. It has no open licence, only a copyright notice, and its reuse terms are unknown.
- The word list and the master plan are public (author, 18.11): the author needs a copy outside this computer, and the public repository is that copy. `content/vocab/exam-vocab.json` holds the headwords and our own data only; the dictionary's translations, phrase groupings and explanations are not copied. `content/plan.json` names the new words of every text. The PDF and the raw extract, which contains the dictionary's own translations, stay in `private/`, which is in `.gitignore`. A script recreates the extract from the foundation's PDF, so `private/` needs no backup. The site links to the foundation's PDF. If the foundation objects to the public list, the list and the plan move back to `private/`, and the texts and the lexicon stay public.
- `content/vocab/exam-vocab.json` holds for every word or phrase: id, lemma, our translation, exam areas, the § where it occurs, type (general word or legal term), the text that introduces it, and its target count.
- The translations are ours, made in the context of the law. For legal terms we use the standard Russian legal term, which usually matches the dictionary; that dictionary is what the reader will see in the exam. We do not copy entries, phrase groupings or explanations.
- The dictionary dates from 2009. Words that occur often in the current text of the exam chapters but are missing from the dictionary go in with the tag `extra`.

### 5.2 Base and general vocabulary

- `content/vocab/base.json`: the etLex A1, A2 and B1 lemmas, each with its level and part of speech. A1 lemmas count as known from text 1, A2 lemmas from text 21 (section 4.5). B1 lemmas never count as known; the scheduler takes general new words from them. Source: EKI's etLex list for adult learners, the vocabulary list in Sõnaveeb's teacher tools (sonaveeb.ee/teacher-tools), served by `https://etlex.eki.ee/etLex/api/v1.0/projects/etLex/lemmas?level=A1` (and `level=A2`, `level=B1`). On 18.11.2026 the API returned 732 A1 lemmas, 1057 A2 lemmas and 2841 B1 lemmas. The teacher tools state the licence CC BY 4.0 (checked 18.11.2026), so we publish the list with credit to the Eesti Keele Instituut.
- `content/vocab/lexicon.json`: our translation of every lemma used in any text or in the imported law texts. Tap-to-translate reads it on the text pages and on the Law page.

### 5.3 Annotation

Every token in a text, and every token of the imported law texts in `content/law/`, is stored with its form, its lemma and its lexicon id. Multiword expressions are one unit. The law texts are annotated once per edition, before phase 2. Law blocks and the Law page share these annotations, so tap-to-translate and the highlight of difficult words work there too.

Vabamorf from EstNLTK 1.7.5 finds the lemmas. EstNLTK needs Python 3.11 or newer and the system has 3.9, so we run it through uv on Python 3.12. Wheels exist for Apple Silicon, and Vabamorf needs no Java. Vabamorf returns verbs in the -ma form (*läks* → *minema*). When a word keeps several analyses, the agent picks one. There is no public Vabamorf API; everything runs locally.

### 5.4 Checks

`scripts/check` runs two kinds of checks:
- blocking, per text: length, planned new words, words to repeat, unplanned unknown words, § references, voices, exactly one correct answer per question. A text that fails goes back to the writer;
- report, per course: the window rule from 4.5, encounters of every exam word and returns to every §, measured against the course targets. The scheduler adds any shortfall to the repeat lists of the next unwritten slots. The report does not block a batch.

## 6. Audio

The audio is made in advance, not when a reader presses play. When a batch is built, a script sends every segment to the API once, saves the MP3 files in the repository, and the site serves them as static files. The browser never calls the TTS API. This gives instant playback, works when the API is down, keeps us within the API's limits and terms, and gives every reader the same audio.

API facts:
- `POST https://api.tartunlp.ai/text-to-speech/v2` with `text`, `speaker`, `speed`. No key needed.
- The response is WAV: mono, 22 050 Hz, 32-bit float, about 88 KB per second of speech.
- The schema allows 10 000 characters per request, but the answer must fit the server timeout. The deployed timeout is not published; the open-source default is 30 seconds. Our test on 17.11: 1547 characters took 18 seconds, 5460 characters returned 408 Request Timeout. So we synthesise per segment: one sentence, or one line of a character.
- The server sends `x-rate-limit-limit: 1000` and `x-rate-limit-remaining`. The window is short; its length and key are unknown. In one observation the TTS and translation APIs shared a counter.
- The synthesiser expands numbers and abbreviations itself: "§ 8 lg 2" is read as "paragrahv kaheksa lõige kaks".
- The worker cuts over-long sentences into chunks, which can leave audible joins. Long law sentences are therefore split at clause boundaries for synthesis only; the displayed text stays whole.

Building a file:
1. The script synthesises each segment with its speaker's voice and caches the WAV in `.cache/tts/` by a hash of text, voice and speed. The cache is in `.gitignore`; for the whole course it grows to about 6 GB. Unchanged segments are never requested again.
2. The script joins the segments with pauses: 300 ms between sentences, 700 ms between paragraphs.
3. ffmpeg with libmp3lame encodes the result as MP3, 48 kbit/s, mono, 22 050 Hz. MP3 is the safest single format, as MDN advises: every current browser supports it fully, while AAC works only partly in Firefox and Opus support in Safari depends on the OS version. That is about 0.36 MB per minute: about 18 hours of audio, about 400 MB. The author checks the bitrate by ear on the first batch, including at 0.25×, the slowest speed in the menu.
4. `timings.json` stores the start and end of every segment of `story.mp3` and `law.mp3`. It powers the highlight of the current sentence and replay of a sentence on tap.

Audio is committed only after the voices and the bitrate are settled on the first batch. Every regenerated MP3 stays in git history forever, so we keep regeneration rare. The voice samples in `public/audio/voices/` are the exception: they are a few hundred KB, and committing them lets the author hear them on the published site.

macOS `afconvert` cannot encode MP3, so ffmpeg has to be installed: `brew install ffmpeg`.

Speed: the default is 1.0. The reader picks a speed from a YouTube-style menu: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2. The choice is saved in the browser. The file is always at 1.0. The player sets both `playbackRate` and `defaultPlaybackRate`, because loading a new file resets `playbackRate` to `defaultPlaybackRate`. All browsers keep the pitch by default; Safari uses a speech-tuned algorithm.

Requests go one at a time. On 408 or 429 the script waits and retries.

API terms, published 16.11.2026:
- commercial use only with prior written consent from TartuNLP;
- no unethical or political purposes, military use included;
- the server stores the submitted text and may use it for research.

Separately, the Neurokõne API page asks integrators to tell TartuNLP at ping@tartunlp.ai. The voice model fastpitch-est is licensed CC BY-NC-SA 4.0, and its authors ask for a citation of Rätsep, Lellep & Fishel (2022), "Estonian Text-to-Speech Synthesis with Non-autoregressive Transformers", Baltic Journal of Modern Computing 10(3). No source says whether that licence covers generated audio. Every page with audio shows "Heli: Neurokõne (TartuNLP)"; the About page has the full citation.

## 7. Platform

### 7.1 Stack

- Astro 7 (7.4.x) builds a static site from `content/`.
- Interactive parts are Preact islands: the player, tap-to-translate, difficult words, questions, progress.
- TypeScript everywhere. Scripts run on Node through tsx. The package manager is pnpm, and the lockfile is committed because `withastro/action` fails without one.
- Node 24 LTS. Astro 7.4.12 and @astrojs/preact 6 declare `node >=22.23.4` in their `engines` (npm registry, checked 18.11.2026). Node 24.22.3 was installed through nvm on 18.11.2026. The nvm default stays at 22 for the author's other projects; this project pins 24 in `.nvmrc` and in `engines` in `package.json`, so run `nvm use` in the project folder.
- Python 3.12 through uv, only for lemmatisation.

Why this stack: a static site runs on GitHub Pages and on any server. Moving to another host means changing `site` and `base` in `astro.config.mjs` and rebuilding; the code stays the same. Browser progress stays with the old address, so readers carry it over by export and import (section 7.4). Astro sends no JavaScript to the browser except the islands, so pages open fast. Preact has the React API, which agents know well.

### 7.2 Hosting

Public repository `github.com/ALapina/estonian-constitution-ci`. GitHub Actions builds the site with `withastro/action@v6` and publishes it to GitHub Pages at `https://alapina.github.io/estonian-constitution-ci/`.

- Repository settings: Settings → Pages → Source: GitHub Actions.
- `astro.config.mjs`: `site: 'https://alapina.github.io'`, `base: '/estonian-constitution-ci'`. With `base` written without a trailing slash and the default `trailingSlash`, `import.meta.env.BASE_URL` has no trailing slash either. One helper function builds every internal link and audio path and adds the slash itself.
- Limits. The published site may be at most 1 GB (hard limit). Bandwidth is about 100 GB a month (soft limit). Git rejects files over 100 MiB. GitHub recommends keeping a Pages source repository under 1 GB, and that counts the whole git history, so every regenerated MP3 adds to it. GitHub also recommends at most 3000 entries per directory, so audio goes in one folder per text. Pages does not serve Git LFS files.
- Building a public repository costs no Actions minutes.
- Our site answers byte-range requests for MP3 files with HTTP 206 and serves them as `audio/mp3` (checked on the voice samples, 18.11.2026). Safari on iOS needs byte ranges. GitHub does not document this behaviour.
- GitHub Pages logs visitors' IP addresses. The About page says so.

### 7.3 Pages

The interface is in Russian. The layout is desktop-first, because the author will use the site on a computer first (author's decision, 18.11). A mobile layout is in BACKLOG.

- Home: progress, a "continue" button, the list of texts by stage and area.
- Text: everything in section 4.1.
- Law (phase 2): the exam chapters and the Citizenship Act with tap-to-translate and links from each § to its texts.
- My words: marked difficult words, how often each has appeared, export.
- Voice samples (first batch).
- About: method, disclaimer, sources, credits, licences, privacy note.

### 7.4 State in the browser

The author needs the browser storage to stay correct, so:
- all state lives under one `localStorage` key, `estonian-constitution-ci`, holding versioned JSON (`{ "version": 1, ... }`). Every GitHub Pages site of the ALapina account shares the origin `https://alapina.github.io` and its storage, so the key carries the project name. A version bump runs a migration and never wipes data;
- state refers to stable ids only. A text gets its permanent id, in reading order, when its batch is written, and the id of a written text never changes. The scheduler may renumber, add or drop unwritten slots. Lemma ids never change. So a regenerated text keeps its progress;
- storage belongs to one origin. Progress made on a local build does not reach the published site, so the author reads on the published site once it exists. A move to another host carries progress over only through export and import;
- every read and write is wrapped in try/catch, and the site works without storage;
- phase 2 adds export and import of the whole state as a JSON file, as a backup.

Stored: read texts, difficult words (by lemma, so every form is highlighted), playback speed, answers, difficulty ratings. Since 19.11 the state is `{ "version": 1, "texts": { "<id>": { "read": "<ISO time>", "rating": "easy" | "fine" | "hard" } }, "speed": 0.75, "answers": { "<id>": [<option index> | null, ...] } }` (`src/lib/state.ts`); later fields join this object.

### 7.5 Phases

New texts come out every day whatever the phase.

| Phase | Dates | What appears |
|---|---|---|
| 0 | 18.11 | local project: Astro, data schema, law import, vocabulary lists, master plan, CLAUDE.md, README, first batch (texts 1-15) with audio, voice samples page. Text page: story, plain `<audio>` with the credit, new words, law block with facts and the Riigi Teataja note, disclaimer. A plain list of texts and the About page. Push and the first Pages deploy happen once the repository exists |
| 1 | 19-23.11 | own player with the speed menu, questions, "read" marks, difficulty rating, home page with progress |
| 2 | 24-30.11 | tap-to-translate, difficult words with highlight and export, highlight of the current sentence, the Law page, export and import of progress |
| after the exam | | BACKLOG.md |

Phase 0 starts in the local folder. The master plan, the first batch and the local build do not wait for GitHub.

The author's steps:
- create an empty public repository `estonian-constitution-ci` on github.com and set Settings → Pages → Source: GitHub Actions. There is no `gh` CLI on the computer; push over SSH as ALapina works;
- register for the 12.12.2026 exam by about 27.11, if not registered yet.

The agent's steps:
- `nvm install 24` and pnpm for it (done 18.11: Node 24.22.3, pnpm 12.13.0);
- `brew install ffmpeg`; `uv python install 3.12` (done 18.11: ffmpeg 9.0.2 with libmp3lame, Python 3.12.16);
- `git init` with `private/`, `.cache/` and `public/audio/` in `.gitignore`. Audio leaves `.gitignore` once the author settles the voices and the bitrate. Commits stay local until the GitHub repository exists;
- copy the dictionary PDF into `private/`.

## 8. How a batch is made

A batch is 15 texts. Its audio grows from about 45 minutes (texts 1-20) to about 80 minutes (texts 161-200), so with questions a batch takes from about one hour to about one and a half. If the author asks, a second batch follows the same day. To start one, the author says "next batch" in Claude Code in the project folder and adds short feedback on the last batch: what was hard and which words were difficult.

`CLAUDE.md`, written in phase 0, tells agents how to work:
- the batch steps below;
- the rules of 4.5 and the glossary format "form ← lemma — translation";
- rules for Estonian story text: level and grammar from 4.5, one segment per character line, the local elections rule and political neutrality from 4.2, associations, no invented legal facts;
- the voice rules from 4.3;
- the check commands;
- English for everything in the repository.

The master plan. A scheduler script fills the ~250 slots: stage, area and type of each text (serial, side story, summary, review); the § it covers, so that every § returns three times; new words by the curve; and words to repeat by the window rule and the course targets. The agent then adds characters and a story idea to each slot. After every batch the script re-plans the remaining slots from what was actually written.

The steps:
1. Plan. Take the next 15 entries of `content/plan.json`. An entry has: id, stage, area, type, §, new words, words to repeat, characters, story idea, length, grammar. The author's feedback may move the number of new words within the curve's range; the script then re-plans.
2. Write. Agents write the 15 texts in parallel, each from its own entry. The explicit lists of words to repeat let parallel writers keep the repetition schedule.
3. Annotate. Lemmas, lexicon ids, translations of new general words.
4. Check. `scripts/check` runs the blocking checks from 5.4.
5. Fact check. An independent agent compares the story, the facts and the questions with the text of the § they cite.
6. Audio. Synthesis per segment, joining, `timings.json`.
7. Build and publish. The site builds locally. Once the repository exists: commit, push, and GitHub Actions publishes the site.

A text that fails step 4 or 5 goes back to step 2 with the reasons.

## 9. Repository layout

```
content/
  characters.json        characters and voices
  plan.json              master plan: about 250 slots
  law/
    constitution.json    Constitution § with edition id
    citizenship-act.json Citizenship Act § with edition id
    tokens.json          lemmas of every part and point (scripts/lemmatize.py --law)
  vocab/
    base.json            etLex A1-B1 base list (CC BY 4.0)
    exam-vocab.json      exam word list: dictionary headwords, our data
    lexicon.json         our translations of every lemma used
  texts/
    0001.json            a text: segments, tokens, law refs, facts, questions
public/
  audio/
    0001/
      story.mp3
      law.mp3
      timings.json
    voices/              voice samples
scripts/                 law import, scheduler, checks, TTS, lemmatize.py
docs/                    agent instructions: writing-texts.md, batch.md
src/                     Astro pages, components, islands; data contracts in src/lib/types.ts
.github/workflows/
  deploy.yml             build and publish to GitHub Pages
astro.config.mjs
.nvmrc
private/                 in .gitignore: dictionary PDF, raw extract
.cache/                  in .gitignore: TTS segment cache
DESIGN.md
BACKLOG.md
CLAUDE.md
README.md
```

`private/` holds only the dictionary PDF and a file that a script recreates from it, so it needs no backup.

Fields of `content/texts/NNNN.json`:
- `id`, `stage`, `area`, `type` (serial, side, summary, review);
- `law`: § ids. An id is the act, then the §, then `-lg` and the part, then `-p` and the point; a superscript follows `_`. Examples: `ps-65`; `ps-8-lg2` for § 8(2); `kods-2_1` for § 2¹; `kods-2-lg1` for § 2(1); `kods-13-lg4_3` for § 13(4³); `kods-21-lg1-p6` for § 21(1) p 6. Key facts and question explanations use the same ids;
- `editions`: the edition id of every act the text cites, for example `{ "ps": "111042025003", "kods": "126062025008" }`;
- `tags`: for example `["932 SE"]`;
- `segments`: in order; each has a speaker, the text and its tokens (form, lemma, lexicon id);
- `newWords`: form, lemma, translation;
- `facts`: text and § id;
- `questions`: type (true/false, 3-4 options, "Kus see on kirjas?"), text, options, the correct option, explanation with § id;
- `audio`: paths to `story.mp3`, `law.mp3` and `timings.json`.

Law import. Riigi Teataja serves `/public-api/api/v1/akt/{id}/xml`, which its FAQ documents, and `/public-api/api/v1/akt/{id}/txt`, which the site's own scripts use but which is undocumented and may change. The importer validates the structure and fails with a clear error when it changes. Known quirks of the Constitution's XML: § 104-110 sit after the closing tag of chapter VII, and every part of a § has an id ending in `lg1`, with no part numbers. So chapter membership and part numbers come from the TXT export. A link to the current edition of a § looks like `https://www.riigiteataja.ee/akt/111042025003?leiaKehtiv#para8`. Anchors for parts of a § do not work on the new site.

## 10. Rights and licences

- Law texts. The Copyright Act (§ 5 p 3) does not apply to legislation and its official translations. The Riigi Teataja Act (§ 12(1)) lets other websites republish laws if they say that the official text is published in Riigi Teataja and link to it. Every law block and the Law page carry that note. The English translations in Riigi Teataja and the Russian ones on juristaitab.ee are unofficial, so § 5 p 3 does not cover them: we link to them and never copy them.
- The exam dictionary. The public word list holds the dictionary's headwords with our own translations and data; no entries are copied (section 5.1). The About page names the 2009 dictionary of Integratsiooni Sihtasutus as the source of the word list and links to its PDF.
- The etLex base list: CC BY 4.0, credited to the Eesti Keele Instituut.
- Audio: used under the API terms in section 6, with the credit and the citation.
- Our licence (author, 18.11): texts, translations, the master plan and audio under CC BY-NC-SA 4.0 (`LICENSE-CONTENT`), the same licence as the voice model; code under MIT (`LICENSE`). Outside our licence: the law texts, because copyright does not cover them; the etLex base list (CC BY 4.0); the headwords of the exam word list, which come from the 2009 dictionary. Whether we hold any rights in TTS output is an open question (section 12).
- Letters to Integratsiooni Sihtasutus and TartuNLP are desirable and block nothing (BACKLOG). The agent advises sending the TartuNLP letter before about 25.11, because they ask integrators to notify them.

## 11. Risks

| Risk | Response |
|---|---|
| a legal fact is wrong | a script imports the law from Riigi Teataja; an independent fact check; disclaimer |
| the law changes (932 SE from 01.01.2027) | every text records the edition of every act it cites; texts tagged `932 SE` are updated after the change takes effect |
| the TTS API is down, limits us or changes its terms | segment cache, one request at a time; a text can go out without audio and get it later |
| 230 texts in three weeks is too many | texts come before platform features; 15 texts a day. If we fall behind, the agent proposes which texts to drop, side stories first, never a text that is the only carrier of a § (such as the restoration story for § 16-17), and attaches the coverage report for the cut. The author decides. The stage 4 review stays |
| the daily batch outgrows the author's 1-2 hours | the author's feedback lowers length and new words within the curve's ranges |
| an agent adds unplanned new words | the check script rejects the text |
| the repository grows with audio | MP3 at 48 kbit/s; audio committed only after the voices and bitrate are settled; regeneration only for changed texts; near 1 GB, the plan in BACKLOG |
| the foundation objects to the public word list | the list and the plan move back to `private/`; the texts and the lexicon are ours and stay public |

## 12. Open questions

- How the 24 exam questions split across the areas. Not published.
- Whether the live exam shows the same aids as the EIS samples (inference: probably).
- Which edition of the laws the live exam shows. The EIS samples show outdated editions (section 2.4). Ask at the free Harno consultation.
- Whether the voice model licence covers generated audio, and what credit TartuNLP wants. Ask TartuNLP.
- The length and key of the API's rate-limit window. No header states it; the TTS script logs `x-rate-limit-remaining` to estimate it.
- How and when the oath of loyalty is given (the minister's regulation under KodS § 19(4)). The master plan checks it.
- The deployed TTS timeout. Not published; our tests work around it.
- Whether the President promulgates 932 SE. Check after 25.11.2026.
- The MP3 bitrate. The author listens to the first batch.
- Whether the author is registered for 12.12.2026.

## 13. Pending decisions

None. The author settled P1-P6 on 18.11 (section 14).

## 14. Decision log

"By" says who made the decision. The author makes content and product decisions; the agent makes engineering choices that need no confirmation and explains them to the author.

| Date | By | Decision |
|---|---|---|
| 16.11 | author | Method: comprehensible input; A2-B1 stories of 2-5 minutes with Neurokõne audio; 1-2 hours of reading a day; the stories build associations |
| 16.11 | author | The author's level is between A2 and B1; start easier than A2; difficulty rises slowly |
| 16.11 | author | New words with translation under each text (the author named 8-10; the curve of 17.11 refined it); tap-to-translate; marking of difficult words, highlighted in later texts |
| 16.11 | author | Format: a main serial plus side stories |
| 16.11 | author | Order: a spiral; after the overview, rights and citizenship, then institutions |
| 16.11 | author | After the story, a law block with the authentic § text and 3-5 key facts |
| 16.11 | author | 1-2 multiple-choice questions on the content of the law |
| 16.11 | author | Every fifth text is a summary text; the last week is review by area |
| 16.11 | author | Texts come in batches |
| 17.11 | author | Characters: the Ivanov family in Tallinn (Olga, Sergei, Lisa, Nikolai with a restoration arc) and the Estonian neighbours Mari and Jaan |
| 17.11 | author | The length and difficulty curve (rows 1-200 of section 4.5); 15 texts a day; an extra batch on request |
| 17.11 | author | A master plan before the texts; a script checks word coverage |
| 17.11 | author | New words in the format "form ← lemma — translation" |
| 17.11 | author | Voices: mari, meelis, tambet, kylli, liivika, peeter; default speed 1.0 with a YouTube-style speed control; one file at 1.0; the law block is voiced |
| 17.11 | author | Start in a local folder, push to the author's GitHub account ALapina later |
| 17.11 | author | The platform grows alongside the texts; text generation starts right after the design |
| 17.11 | author | No accounts; state in the browser; simple authentication later if the project grows |
| 17.11 | author | GitHub Pages now; the home server later |
| 17.11 | author | The project is public: our own translations instead of a copy of the dictionary, Neurokõne credit, a disclaimer; letters to the foundation and TartuNLP are desirable, not blocking |
| 17.11 | author | The agent picks the stack; the whole project is built by AI |
| 17.11 | author | Interface in Russian only; English later |
| 17.11 | author | Volume: the optimum, about 230 texts, about 20 hours |
| 17.11 | agent | Astro 7, Preact, TypeScript |
| 17.11 | agent | Audio in MP3, the safest single format for all browsers |
| 17.11 | agent | Synthesis per segment: the API cannot finish long texts within its timeout |
| 18.11 | author | Open-book additions confirmed: chapter and § in law blocks, "Kus see on kirjas?" tasks, the Law page in phase 2 |
| 18.11 | author | Voices albert, indrek, kalev, vesta confirmed for other recurring and side characters |
| 18.11 | author | A young couple joins the cast: the husband has Estonian roots, the wife's status depends on the topics to cover. The agent's legal set-up is pending P6 |
| 18.11 | author | The base vocabulary comes from EKI's etLex A1-A2 list (Sõnaveeb teacher tools) |
| 18.11 | agent | In stage 0 only A1 counts as known; from text 21, A1 and A2 |
| 18.11 | agent | Audio is generated in advance and served as static files (explained to the author) |
| 18.11 | author | Desktop-first layout, because the author uses a computer first and the browser storage must hold correct data; a mobile layout and authentication go to BACKLOG |
| 18.11 | agent | Versioned browser storage under a project-specific key, stable ids, backup export (section 7.4) |
| 18.11 | author | Everything written for GitHub is in English |
| 18.11 | agent | The exam word list and the master plan stay in `private/` until the foundation answers (replaced the same day, see below) |
| 18.11 | agent | Node 24 LTS, because Astro 7.4 requires Node 22.23.4 or newer |
| 18.11 | agent | Stage 4 row of the curve: 0-2 new words, repetition only |
| 18.11 | author | P1: Nikolai naturalises |
| 18.11 | author | P2: area 3 includes related § from chapters VII-X |
| 18.11 | author | P3: texts tagged `932 SE` are updated in January 2027 |
| 18.11 | author | P4: the texts are politically neutral |
| 18.11 | author | P5: texts, translations, the plan and audio under CC BY-NC-SA 4.0; code under MIT |
| 18.11 | author | P6: the husband's grandfather was an Estonian citizen on 16.06.1940, so the husband is a citizen by birth; the wife's status follows the topics to cover, and the agent chose it |
| 18.11 | author | The exam word list and the master plan are public, so a copy lives outside the author's computer. The dictionary's own translations are not copied |
| 18.11 | agent | The nvm default stays at Node 22 for the author's other projects; this project pins Node 24 |
| 18.11 | agent | New words are single lemmas; multiword exam entries come as glossed phrases of known words (section 4.5) |
| 18.11 | agent | The check counts compounds of known words as known, and earlier slots' planned words as known |
| 18.11 | agent | Voice samples are committed; other audio waits for the author's approval of voices and bitrate |
| 18.11 | author | The young couple are Maksim and Katja Saar; Maksim's grandfather is Johannes Saar of Tartu |
| 18.11 | author | Maksim and Katja come from Ukraine (Kharkiv); the agent's background: in Tallinn since 2019, Maksim finds his grandfather's passport in stage 1 |
| 18.11 | author | Commits use the author's personal identity, Anna Lapina <alapina@outlook.com>, never the work email |
| 19.11 | agent | Phase 1 starts with the read mark and the rating: rating a text also marks it read; the home page shows progress, a "continue" link to the first unread text, a badge per text and filters "all / unread / hard" for rereading |
| 19.11 | agent | Phase 1 player: play/pause, ±5 s skips, a seek bar and the speed menu; one speed for every player; only one player plays at a time. Questions: the reader picks an option, then sees right or wrong and the explanation; answers are saved and can be cleared with "Ответить заново" |
