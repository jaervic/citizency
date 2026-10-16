// src/routes/QuizScreen.tsx
// Propósito: examen de práctica de 20 preguntas tipo test. Las opciones salen del banco
// curado de distractores (`buildQuizOptions`), así que los distractores son plausibles pero
// claramente incorrectos (antes se generaban por heurística y salían opciones sin sentido).
// Se aprueba con 12 de 20. Al final hay repaso de todas las preguntas.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AnswerFeedback from '@/components/AnswerFeedback';
import CategoryBadge from '@/components/CategoryBadge';
import { useConfirm } from '@/components/ConfirmDialog';
import ProgressRing from '@/components/ProgressRing';
import SessionReview from '@/components/SessionReview';
import type { SessionReviewItem } from '@/components/SessionReview';
import SpeakerButton from '@/components/SpeakerButton';
import ProgressBar from '@/components/ProgressBar';
import { PASS_THRESHOLD, QUIZ_SIZE } from '@/constants';
import { selectLocation, useStore } from '@/store/useStore';
import { buildQuizPool } from '@/utils/content';
import { buildQuizOptions } from '@/utils/quizOptions';
import type { QuizOption } from '@/utils/quizOptions';
import type { Question } from '@/types';

type QuizItem = {
  question: Question;
  options: QuizOption[];
};

/** Letras de las opciones (como en el examen real, que las marca A, B, C…). */
const LETTERS = ['A', 'B', 'C', 'D'];

/** Copia mezclada de un array (Fisher-Yates). */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = current;
  }

  return result;
}

/**
 * Arma el examen: se eligen 20 preguntas al azar (no las 20 de mayor prioridad, que serían casi
 * siempre las mismas preguntas nuevas) y se construyen sus opciones.
 *
 * El grupo de preguntas se calcula con el estado/distrito que el usuario tenga configurado en ese
 * momento, así que si los ha elegido también entran las 4 preguntas que dependen de ellos.
 */
function buildQuiz(): QuizItem[] {
  const location = selectLocation(useStore.getState());
  const pool = buildQuizPool(location);

  return shuffle(pool)
    .slice(0, QUIZ_SIZE)
    .map((question) => ({ question, options: buildQuizOptions({ question, quizPool: pool, location }) }));
}

export default function QuizScreen() {
  const recordAnswer = useStore((state) => state.recordAnswer);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [items, setItems] = useState<QuizItem[]>(buildQuiz);
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);

  const item = items[index];

  const handleCheck = () => {
    if (item === undefined || selectedId === null || checked) {
      return;
    }

    const selected = item.options.find((option) => option.id === selectedId);
    const wasCorrect = selected?.isCorrect === true;

    recordAnswer(item.question.id, wasCorrect);
    setResults((current) => ({ ...current, [item.question.id]: wasCorrect }));
    setChecked(true);
  };

  const handleNext = () => {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setSelectedId(null);
      setChecked(false);
      return;
    }

    setFinished(true);
  };

  const handleRetry = () => {
    setItems(buildQuiz());
    setIndex(0);
    setSelectedId(null);
    setChecked(false);
    setResults({});
    setFinished(false);
  };

  const handleExit = async () => {
    // Solo se confirma si el examen ya empezó.
    if (index > 0 && !finished) {
      const accepted = await confirm({
        title: 'Salir del examen',
        message: 'Se perderán las respuestas de este examen. Tu XP y tu racha ya quedan guardados.',
        confirmLabel: 'Salir',
        cancelLabel: 'Seguir con el examen',
      });

      if (!accepted) {
        return;
      }
    }

    navigate('/');
  };

  if (finished || item === undefined) {
    const correctCount = items.filter((entry) => results[entry.question.id] === true).length;
    const total = items.length;
    const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = correctCount >= PASS_THRESHOLD;

    const entries: SessionReviewItem[] = items.map((entry) => ({
      question: entry.question,
      wasCorrect: results[entry.question.id] === true,
    }));

    return (
      <div className="page">
        <section className="card result-card">
          <ProgressRing
            value={percentage / 100}
            size={132}
            stroke={12}
            color={passed ? 'var(--color-success)' : 'var(--color-error)'}
            label="Resultado del examen"
          >
            <span className="ring__value ring__value--big">{percentage}%</span>
            <span className="ring__label">
              {correctCount}/{total}
            </span>
          </ProgressRing>

          <span className={`result-badge result-badge--${passed ? 'passed' : 'failed'}`}>
            {passed ? 'Aprobado' : 'No aprobado'}
          </span>

          <p className="result-note">
            Se aprueba con {PASS_THRESHOLD} de {total} ({Math.round((PASS_THRESHOLD / total) * 100)} %), igual
            que en el examen real.
          </p>
        </section>

        <SessionReview items={entries} title="Repaso del examen" showSummary={false} />

        <div className="results-actions">
          <button type="button" className="btn btn--primary" onClick={handleRetry}>
            Hacer otro examen
          </button>
          <Link to="/" className="btn btn--secondary">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const selected = item.options.find((option) => option.id === selectedId);

  return (
    <div className="page">
      <div className="topbar">
        <span className="topbar__counter">
          Pregunta {index + 1} de {items.length}
        </span>
        <button type="button" className="btn btn--ghost" onClick={() => void handleExit()}>
          Salir
        </button>
      </div>

      <ProgressBar value={index / items.length} label="Progreso del examen" />

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CategoryBadge category={item.question.category} />

        <div className="question-head">
          <h1 className="question-head__text">{item.question.question_en}</h1>
          <SpeakerButton text={item.question.question_en} compact label="Escuchar la pregunta" />
        </div>

        <p className="answer-single-es">{item.question.question_es}</p>

        <div className="quiz-options" role="radiogroup" aria-label="Opciones de respuesta">
          {item.options.map((option, optionIndex) => {
            const isSelected = option.id === selectedId;
            const state = checked
              ? option.isCorrect
                ? 'correct'
                : isSelected
                  ? 'wrong'
                  : 'muted'
              : isSelected
                ? 'selected'
                : 'idle';

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`quiz-option quiz-option--${state}`}
                disabled={checked}
                onClick={() => setSelectedId(option.id)}
              >
                <span className="quiz-option__letter" aria-hidden="true">
                  {LETTERS[optionIndex]}
                </span>
                <span className="quiz-option__text">
                  <span className="quiz-option__en">{option.en}</span>
                  {option.es !== option.en && <span className="quiz-option__es">{option.es}</span>}
                </span>
              </button>
            );
          })}
        </div>

        {!checked ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleCheck}
            disabled={selectedId === null}
          >
            Comprobar respuesta
          </button>
        ) : (
          <>
            <AnswerFeedback
              question={item.question}
              wasCorrect={selected?.isCorrect === true}
              userAnswer={selected?.en}
            />
            <button type="button" className="btn btn--primary" onClick={handleNext}>
              {index + 1 < items.length ? 'Siguiente pregunta' : 'Ver resultados'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
