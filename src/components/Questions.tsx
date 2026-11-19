// Exam-format questions (DESIGN.md 2.2, 4.1 item 5): the reader picks an option, then sees whether it
// is right and the explanation with the §. Answers are saved in the browser and can be cleared.
import { useEffect, useState } from 'preact/hooks';
import { loadState, setAnswer, subscribe } from '../lib/state';
import type { Question } from '../lib/types';

interface Props {
  textId: string;
  questions: Question[];
  /** The task line per question type, already stripped from the question text. */
  tasks: string[];
  texts: string[];
}

const LETTERS = 'ABCDEFGH';

export default function Questions({ textId, questions, tasks, texts }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  useEffect(() => {
    setAnswers(loadState().answers?.[textId] ?? []);
    return subscribe((s) => setAnswers(s.answers?.[textId] ?? []));
  }, [textId]);

  const answeredCount = questions.filter((_, i) => answers[i] != null).length;
  const rightCount = questions.filter((q, i) => answers[i] === q.answer).length;

  return (
    <section class="questions">
      <h2>Вопросы</h2>
      {questions.map((q, qi) => {
        const chosen = answers[qi] ?? null;
        const done = chosen !== null;
        return (
          <div class="question" lang="et">
            <p class="task">{tasks[qi]}</p>
            <p class="q-text">{texts[qi]}</p>
            <ol class="options" role="list">
              {q.options.map((o, oi) => {
                const state = !done ? '' : oi === q.answer ? 'is-right' : oi === chosen ? 'is-wrong' : 'is-other';
                return (
                  <li>
                    <button
                      type="button"
                      class={`option ${state}`}
                      disabled={done}
                      aria-pressed={chosen === oi}
                      onClick={() => setAnswer(textId, qi, oi, questions.length)}
                    >
                      <span class="letter">{LETTERS[oi]}</span> {o}
                    </button>
                  </li>
                );
              })}
            </ol>
            {done && (
              <div class={`verdict ${chosen === q.answer ? 'is-right' : 'is-wrong'}`} aria-live="polite">
                <p class="verdict-line">
                  {chosen === q.answer ? 'Õige!' : `Vale. Õige vastus: ${LETTERS[q.answer]}.`}
                </p>
                <p>{q.explanation}</p>
              </div>
            )}
          </div>
        );
      })}
      {answeredCount > 0 && (
        <p class="q-summary">
          Правильно {rightCount} из {questions.length}.{' '}
          <button
            type="button"
            class="link-btn"
            onClick={() => questions.forEach((_, i) => setAnswer(textId, i, null, questions.length))}
          >
            Ответить заново
          </button>
        </p>
      )}
    </section>
  );
}
