// src/components/SessionReview.tsx
// Propósito: repaso de una sesión terminada (flashcards, quiz o entrevista). Antes solo
// mostraba `answers_en[0]` como respuesta correcta; ahora lista TODAS las respuestas aceptadas
// (en inglés y español), que es lo que el USCIS admite de verdad.
import { useMemo, useState } from 'react';

import OfficialAnswerCard from '@/components/OfficialAnswerCard';
import SpeakerButton from '@/components/SpeakerButton';
import type { Question } from '@/types';

export type SessionReviewItem = {
  question: Question;
  wasCorrect: boolean;
  /** Respuesta del usuario, si la hubo (quiz o entrevista). */
  userAnswer?: string;
};

type Filter = 'all' | 'incorrect' | 'correct';

type SessionReviewProps = {
  items: SessionReviewItem[];
  /** Título del bloque de repaso. */
  title?: string;
};

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Todas',
  incorrect: 'Falladas',
  correct: 'Acertadas',
};

export default function SessionReview({ items, title = 'Repaso de la sesión' }: SessionReviewProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const correctCount = items.filter((item) => item.wasCorrect).length;
  const total = items.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const visibleItems = useMemo(() => {
    if (filter === 'incorrect') {
      return items.filter((item) => !item.wasCorrect);
    }

    if (filter === 'correct') {
      return items.filter((item) => item.wasCorrect);
    }

    return items;
  }, [filter, items]);

  const toggle = (questionId: string) => {
    setExpandedIds((current) => ({ ...current, [questionId]: !current[questionId] }));
  };

  if (total === 0) {
    return (
      <section className="review">
        <h2 className="progress-card__title">{title}</h2>
        <p className="review-empty">No hay preguntas que repasar en esta sesión.</p>
      </section>
    );
  }

  return (
    <section className="review">
      <h2 className="progress-card__title">{title}</h2>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p className="session-score">
          Resultado: {correctCount} de {total} correctas
        </p>
        <p className="session-percentage">{percentage} %</p>
      </div>

      <div className="review-filters" role="group" aria-label="Filtrar preguntas">
        {(Object.keys(FILTER_LABELS) as Filter[]).map((option) => (
          <button
            key={option}
            type="button"
            className="review-filter"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {FILTER_LABELS[option]}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <p className="review-empty">No hay preguntas con este filtro.</p>
      ) : (
        <ul className="answer-list">
          {visibleItems.map((item, index) => {
            const expanded = expandedIds[item.question.id] === true;

            return (
              <li key={item.question.id} className="review-item">
                <div className="review-item__row">
                  <button
                    type="button"
                    className="review-item__header"
                    aria-expanded={expanded}
                    onClick={() => toggle(item.question.id)}
                  >
                    <span className="review-item__number">{index + 1}</span>
                    <span className="review-item__question">{item.question.question_es}</span>
                    <span className="review-item__chevron" aria-hidden="true">
                      {expanded ? '▲' : '▼'}
                    </span>
                  </button>
                  <span
                    className={
                      item.wasCorrect ? 'review-item__mark--correct' : 'review-item__mark--wrong'
                    }
                    aria-label={item.wasCorrect ? 'Correcta' : 'Fallada'}
                  >
                    {item.wasCorrect ? '✓' : '✗'}
                  </span>
                </div>

                {expanded && (
                  <div className="review-item__details">
                    {item.userAnswer !== undefined && !item.wasCorrect && (
                      <p className="review-item__user-choice">
                        <span className="review-item__label">Tu respuesta: </span>
                        {item.userAnswer}
                      </p>
                    )}

                    {item.question.answers_en.length > 0 ? (
                      <div className="review-item__correct-list">
                        <span className="review-item__label">
                          {item.question.answers_en.length === 1
                            ? 'Respuesta correcta'
                            : 'Respuestas correctas'}
                        </span>
                        {item.question.answers_en.map((answer, answerIndex) => (
                          <div key={answer} className="review-item__row">
                            <span className="review-item__correct">
                              {answer}
                              {item.question.answers_es[answerIndex] !== undefined &&
                                item.question.answers_es[answerIndex] !== answer && (
                                  <span className="answer-pair__es">
                                    {item.question.answers_es[answerIndex]}
                                  </span>
                                )}
                            </span>
                            <SpeakerButton text={answer} compact label={`Escuchar: ${answer}`} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <OfficialAnswerCard question={item.question} />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
