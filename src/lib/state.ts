/**
 * Reader state in the browser (DESIGN.md 7.4).
 *
 * Everything lives under one localStorage key as versioned JSON. State refers to permanent text ids
 * only. Every read and write is wrapped in try/catch: without storage the site still works, marks
 * just last until the page closes. A version bump must add a migration in `migrate` and never wipe data.
 */

export const STORAGE_KEY = 'estonian-constitution-ci';
const VERSION = 1;

export type Rating = 'easy' | 'fine' | 'hard';
export const RATINGS: Rating[] = ['easy', 'fine', 'hard'];

export interface TextState {
  /** ISO date-time when the reader marked the text read. */
  read?: string;
  rating?: Rating;
}

export interface ReaderState {
  version: typeof VERSION;
  texts: Record<string, TextState>;
}

const CHANGE_EVENT = 'reader-state-change';

const empty = (): ReaderState => ({ version: VERSION, texts: {} });

// Kept in memory so marks survive within the page when storage throws.
let memory: ReaderState | null = null;

function migrate(raw: unknown): ReaderState {
  if (!raw || typeof raw !== 'object') return empty();
  const obj = raw as { version?: unknown; texts?: unknown };
  // Version 1 is the first one, so there is nothing to migrate yet. Later versions add their
  // steps here, in order, before the clean-up below.
  const texts: Record<string, TextState> = {};
  if (obj.texts && typeof obj.texts === 'object') {
    for (const [id, value] of Object.entries(obj.texts as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as TextState;
      const entry: TextState = {};
      if (typeof v.read === 'string') entry.read = v.read;
      if (v.rating && RATINGS.includes(v.rating)) entry.rating = v.rating;
      texts[id] = entry;
    }
  }
  // Unknown top-level fields from a newer build are kept, not dropped.
  return { ...(obj as object), version: VERSION, texts } as ReaderState;
}

export function loadState(): ReaderState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) memory = migrate(JSON.parse(raw));
  } catch {
    // Storage blocked or the JSON is broken: fall back to memory and never overwrite what is stored.
  }
  return memory ?? empty();
}

function saveState(state: ReaderState): void {
  memory = state;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or full storage: the mark lives until the page closes.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function updateText(id: string, change: (prev: TextState) => TextState): ReaderState {
  const state = loadState();
  const next = change(state.texts[id] ?? {});
  const texts = { ...state.texts };
  if (next.read || next.rating) texts[id] = next;
  else delete texts[id];
  const updated = { ...state, texts };
  saveState(updated);
  return updated;
}

/** Calls `listener` when state changes on this page or in another tab. Returns the unsubscribe function. */
export function subscribe(listener: (state: ReaderState) => void): () => void {
  const onChange = () => listener(loadState());
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
