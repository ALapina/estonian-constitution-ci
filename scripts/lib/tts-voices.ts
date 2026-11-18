// Sentences of the voice samples page (DESIGN.md 4.3 and 7.3): one short line in simple A1
// Estonian per character. Characters without a name introduce themselves without one; the
// narrator and the law voice say a neutral sentence. The author may change any of them.

import type { Character } from '../../src/lib/types.ts';

const SENTENCES: Record<string, string> = {
  narrator: 'Täna on esmaspäev. Ilm on ilus ja päike paistab.',
  law: 'Eesti riigikeel on eesti keel. Riigikogus on 101 liiget.',
  olga: 'Tere! Mina olen Olga. Ma olen medõde.',
  sergei: 'Tere! Mina olen Sergei. Ma olen autojuht.',
  lisa: 'Tere! Mina olen Lisa. Ma käin koolis.',
  nikolai: 'Tere! Mina olen Nikolai. Ma olen Olga isa.',
  'neighbour-mari': 'Tere! Mina olen Mari. Ma olen jurist.',
  jaan: 'Tere! Mina olen Jaan. Ma töötan Riigikogus.',
  'couple-husband': 'Tere! Ma olen pärit Venemaalt. Minu vanaisa elas Eestis.',
  'couple-wife': 'Tere! Ma elan Eestis koos mehega. Ma õpin eesti keelt.',
};

/** The sample sentence of a character; `fallback` is true for a character added after this list. */
export function sampleSentence(id: string, character: Character): { sentence: string; fallback: boolean } {
  const sentence = SENTENCES[id];
  if (sentence) return { sentence, fallback: false };
  return { sentence: character.name ? `Tere! Mina olen ${character.name}.` : 'Tere! Kuidas läheb?', fallback: true };
}

/** One entry of public/audio/voices/index.json. */
export interface VoiceSample {
  /** Character id, a key of content/characters.json. */
  id: string;
  name: string | null;
  voice: string;
  sentence: string;
  /** Path of the MP3 under public/, e.g. "audio/voices/olga.mp3". */
  file: string;
}
