// src/routes/QuizScreen.tsx
// Propósito: examen de práctica tipo test. Las opciones salen del banco curado de distractores
// (`buildQuizOptions`), así que son plausibles pero claramente incorrectas.
//
// Dos formatos, elegidos por la URL:
//   - `/quiz` (por defecto): 20 preguntas, se aprueba con 12 y se corrige al momento.
//   - `/quiz?count=10&feedback=final`: el SIMULACRO REAL. El examen de la entrevista son hasta 10
//     preguntas y se aprueba con 6, sin saber el resultado hasta el final. Además se corta en cuanto
//     el resultado ya no puede cambiar, como hace el oficial.
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import AnswerFeedback from '@/components/AnswerFeedback';
import CategoryBadge from '@/components/CategoryBadge';
import { useConfirm } from '@/components/ConfirmDialog';
import ProgressRing from '@/components/ProgressRing';
import SessionReview from '@/components/SessionReview';
import type { SessionReviewItem } from '@/components/SessionReview';
import SpeakerButton from '@/components/SpeakerButton';
import ProgressBar from '@/components/ProgressBar';
import { QUIZ_SIZE } from '@/constants';
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

/** Configuración del examen, que llega por la URL. */
type QuizConfig = {
  /** Número de preguntas (20 por defecto; 10 en el simulacro real). */
  count: number;
  /** Aciertos necesarios para aprobar (12 de 20, 6 de 10: el 60 %). */
  passThreshold: number;
  /** `instant`: se corrige cada pregunta. `final`: solo al terminar (simulacro real). */
  feedback: 'instant' | 'final';
  /** Solo las 20 preguntas de la exención 65/20. */
  only65_20: boolean;
  /** Texto que se enseña en la cabecera. */
  mode: string;
};

/** Lee la configuración del examen desde la URL. */
export function readQuizConfig(params: URLSearchParams): QuizConfig {
  const count = Number(params.get('count') ?? QUIZ_SIZE);
  const preguntas = Number.isFinite(count) && count > 0 ? Math.min(128, Math.floor(count)) : QUIZ_SIZE;
  const feedback = params.get('feedback') === 'final' ? 'final' : 'instant';
  const only65_20 = params.get('only65') === '1';

  return {
    count: preguntas,
    passThreshold: Math.ceil(preguntas * 0.6),
    feedback,
    only65_20,
    mode: feedback === 'final' ? 'Simulacro real' : 'Examen de práctica',
  };
}

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
 * Arma el examen: se eligen las preguntas al azar (no las de mayor prioridad, que serían casi
 * siempre las mismas) y se construyen sus opciones.
 */
function buildQuiz(config: QuizConfig): QuizItem[] {
  const location = selectLocation(useStore.getState());
  const pool = buildQuizPool(location).filter(
    (question) => !config.only65_20 || question.is_65_20,
  );

  return shuffle(pool)
    .slice(0, config.count)
    .map((question) => ({ question, options: buildQuizOptions({ question, quizPool: pool, location }) }));
}

/** Al cambiar la configuración de la URL se monta un examen nuevo desde cero. */
export default function QuizScreen() {
  const [searchParams] = useSearchParams();
  const params = searchParams.toString();

  return <QuizSession key={params} params={params} />;
}

function QuizSession({ params }: { params: string }) {
  const config = useMemo(() => readQuizConfig(new URLSearchParams(params)), [params]);
  const recordAnswer = useStore((state) => state.recordAnswer);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [items, setItems] = useState<QuizItem[]>(() => buildQuiz(config));
  const [index, setIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);

  const item = items[index];

  /** Registra la respuesta actual y devuelve si fue correcta. */
  const registrar = (): boolean => {
    const wasCorrect = item?.options.find((option) => option.id === selectedId)?.isCorrect === true;

    if (item !== undefined) {
      recordAnswer(item.question.id, wasCorrect);
      setResults((current) => ({ ...current, [item.question.id]: wasCorrect }));
    }

    return wasCorrect;
  };

  /** Modo con corrección inmediata: comprobar la pregunta actual. */
  const handleCheck = () => {
    if (item === undefined || selectedId === null || checked) {
      return;
    }

    registrar();
    setChecked(true);
  };

  /** Modo con corrección inmediata: pasar a la siguiente. */
  const handleNext = () => {
    if (index + 1 < items.length) {
      setIndex(index + 1);
      setSelectedId(null);
      setChecked(false);
      return;
    }

    setFinished(true);
  };

  /** Simulacro real: se registra sin corregir y se corta si el resultado ya no puede cambiar. */
  const handleFinalAnswer = () => {
    if (item === undefined || selectedId === null) {
      return;
    }

    const wasCorrect = registrar();
    const aciertos = Object.values(results).filter(Boolean).length + (wasCorrect ? 1 : 0);
    const respondidas = Object.keys(results).length + 1;
    const restantes = items.length - respondidas;

    // El resultado está decidido: ya ha aprobado o ya no puede llegar a los aciertos necesarios.
    const decidido = aciertos >= config.passThreshold || aciertos + restantes < config.passThreshold;

    if (decidido || respondidas >= items.length) {
      setFinished(true);
      return;
    }

    setIndex(index + 1);
    setSelectedId(null);
  };

  const handleRetry = () => {
    setItems(buildQuiz(config));
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
    const passed = correctCount >= config.passThreshold;

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
            {config.mode}: hay que acertar {config.passThreshold} de {total} (
            {Math.round((config.passThreshold / total) * 100)} %), igual que en el examen real.
            {config.feedback === 'final' && ' El examen se detuvo en cuanto se decidió el resultado.'}
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
  const esSimulacro = config.feedback === 'final';
  const puedeAvanzar = selectedId !== null;

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

      {esSimulacro && (
        <p className="reinforcement-note">
          Modo simulacro: no sabrás si acertaste hasta el final.
        </p>
      )}

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
            // En el simulacro no se colorea nada hasta el final: no hay corrección por pregunta.
            const state = !checked
              ? isSelected
                ? 'selected'
                : 'idle'
              : option.isCorrect
                ? 'correct'
                : isSelected
                  ? 'wrong'
                  : 'muted';

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

        {esSimulacro ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleFinalAnswer}
            disabled={!puedeAvanzar}
          >
            {index + 1 < items.length ? 'Siguiente pregunta' : 'Ver resultado'}
          </button>
        ) : !checked ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleCheck}
            disabled={!puedeAvanzar}
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
