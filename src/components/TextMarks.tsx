// The "read" mark and the difficulty rating under a text (DESIGN.md 4.1 item 6).
// Rating a text also marks it read; unmarking "read" keeps the rating.
import { useEffect, useState } from 'preact/hooks';
import { loadState, RATINGS, subscribe, updateText, type Rating, type TextState } from '../lib/state';

export const RATING_LABELS: Record<Rating, string> = {
  easy: 'легко',
  fine: 'нормально',
  hard: 'тяжело',
};

interface Props {
  id: string;
}

export default function TextMarks({ id }: Props) {
  // Empty on the server and on first render, so hydration matches; the stored state arrives in the effect.
  const [mark, setMark] = useState<TextState>({});
  useEffect(() => {
    setMark(loadState().texts[id] ?? {});
    return subscribe((s) => setMark(s.texts[id] ?? {}));
  }, [id]);

  const now = () => new Date().toISOString();
  const toggleRead = () =>
    updateText(id, (prev) => ({ ...prev, read: prev.read ? undefined : now() }));
  const rate = (rating: Rating) =>
    updateText(id, (prev) => ({
      read: prev.read ?? now(),
      rating: prev.rating === rating ? undefined : rating,
    }));

  return (
    <section class="marks" aria-label="Отметки">
      <label class="read-mark">
        <input type="checkbox" checked={Boolean(mark.read)} onChange={toggleRead} />
        Прочитано
      </label>
      <div class="rating" role="group" aria-label="Насколько трудно было">
        <span class="rating-label">Как было?</span>
        {RATINGS.map((r) => (
          <button
            type="button"
            class={`rating-btn rating-${r}`}
            aria-pressed={mark.rating === r}
            onClick={() => rate(r)}
          >
            {RATING_LABELS[r]}
          </button>
        ))}
      </div>
    </section>
  );
}
