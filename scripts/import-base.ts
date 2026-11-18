// Imports the etLex A1, A2 and B1 lemma lists of the Eesti Keele Instituut (CC BY 4.0)
// into content/vocab/base.json (DESIGN.md 5.2). Run: pnpm import:base

import { writeFileSync } from 'node:fs';

const API = 'https://etlex.eki.ee/etLex/api/v1.0/projects/etLex/lemmas';
const LEVELS = ['A1', 'A2', 'B1'] as const;
// The API allows at most 500 per page. Its order is not stable across pages for homonyms,
// so pages can overlap: items are deduplicated by etLex id and the total is checked.
const PAGE = 500;

type Level = (typeof LEVELS)[number];

interface EtlexItem {
  id: number;
  lemma: string;
  ekilex_id: number | null;
  level: string;
  pos: string;
  pos_text: string;
  specification: string;
}

interface EtlexPage {
  items: EtlexItem[];
  total_count: number;
}

export interface BaseLemma {
  lemma: string;
  level: Level;
  /** Part of speech code of etLex, e.g. "S" (noun), "V" (verb). */
  pos: string;
  etlexId: number;
  ekilexId: number | null;
  /** etLex specification for homonyms; empty when none. */
  specification: string;
}

async function fetchLevel(level: Level): Promise<EtlexItem[]> {
  const byId = new Map<number, EtlexItem>();
  let total = Infinity;
  for (let offset = 0; offset < total; offset += PAGE) {
    const res = await fetch(`${API}?level=${level}&limit=${PAGE}&offset=${offset}`);
    if (!res.ok) throw new Error(`etLex ${level} offset ${offset}: HTTP ${res.status}`);
    const page = (await res.json()) as EtlexPage;
    total = page.total_count;
    for (const it of page.items) byId.set(it.id, it);
    if (page.items.length === 0) break;
  }
  if (byId.size !== total) {
    throw new Error(`etLex ${level}: got ${byId.size} distinct items, total_count is ${total}`);
  }
  return [...byId.values()].sort((a, b) => a.lemma.localeCompare(b.lemma, 'et') || a.id - b.id);
}

const lemmas: BaseLemma[] = [];
const counts: Record<string, number> = {};
for (const level of LEVELS) {
  const items = await fetchLevel(level);
  counts[level] = items.length;
  for (const it of items) {
    if (it.level !== level) throw new Error(`etLex: item ${it.id} has level ${it.level}, expected ${level}`);
    lemmas.push({
      lemma: it.lemma,
      level,
      pos: it.pos,
      etlexId: it.id,
      ekilexId: it.ekilex_id,
      specification: it.specification ?? '',
    });
  }
}

const out = {
  source: 'etLex, Eesti Keele Instituut (Sõnaveeb teacher tools)',
  licence: 'CC BY 4.0',
  url: API,
  fetchedAt: new Date().toISOString().slice(0, 10),
  counts,
  lemmas,
};
writeFileSync('content/vocab/base.json', JSON.stringify(out, null, 2) + '\n');
console.log(`content/vocab/base.json: ${lemmas.length} lemmas`, counts);
