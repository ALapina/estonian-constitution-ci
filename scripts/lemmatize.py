# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["estnltk==1.7.5"]
# ///
"""Lemmatise Estonian text with Vabamorf (EstNLTK 1.7.5), DESIGN.md 5.3.

Usage, from the project root:
  uv run scripts/lemmatize.py --law          tokens of every law part and point -> content/law/tokens.json
  uv run scripts/lemmatize.py --vocab        enrich content/vocab/exam-vocab.json (lemmas, level, kind, areas, refs)
  uv run scripts/lemmatize.py --texts ID...  fill `tokens` of every segment of content/texts/ID.json
  uv run scripts/lemmatize.py --stdin        JSON list of strings on stdin -> JSON list of token lists

A token is {"f": form, "l": lemma, "p": part of speech, "alt": [other lemmas]}. Lemmas are lower-cased
except proper names (p == "H"). When Vabamorf keeps several analyses, "l" is the first lemma and "alt"
holds the rest; the checks treat a token as known when any of its lemmas is known.

--vocab needs content/law/tokens.json (run --law first) and content/vocab/base.json. It keeps
`translation`, `introducedIn`, `target` and `tags` of existing entries.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from estnltk import Text

ROOT = Path(__file__).resolve().parent.parent
LAW_DIR = ROOT / "content" / "law"
VOCAB = ROOT / "content" / "vocab" / "exam-vocab.json"
BASE = ROOT / "content" / "vocab" / "base.json"
TEXTS = ROOT / "content" / "texts"

# Exam areas by chapter (DESIGN.md 2.3). Related § of Constitution chapters VII-X count for area 3
# only through the master plan, so they are not mapped here.
PS_AREA_BY_CHAPTER = {"ps-ch1": 1, "ps-ch3": 1, "ps-ch2": 2, "ps-ch4": 3, "ps-ch5": 3, "ps-ch6": 3, "ps-ch13": 3}
KODS_EXAM_LAST = 35  # Citizenship Act § 1-35 are exam content


_part_cache: dict[str, str] = {}


def part_lemma(stem: str) -> str:
    """Lemma of the first part of a compound, e.g. "kooli" -> "kool"."""
    if stem not in _part_cache:
        t = Text(stem)
        t.tag_layer(["morph_analysis"])
        w = t.morph_analysis[0] if len(t.morph_analysis) else None
        _part_cache[stem] = (w.lemma[0] if w is not None and w.lemma else stem).lower()
    return _part_cache[stem]


def compound_parts(w, lemma: str) -> list[str] | None:
    """Lemmas of the parts of a compound ("koolikott" -> ["kool", "kott"]), or None."""
    roots = w.root_tokens[0] if w.root_tokens else None
    if not roots or len(roots) < 2:
        return None
    roots = [r.replace("=", "").replace("+", "").lower() for r in roots]
    head = "".join(roots[:-1])
    last = lemma[len(head):] if lemma.startswith(head) and len(lemma) > len(head) else roots[-1]
    return [part_lemma(r) for r in roots[:-1]] + [last]


def tokens_of(text: str) -> list[dict]:
    if not text.strip():
        return []
    t = Text(text)
    t.tag_layer(["morph_analysis"])
    out = []
    for w in t.morph_analysis:
        lemmas: list[str] = []
        pos = w.partofspeech[0] if w.partofspeech else ""
        for lemma, p in zip(w.lemma, w.partofspeech):
            lem = lemma if p == "H" else lemma.lower()
            if lem not in lemmas:
                lemmas.append(lem)
        tok = {"f": w.text, "l": None if pos == "Z" else (lemmas[0] if lemmas else None), "p": pos}
        if len(lemmas) > 1 and pos != "Z":
            tok["alt"] = lemmas[1:]
        if pos not in ("Z", "H") and lemmas:
            parts = compound_parts(w, lemmas[0])
            if parts:
                tok["parts"] = parts
        out.append(tok)
    return out


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def dump(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def law_units():
    """Yield (unit id, § id, chapter id, act, text) for every part and point of both acts."""
    for f in sorted(LAW_DIR.glob("*.json")):
        if f.name == "tokens.json":
            continue
        act = load(f)
        for pid, para in act["paragraphs"].items():
            for part in para["parts"]:
                if part["text"] and not part["repealed"]:
                    yield part["id"], pid, para["chapter"], act["act"], part["text"]
                for pt in part["points"]:
                    if pt["text"] and not pt["repealed"]:
                        yield pt["id"], pid, para["chapter"], act["act"], pt["text"]


def cmd_law() -> None:
    units = {}
    for uid, pid, chapter, act, text in law_units():
        units[uid] = {"para": pid, "chapter": chapter, "tokens": tokens_of(text)}
    dump(LAW_DIR / "tokens.json", units)
    print(f"content/law/tokens.json: {len(units)} units")


def area_of(pid: str, chapter: str) -> int | None:
    if pid.startswith("ps-"):
        return PS_AREA_BY_CHAPTER.get(chapter)
    m = re.match(r"kods-(\d+)", pid)
    return 4 if m and int(m.group(1)) <= KODS_EXAM_LAST else None


def lemma_set(tok: dict) -> set[str]:
    s = {tok["l"]} if tok.get("l") else set()
    s.update(tok.get("alt", []))
    return {x.lower() for x in s}


def occurs(seq: list[str], toks: list[dict]) -> bool:
    """A single lemma occurs anywhere; a multiword entry occurs when all its lemmas appear,
    in any order, within a window of len(seq) + 3 tokens (separable verbs: "kaebab ... edasi")."""
    sets = [lemma_set(t) for t in toks if t.get("p") != "Z"]
    if len(seq) == 1:
        return any(seq[0] in s for s in sets)
    width = len(seq) + 3
    for i in range(max(1, len(sets) - width + 1)):
        window = sets[i : i + width]
        if all(any(x in s for s in window) for x in seq):
            return True
    return False


def cmd_vocab() -> None:
    law = load(LAW_DIR / "tokens.json")
    base = load(BASE)
    level_of: dict[str, str] = {}
    for b in base["lemmas"]:
        key = b["lemma"].lower()
        if key not in level_of or b["level"] < level_of[key]:
            level_of[key] = b["level"]
    vocab = load(VOCAB)
    for e in vocab:
        # "käsitama, käsitlema": two alternative words in one entry; either one counts.
        variants = [v.strip() for v in e["lemma"].split(",")] if "alternatives" in e["tags"] and " " not in e["lemma"].replace(", ", ",") else [e["lemma"]]
        seqs = []
        for variant in variants:
            toks = [t for t in tokens_of(variant) if t.get("p") != "Z"]
            seq = [(t["l"] or t["f"]).lower() for t in toks]
            # A headword is a lemma already: keep it as printed when Vabamorf reads it as another word form.
            if len(toks) == 1 and seq[0] != variant.lower() and variant.lower() in lemma_set(toks[0]):
                seq = [variant.lower()]
            seqs.append(seq)
        seq = seqs[0]
        e["lemmas"] = seq
        e["level"] = level_of.get(seq[0]) if len(seq) == 1 else None
        refs: list[str] = []
        areas: set[int] = set()
        for unit in law.values():
            if any(occurs(s, unit["tokens"]) for s in seqs):
                if unit["para"] not in refs:
                    refs.append(unit["para"])
                a = area_of(unit["para"], unit["chapter"])
                if a:
                    areas.add(a)
        e["refs"] = refs
        e["areas"] = sorted(areas)
        e["kind"] = "general" if e["level"] else "legal"
    dump(VOCAB, vocab)
    found = sum(1 for e in vocab if e["refs"])
    print(f"{VOCAB.relative_to(ROOT)}: {len(vocab)} entries, {found} occur in the law texts")


def cmd_texts(ids: list[str]) -> None:
    for tid in ids:
        path = TEXTS / f"{tid}.json"
        text = load(path)
        for seg in text["segments"]:
            seg["tokens"] = tokens_of(seg["text"])
        dump(path, text)
        print(f"{path.relative_to(ROOT)}: {sum(len(s['tokens']) for s in text['segments'])} tokens")


def cmd_stdin() -> None:
    strings = json.load(sys.stdin)
    json.dump([tokens_of(s) for s in strings], sys.stdout, ensure_ascii=False)


def main() -> None:
    args = sys.argv[1:]
    if args[:1] == ["--law"]:
        cmd_law()
    elif args[:1] == ["--vocab"]:
        cmd_vocab()
    elif args[:1] == ["--texts"] and len(args) > 1:
        cmd_texts(args[1:])
    elif args[:1] == ["--stdin"]:
        cmd_stdin()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
