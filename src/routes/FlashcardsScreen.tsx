// src/routes/FlashcardsScreen.tsx
// Propósito: sesión de estudio con tarjetas. Muestra 20 preguntas priorizadas por
// `buildStudyQueue`, el usuario revela la respuesta y se autoevalúa ("Ya lo sabía" /
// "Necesito repasar"). Al terminar, las falladas se re-encolan UNA vez en un repaso intensivo
// y después se muestra el resumen de la sesión.
//
// El estado de la sesión vive en un `useReducer` puro: el único efecto secundario (registrar
// la respuesta en el store) se hace en el manejador del evento, no en el reducer, porque React
// en modo estricto invoca los reducers dos veces para detectar impurezas.
import { useMemo, useReducer, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import OfficialAnswerCard from '@/components/OfficialAnswerCard';
import { useConfirm } from '@/components/ConfirmDialog';
import CategoryBadge from '@/components/CategoryBadge';
import SessionReview from '@/components/SessionReview';
import type { SessionReviewItem } from '@/components/SessionReview';
import SpeakerButton from '@/components/SpeakerButton';
import ProgressBar from '@/components/ProgressBar';
import { FLASHCARD_SESSION_SIZE } from '@/constants';
import { selectUserProgress, useStore } from '@/store/useStore';
import { CATEGORY_ORDER } from '@/utils/categories';
import { QUESTIONS } from '@/utils/content';
import { buildStudyQueue } from '@/utils/spacedRepetition';
import type { Category, Question } from '@/types';

type Phase = 'primary' | 'intensive' | 'done';

type SessionState = {
  phase: Phase;
  /** Preguntas de la primera vuelta (el repaso intensivo sale de aquí). */
  primaryQueue: Question[];
  /** Preguntas de la vuelta actual. */
  queue: Question[];
  index: number;
  revealed: boolean;
  /** Resultado final por pregunta (la última respuesta manda). */
  results: Record<string, boolean>;
  /** Ids únicos en orden de aparición (orden del repaso final). */
  order: string[];
  /** Pregunta por id, para el repaso final. */
  byId: Record<string, Question>;
};

type SessionAction = { type: 'reveal' } | { type: 'answer'; wasCorrect: boolean } | { type: 'start'; queue: Question[] };

/** Sesión nueva a partir de una cola. */
function emptySession(queue: Question[]): SessionState {
  return {
    phase: queue.length === 0 ? 'done' : 'primary',
    primaryQueue: queue,
    queue,
    index: 0,
    revealed: false,
    results: {},
    order: [],
    byId: {},
  };
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  if (action.type === 'start') {
    return emptySession(action.queue);
  }

  if (action.type === 'reveal') {
    return { ...state, revealed: true };
  }

  const question = state.queue[state.index];

  if (question === undefined) {
    return state;
  }

  const results = { ...state.results, [question.id]: action.wasCorrect };
  const order = state.order.includes(question.id) ? state.order : [...state.order, question.id];
  const byId = { ...state.byId, [question.id]: question };

  if (state.index + 1 < state.queue.length) {
    return { ...state, results, order, byId, index: state.index + 1, revealed: false };
  }

  // Se terminó la vuelta. En la primera, las falladas pasan a un repaso intensivo.
  if (state.phase === 'primary') {
    const failed = state.primaryQueue.filter((item) => results[item.id] === false);

    if (failed.length > 0) {
      return {
        ...state,
        results,
        order,
        byId,
        phase: 'intensive',
        queue: failed,
        index: 0,
        revealed: false,
      };
    }
  }

  return { ...state, results, order, byId, phase: 'done' };
}

/** Filtros de la sesión, que llegan por la URL desde la pantalla de practicar. */
type SessionConfig = {
  limit: number;
  category?: Category;
  only65_20?: boolean;
  onlyPending?: boolean;
  /** Texto que se enseña en el contador, para saber qué modo está activo. */
  mode: string;
};

/** Lee los filtros de la URL (`/flashcards?only65=1`, `?onlyFailed=1`, `?category=…`). */
export function readSessionConfig(params: URLSearchParams): SessionConfig {
  const category = params.get('category');

  if (params.get('only65') === '1') {
    return { limit: FLASHCARD_SESSION_SIZE, only65_20: true, mode: 'Exención 65/20' };
  }

  if (params.get('onlyFailed') === '1') {
    return { limit: FLASHCARD_SESSION_SIZE, onlyPending: true, mode: 'Solo las falladas' };
  }

  if (category !== null && (CATEGORY_ORDER as string[]).includes(category)) {
    return { limit: FLASHCARD_SESSION_SIZE, category: category as Category, mode: category };
  }

  return { limit: FLASHCARD_SESSION_SIZE, mode: 'Sesión de estudio' };
}

/** Cola de una sesión nueva, calculada con el progreso actual del store. */
function buildSessionQueue(config: SessionConfig): Question[] {
  return buildStudyQueue(QUESTIONS, selectUserProgress(useStore.getState()), {
    limit: config.limit,
    category: config.category,
    only65_20: config.only65_20,
    onlyPending: config.onlyPending,
  });
}

/**
 * Al cambiar los filtros de la URL (`key`) se monta una sesión nueva desde cero. Sin la `key`, ir de
 * una categoría a otra no reiniciaría la sesión, porque React reutiliza el mismo componente.
 */
export default function FlashcardsScreen() {
  const [searchParams] = useSearchParams();
  const params = searchParams.toString();

  return <StudySession key={params} params={params} />;
}

function StudySession({ params }: { params: string }) {
  const config = useMemo(() => readSessionConfig(new URLSearchParams(params)), [params]);
  const recordAnswer = useStore((state) => state.recordAnswer);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => emptySession(buildSessionQueue(config)));
  const [showVocabulary, setShowVocabulary] = useState(false);

  const handleExit = async () => {
    // Solo se confirma si ya se ha respondido algo: al inicio de la sesión no hay nada que perder.
    if (state.order.length > 0) {
      const accepted = await confirm({
        title: 'Salir de la sesión',
        message: 'Se perderá el avance de este repaso. Tu XP y tu racha ya quedan guardados.',
        confirmLabel: 'Salir',
        cancelLabel: 'Seguir repasando',
      });

      if (!accepted) {
        return;
      }
    }

    navigate('/');
  };

  const handleAnswer = (wasCorrect: boolean) => {
    const question = state.queue[state.index];

    if (question === undefined) {
      return;
    }

    recordAnswer(question.id, wasCorrect);
    dispatch({ type: 'answer', wasCorrect });
  };

  const handleReveal = () => {
    dispatch({ type: 'reveal' });
  };

  const handleNewSession = () => {
    setShowVocabulary(false);
    dispatch({ type: 'start', queue: buildSessionQueue(config) });
  };

  // Modo «solo las falladas» sin fallos (o filtro sin preguntas): se explica en vez de dejar al
  // usuario en una pantalla vacía.
  if (state.primaryQueue.length === 0) {
    return (
      <div className="page">
        <section className="card settings-section">
          <h2 className="settings-title">{config.mode}</h2>
          <p className="settings-hint">
            No hay preguntas para este repaso. Si has elegido «solo las falladas», significa que no
            tienes ninguna pendiente: ¡buena señal! Prueba con otro modo o sigue estudiando.
          </p>
        </section>

        <div className="btn-row">
          <Link to="/practice" className="btn btn--primary">
            Ver otras formas de practicar
          </Link>
          <Link to="/flashcards" className="btn btn--secondary">
            Sesión de estudio normal
          </Link>
        </div>
      </div>
    );
  }

  if (state.phase === 'done') {
    const entries: SessionReviewItem[] = state.order
      .map((id) => state.byId[id])
      .filter((question): question is Question => question !== undefined)
      .map((question) => ({ question, wasCorrect: state.results[question.id] === true }));

    return (
      <div className="page">
        <SessionReview items={entries} title="Resumen de la sesión" />
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={handleNewSession}>
            Empezar otra sesión
          </button>
          <Link to="/" className="btn btn--secondary">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const question = state.queue[state.index];

  if (question === undefined) {
    return null;
  }

  const total = state.queue.length;
  const progress = total > 0 ? state.index / total : 0;

  return (
    <div className="page">
      <div className="topbar">
        <span className="topbar__counter">
          {state.phase === 'intensive' ? 'Repaso' : 'Pregunta'} {state.index + 1} de {total}
        </span>
        <button type="button" className="btn btn--ghost" onClick={() => void handleExit()}>
          Salir
        </button>
      </div>

      {config.mode !== 'Sesión de estudio' && (
        <p className="reinforcement-note">Modo: {config.mode}</p>
      )}

      <ProgressBar value={progress} label="Progreso de la sesión" />

      {state.phase === 'intensive' && (
        <p className="reinforcement-note">
          Estás repasando las preguntas que marcaste como pendientes.
        </p>
      )}

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <CategoryBadge category={question.category} />

        <div className="question-head">
          <h1 className="question-head__text">{question.question_en}</h1>
          <SpeakerButton text={question.question_en} compact label="Escuchar la pregunta" />
        </div>

        <p className="answer-single-es">{question.question_es}</p>

        {!state.revealed ? (
          <button type="button" className="btn btn--primary" onClick={handleReveal}>
            Mostrar respuesta
          </button>
        ) : (
          <>
            {question.answers_en.length > 0 ? (
              <ul className="answer-list">
                {question.answers_en.map((answer, index) => (
                  <li key={answer} className="answer-row">
                    <div className="answer-en">
                      {answer}
                      {question.answers_es[index] !== undefined && question.answers_es[index] !== answer && (
                        <span className="answer-pair__es">{question.answers_es[index]}</span>
                      )}
                    </div>
                    <SpeakerButton text={answer} compact label={`Escuchar: ${answer}`} />
                  </li>
                ))}
              </ul>
            ) : (
              <OfficialAnswerCard question={question} />
            )}

            {question.explanation_es.trim().length > 0 && (
              <p className="explanation">{question.explanation_es}</p>
            )}

            {question.vocabulary.length > 0 && (
              <>
                <button
                  type="button"
                  className="expand-button"
                  aria-expanded={showVocabulary}
                  onClick={() => setShowVocabulary((current) => !current)}
                >
                  {showVocabulary ? 'Ocultar vocabulario' : `Ver vocabulario (${question.vocabulary.length})`}
                </button>

                {showVocabulary && (
                  <ul className="vocabulary">
                    {question.vocabulary.map((item) => (
                      <li key={item.word} className="vocabulary__row">
                        <span className="vocabulary__word">{item.word}</span>
                        <span className="vocabulary__translation">{item.translation}</span>
                        <SpeakerButton text={item.word} compact label={`Escuchar: ${item.word}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            <div className="answer-actions">
              <button type="button" className="btn btn--review" onClick={() => handleAnswer(false)}>
                Necesito repasar
              </button>
              <button type="button" className="btn btn--knew" onClick={() => handleAnswer(true)}>
                Ya lo sabía
              </button>
            </div>

            <p className="reinforcement-note">
              Sé sincero: si dudas, márcala como pendiente y volverá a aparecer.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
