// Home page list with reading progress (DESIGN.md 7.3): read marks and difficulty per text,
// a "continue" link to the first unread text, and filters so hard texts are easy to find for rereading.
import { useEffect, useState } from 'preact/hooks';
import { loadState, subscribe, type ReaderState } from '../lib/state';
import { RATING_LABELS } from './TextMarks';

export interface ListItem {
  id: string;
  title: string;
  href: string;
  /** Russian label of the text type. */
  kind: string;
  /** Cited §, in Estonian notation. */
  refs: string;
}

export interface ListGroup {
  title: string;
  items: ListItem[];
}

type Filter = 'all' | 'unread' | 'hard';

const FILTERS: Record<Filter, string> = {
  all: 'Все',
  unread: 'Непрочитанные',
  hard: 'Тяжёлые',
};

interface Props {
  groups: ListGroup[];
}

export default function TextList({ groups }: Props) {
  // Null until mounted, so the server render and the first client render match.
  const [state, setState] = useState<ReaderState | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    setState(loadState());
    return subscribe(setState);
  }, []);

  const marks = state?.texts ?? {};
  const all = groups.flatMap((g) => g.items);
  const readCount = all.filter((t) => marks[t.id]?.read).length;
  const hardCount = all.filter((t) => marks[t.id]?.rating === 'hard').length;
  const firstUnread = all.find((t) => !marks[t.id]?.read);

  const visible = (t: ListItem) =>
    filter === 'all' ||
    (filter === 'unread' && !marks[t.id]?.read) ||
    (filter === 'hard' && marks[t.id]?.rating === 'hard');

  return (
    <div class="text-list-wrap">
      {state && (
        <div class="progress">
          <p class="progress-line">
            Прочитано {readCount} из {all.length}
            {hardCount > 0 && <> · тяжёлых {hardCount}</>}
          </p>
          <progress max={all.length} value={readCount} aria-label="Прочитано текстов" />
          {firstUnread && (
            <a class="continue" href={firstUnread.href}>
              {readCount === 0 ? 'Начать' : 'Продолжить'}: текст {Number(firstUnread.id)} →
            </a>
          )}
          <div class="filters" role="group" aria-label="Показать">
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <button type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {FILTERS[f]}
              </button>
            ))}
          </div>
        </div>
      )}

      {groups.map((g) => {
        const items = g.items.filter(visible);
        if (items.length === 0) return null;
        return (
          <section>
            <h2>{g.title}</h2>
            <ol class="text-list">
              {items.map((t) => {
                const m = marks[t.id];
                return (
                  <li class={m?.read ? 'is-read' : undefined}>
                    <a href={t.href}>
                      <span class="num">{Number(t.id)}.</span> <span lang="et">{t.title}</span>
                    </a>
                    <span class="meta">
                      {m?.rating && <span class={`badge rating-${m.rating}`}>{RATING_LABELS[m.rating]}</span>}
                      {m?.read && !m.rating && <span class="badge">прочитано</span>}
                      {t.kind} · <span lang="et">{t.refs}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      {state && filter !== 'all' && !all.some(visible) && (
        <p class="empty">{filter === 'hard' ? 'Тяжёлых текстов пока нет.' : 'Все тексты прочитаны.'}</p>
      )}
    </div>
  );
}
