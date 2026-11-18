# /// script
# requires-python = ">=3.12"
# dependencies = ["pypdf==7.1.1"]
# ///
"""Parse the exam dictionary into a private extract and the public exam word list.

Source: "Eesti-vene sõnaraamat Eesti kodakondsuse taotlejale" (Integratsiooni
Sihtasutus, 2009), private/dictionary-2009.pdf. See DESIGN.md section 5.1.

Run from the project root:

  uv run scripts/parse_dictionary.py

Writes:
- private/dictionary-raw.json: every headword and phrase with the dictionary's
  Russian translation, its explanation, its cross-reference and its page.
  It stays private.
- content/vocab/exam-vocab.json: one ExamWord (src/lib/types.ts) per headword and
  phrase, ids in order of appearance. It is public, so it holds the Estonian
  lemmas and our own fields only: no Russian text, no explanations. Once the file
  carries our own data (translations, lemmas, levels and so on), the script
  leaves it alone and only checks that its dictionary fields still match the PDF.

How the PDF is laid out, as pypdf extracts it:
- Every dictionary page has its printed page number on a line of its own. The
  cover, the imprint, the blank page and the back cover have none. `page` is the
  printed number; `pdfPage` in the raw extract is the page index in the PDF file.
- A single capital letter on a line of its own starts a letter section.
- An entry is `headword  translation; phrase  translation; ...`. Estonian is in
  Latin script and Russian in Cyrillic, so the script of a word tells its side.
  The gap between the sides is usually two spaces but sometimes one, and an
  Estonian part can contain two spaces as well (`lahkuma  riigist`).
- An explanation in parentheses can follow the Estonian part (`korraldus (jur)`,
  `kaotama (kodakondsust)`); the PDF sets it in regular type, not bold. A bold
  parenthesis belongs to the headword (`kodakondsuse (ära)võtmine`): it is glued
  to the next word. A cross-reference takes the place of a translation
  (`hulgast valima vt valima kellegi hulgast`).
- Lines wrap anywhere, inside phrases and translations too. Estonian words are
  hyphenated at line ends (`õigus-` + `aktide`). The one Russian word broken at a
  line end, `премьер-` + `министры`, has a real hyphen.
- A few words mix scripts by typo: `oткрытое` starts with a Latin o.
"""

import hashlib
import json
import re
import sys
import unicodedata
from collections.abc import Callable
from dataclasses import dataclass, field, replace
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "private" / "dictionary-2009.pdf"
RAW = ROOT / "private" / "dictionary-raw.json"
VOCAB = ROOT / "content" / "vocab" / "exam-vocab.json"

# The copy this parser was checked against (the foundation's PDF of 2 October 2009).
CHECKED_SHA256 = "152ac15cf307abd78de130074fad466b3d48ad0139d87f55c93b2691f4142e73"

# Course target: every exam word appears at least 12 times (DESIGN.md 4.5).
TARGET = 12

# ExamWord fields that come from the dictionary. The others hold our own data.
DICTIONARY_FIELDS = ("id", "lemma", "multiword", "parent", "page")
OWN_DEFAULTS = {
    "translation": "",
    "level": None,
    "areas": [],
    "refs": [],
    "kind": None,
    "introducedIn": None,
    "target": TARGET,
    "tags": [],
}

PAGE_NUMBER_RE = re.compile(r"\d+")
SECTION_RE = re.compile(r"[A-ZÕÄÖÜŠŽ]")
SEPARATORS = (";", ":")
# A separator, or a word that may contain parenthesised parts ("(ära)võtmine",
# "пожизненный(ое)", "(eraelu puutumatus)"), or a parenthesis left unmatched on its line.
TOKEN_RE = re.compile(r"[;:]|(?:\([^()]*\)|[^\s;:()])+|[()]")
CYRILLIC_RE = re.compile(r"[\u0400-\u04ff]")

# Latin and Cyrillic letters that look alike, for words typed with a letter of the
# other script.
LATIN_LOOKALIKES = "aceopxyABCEHKMOPTX"
CYRILLIC_LOOKALIKES = (
    "\u0430\u0441\u0435\u043e\u0440\u0445\u0443"  # a c e o p x y
    "\u0410\u0412\u0421\u0415\u041d\u041a\u041c\u041e\u0420\u0422\u0425"  # A B C E H K M O P T X
)
TO_CYRILLIC = str.maketrans(LATIN_LOOKALIKES, CYRILLIC_LOOKALIKES)
TO_LATIN = str.maketrans(CYRILLIC_LOOKALIKES, LATIN_LOOKALIKES)

Warn = Callable[[str], None]


@dataclass(frozen=True)
class Line:
    text: str
    page: int  # printed page number
    pdf_page: int  # 1-based page index in the PDF file


@dataclass(frozen=True)
class Token:
    text: str
    kind: str  # "word", "sep" (; or :) or "section" (a section letter)
    page: int
    pdf_page: int
    line_start: bool
    line_end: bool
    script: str = ""  # "lat", "cyr", or "" for a word without letters


@dataclass
class Segment:
    """A headword or a phrase with its translation."""

    page: int
    pdf_page: int
    est: list[str] = field(default_factory=list)
    note: list[str] = field(default_factory=list)
    see: list[str] = field(default_factory=list)
    rus: list[str] = field(default_factory=list)


@dataclass
class Entry:
    headword: Segment
    phrases: list[Segment] = field(default_factory=list)


def script_of(ch: str) -> str:
    if not ch.isalpha():
        return ""
    name = unicodedata.name(ch, "")
    if name.startswith("LATIN"):
        return "lat"
    if name.startswith("CYRILLIC"):
        return "cyr"
    return "other"


def read_lines(pdf: Path) -> list[Line]:
    """Text lines of the dictionary pages, without the page numbers."""
    lines: list[Line] = []
    expected = 1
    for pdf_page, page in enumerate(PdfReader(pdf).pages, start=1):
        texts = [t.strip() for t in page.extract_text().splitlines()]
        texts = [t for t in texts if t]
        numbers = [t for t in texts if PAGE_NUMBER_RE.fullmatch(t)]
        if not numbers:
            continue  # cover, imprint, blank page, back cover
        if numbers != [str(expected)]:
            sys.exit(f"PDF page {pdf_page}: expected the printed page number {expected}, found {numbers}")
        lines += [Line(t, expected, pdf_page) for t in texts if t != numbers[0]]
        expected += 1
    if expected == 1:
        sys.exit(f"{pdf.name}: no numbered dictionary pages found")
    return lines


def tokenize(lines: list[Line]) -> list[Token]:
    tokens: list[Token] = []
    for line in lines:
        if SECTION_RE.fullmatch(line.text):
            tokens.append(Token(line.text, "section", line.page, line.pdf_page, True, True))
            continue
        pieces = TOKEN_RE.findall(line.text)
        for i, piece in enumerate(pieces):
            kind = "sep" if piece in SEPARATORS else "word"
            tokens.append(Token(piece, kind, line.page, line.pdf_page, i == 0, i == len(pieces) - 1))
    return tokens


def join_hyphenated(tokens: list[Token]) -> tuple[list[Token], list[str]]:
    """Join words hyphenated at a line end. Estonian loses the hyphen, Russian keeps it."""
    out: list[Token] = []
    joined: list[str] = []
    for tok in tokens:
        prev = out[-1] if out else None
        if (
            prev is not None
            and prev.kind == tok.kind == "word"
            and prev.line_end
            and tok.line_start
            and len(prev.text) > 1
            and prev.text.endswith("-")
            and prev.text[-2].isalpha()
            and tok.text[0].isalpha()
        ):
            before, after = script_of(prev.text[-2]), script_of(tok.text[0])
            if before == after == "lat" and tok.text[0].islower():
                text = prev.text[:-1] + tok.text
            elif before == after == "cyr":
                text = prev.text + tok.text
            else:
                text = None
            if text is not None:
                out[-1] = replace(prev, text=text, line_end=tok.line_end)
                joined.append(f"{prev.text} + {tok.text} -> {text} (page {prev.page})")
                continue
        out.append(tok)
    return out, joined


def classify(tokens: list[Token], warn: Warn) -> tuple[list[Token], list[str]]:
    """Set the script of every word; fix words typed with a look-alike letter of the other script."""
    out: list[Token] = []
    fixed: list[str] = []
    for tok in tokens:
        if tok.kind != "word":
            out.append(tok)
            continue
        text = tok.text
        scripts = [script_of(ch) for ch in text]
        lat, cyr = scripts.count("lat"), scripts.count("cyr")
        if lat and cyr:
            text = text.translate(TO_CYRILLIC if cyr > lat else TO_LATIN)
            fixed.append(f"{tok.text} -> {text} (page {tok.page})")
            scripts = [script_of(ch) for ch in text]
            if "lat" in scripts and "cyr" in scripts:
                warn(f"page {tok.page}: {tok.text!r} mixes Latin and Cyrillic letters")
            lat, cyr = scripts.count("lat"), scripts.count("cyr")
        script = "cyr" if cyr > lat else "lat" if lat else ""
        out.append(replace(tok, text=text, script=script))
    return out, fixed


def parse(tokens: list[Token], warn: Warn) -> list[Entry]:
    """Group the tokens into entries: a headword and the phrases listed inside it.

    A Latin word
    - after `;` or `:` starts a phrase of the current entry, also at the start of a line;
    - after Russian text on the same line starts a phrase too: a few separators are
      missing (`принадлежать  kuuluma erakonda`) or are commas (`законопроект, seaduseelnõu algatama`);
    - at the start of a line, after a translation or a cross-reference, starts a new headword;
    - anywhere else continues the Estonian part, which may wrap to the next line.
    A Latin word in parentheses at the end of an Estonian part is the dictionary's
    explanation, and `vt` starts a cross-reference.
    """
    entries: list[Entry] = []
    seg = Segment(0, 0)  # placeholder until the first headword
    # "start": before the first entry of a section; "est": in an Estonian part;
    # "see": in a cross-reference; "rus": in a translation; "sep": after ; or :
    state = "start"
    for tok in tokens:
        where = f"page {tok.page}, {tok.text!r}"
        if tok.kind == "section":
            state = "start"
            continue
        if tok.kind == "sep":
            if state == "est":
                warn(f"{where}: separator before any translation")
            if state != "start":
                state = "sep"
            continue
        in_parens = tok.text.startswith("(") and tok.text.endswith(")")
        if tok.script == "lat" and not (state == "rus" and in_parens):
            if state == "est" and in_parens:
                seg.note.append(tok.text[1:-1])
                continue
            if state == "est" and tok.text == "vt":
                state = "see"
                continue
            if state == "start" or (tok.line_start and state in ("rus", "see")):
                seg = Segment(tok.page, tok.pdf_page)
                entries.append(Entry(seg))
                state = "est"
            elif state in ("rus", "sep"):
                seg = Segment(tok.page, tok.pdf_page)
                entries[-1].phrases.append(seg)
                state = "est"
            (seg.see if state == "see" else seg.est).append(tok.text)
        elif tok.script:
            # Russian, or Latin in parentheses inside a translation
            if state == "start":
                warn(f"{where}: Russian text before any headword")
                continue
            if state == "sep":
                warn(f"{where}: Russian text after a separator, kept in the translation before it")
                seg.rus.append(";")
            elif state == "see":
                warn(f"{where}: Russian text after a cross-reference")
            if tok.script == "lat":
                warn(f"{where}: Latin text inside a translation")
            seg.rus.append(tok.text)
            state = "rus"
        elif state in ("est", "see", "rus"):
            # punctuation or digits belong to the part they stand in
            {"est": seg.est, "see": seg.see, "rus": seg.rus}[state].append(tok.text)
        else:
            warn(f"{where}: stray token")
    return entries


def clean(parts: list[str]) -> str:
    """Join tokens and normalise whitespace; drop separators at the ends."""
    text = " ".join(" ".join(parts).split())
    text = re.sub(r" (?=[,;:?!)])", "", text)
    text = re.sub(r"(?<=\() ", "", text)
    return text.strip(" ,;:")


def build(entries: list[Entry]) -> tuple[list[dict], list[dict]]:
    """Records of the raw extract and of the public word list, in order of appearance."""
    raw: list[dict] = []
    vocab: list[dict] = []
    for entry in entries:
        head_id = None
        for seg in (entry.headword, *entry.phrases):
            entry_id = f"ev-{len(raw) + 1:04d}"
            lemma = clean(seg.est)
            raw.append(
                {
                    "id": entry_id,
                    "lemma": lemma,
                    "parent": head_id,
                    "translation": clean(seg.rus),
                    "note": clean(seg.note) or None,
                    "see": clean(seg.see) or None,
                    "page": seg.page,
                    "pdfPage": seg.pdf_page,
                }
            )
            vocab.append(
                {
                    "id": entry_id,
                    "lemma": lemma,
                    "multiword": len(lemma.split()) > 1,
                    "parent": head_id,
                    "translation": "",
                    "level": None,
                    "areas": [],
                    "refs": [],
                    "kind": None,
                    "introducedIn": None,
                    "target": TARGET,
                    "page": seg.page,
                    "tags": [],
                }
            )
            head_id = head_id or entry_id
    return raw, vocab


def validate(raw: list[dict], vocab: list[dict], warn: Warn) -> None:
    for r in raw:
        label = f"{r['id']} {r['lemma']!r} (page {r['page']})"
        if not r["lemma"]:
            warn(f"{label}: no Estonian text")
        elif CYRILLIC_RE.search(r["lemma"]) or re.search(r"\d", r["lemma"]):
            warn(f"{label}: Cyrillic letters or digits in the lemma")
        if not r["translation"] and not r["see"]:
            warn(f"{label}: no translation and no cross-reference")
        if r["translation"] and r["see"]:
            warn(f"{label}: both a translation and a cross-reference")
    if CYRILLIC_RE.search(json.dumps(vocab, ensure_ascii=False)):
        sys.exit("Cyrillic text in the public word list: nothing written")


def dump(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def carries_own_data(existing: list[dict]) -> bool:
    return any(
        key not in DICTIONARY_FIELDS and (key not in OWN_DEFAULTS or value != OWN_DEFAULTS[key])
        for e in existing
        for key, value in e.items()
    )


def write_vocab(vocab: list[dict]) -> bool:
    """Write the public word list unless the existing file carries our own data.

    Returns False when an existing file with our data no longer matches the PDF."""
    if VOCAB.exists():
        existing = json.loads(VOCAB.read_text(encoding="utf-8"))
        if carries_own_data(existing):
            fresh = {e["id"]: e for e in vocab}
            problems = []
            for e in existing:
                new = fresh.pop(e["id"], None)
                if new is None:
                    if "extra" not in e.get("tags", []):
                        problems.append(f"{e['id']} {e.get('lemma')!r}: not in the dictionary and not tagged extra")
                else:
                    problems += [
                        f"{e['id']}: {k} is {e.get(k)!r} in the file, {new[k]!r} in the PDF"
                        for k in DICTIONARY_FIELDS
                        if e.get(k) != new[k]
                    ]
            problems += [f"{i} {e['lemma']!r}: missing from the file" for i, e in fresh.items()]
            rel = VOCAB.relative_to(ROOT)
            if problems:
                print(f"{rel} carries our own data and differs from the PDF; not changed:")
                for p in problems:
                    print(f"  {p}")
                return False
            print(f"{rel} carries our own data; not changed, its dictionary fields match the PDF")
            return True
    dump(VOCAB, vocab)
    print(f"wrote {VOCAB.relative_to(ROOT)}")
    return True


def main() -> int:
    if not PDF.exists():
        sys.exit(f"missing {PDF.relative_to(ROOT)}: download the dictionary PDF first (DESIGN.md 5.1)")
    warnings: list[str] = []
    warn = warnings.append
    digest = hashlib.sha256(PDF.read_bytes()).hexdigest()
    if digest != CHECKED_SHA256:
        warn(f"{PDF.name} differs from the copy this parser was checked against; review the output")

    lines = read_lines(PDF)
    tokens, joined = join_hyphenated(tokenize(lines))
    tokens, fixed = classify(tokens, warn)
    entries = parse(tokens, warn)
    raw, vocab = build(entries)
    validate(raw, vocab, warn)

    dump(
        RAW,
        {
            "source": {
                "title": "Eesti-vene sõnaraamat Eesti kodakondsuse taotlejale",
                "publisher": "Integratsiooni Sihtasutus",
                "year": 2009,
                "file": PDF.relative_to(ROOT).as_posix(),
                "sha256": digest,
                "pages": "page: printed page number; pdfPage: page index in the PDF file",
            },
            "entries": raw,
        },
    )
    print(f"wrote {RAW.relative_to(ROOT)}")
    ok = write_vocab(vocab)

    headwords = [r for r in raw if r["parent"] is None]
    multiword = [v for v in vocab if v["parent"] is None and v["multiword"]]
    print(
        f"{lines[-1].page} pages: {len(raw)} entries: {len(headwords)} headwords "
        f"({len(multiword)} multiword), {len(raw) - len(headwords)} phrases; "
        f"{sum(1 for r in raw if r['see'])} cross-references, {sum(1 for r in raw if r['note'])} explanations"
    )
    print(f"joined {len(joined)} words hyphenated at line ends")
    for f in fixed:
        print(f"fixed mixed scripts: {f}")
    for w in warnings:
        print(f"warning: {w}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
