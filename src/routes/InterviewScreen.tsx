// src/routes/InterviewScreen.tsx
// Propósito: simulacro de la entrevista del USCIS. Se hacen 5 preguntas al azar, el usuario
// responde en voz alta (Web Speech API) o escribiendo, y la app corrige con tolerancia
// (`fuzzyMatch`) porque el reconocimiento nunca devuelve el texto exacto.
//
// Degradación: si el navegador no soporta reconocimiento de voz (Firefox) o no hay permiso de
// micrófono, se puede escribir la respuesta a mano igualmente.
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import AnswerFeedback from '@/components/AnswerFeedback';
import { useConfirm } from '@/components/ConfirmDialog';
import Icon from '@/components/Icon';
import SessionReview from '@/components/SessionReview';
import type { SessionReviewItem } from '@/components/SessionReview';
import SpeakerButton from '@/components/SpeakerButton';
import ProgressBar from '@/components/ProgressBar';
import { INTERVIEW_MATCH_THRESHOLD, INTERVIEW_SIZE } from '@/constants';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { selectLocation, useStore } from '@/store/useStore';
import { OFFICIAL_DATA, QUESTIONS, getAcceptedAnswers } from '@/utils/content';
import { fuzzyMatch } from '@/utils/fuzzyMatch';
import type { Question } from '@/types';

type Feedback = {
  matched: boolean;
  score: number;
  bestGuess: string;
};

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
 * Elige las 5 preguntas del simulacro entre las que se pueden corregir con el estado y el
 * distrito configurados: las 120 estáticas y, si el usuario los ha elegido, las estatales.
 */
function buildInterviewQuestions(): Question[] {
  const location = selectLocation(useStore.getState());

  const pool = QUESTIONS.filter(
    (question) => getAcceptedAnswers(question, OFFICIAL_DATA, location).length > 0,
  );

  return shuffle(pool).slice(0, INTERVIEW_SIZE);
}

export default function InterviewScreen() {
  const recordAnswer = useStore((state) => state.recordAnswer);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [questions, setQuestions] = useState<Question[]>(buildInterviewQuestions);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [finished, setFinished] = useState(false);

  const speech = useSpeechRecognition('en-US');
  const { transcript, clear: clearSpeech } = speech;

  // Mientras se escucha, lo reconocido rellena el área de texto (que el usuario puede editar).
  useEffect(() => {
    if (transcript.length > 0) {
      setText(transcript);
    }
  }, [transcript]);

  const question = questions[index];

  const handleCheck = () => {
    if (question === undefined || feedback !== null) {
      return;
    }

    const accepted = getAcceptedAnswers(question, OFFICIAL_DATA, selectLocation(useStore.getState()));
    const result = fuzzyMatch(text, accepted, INTERVIEW_MATCH_THRESHOLD);

    setFeedback({ matched: result.matched, score: result.score, bestGuess: result.bestGuess });
    setAnswers((current) => ({ ...current, [question.id]: text }));
    setResults((current) => ({ ...current, [question.id]: result.matched }));

    // Registrar la respuesta no debe poder romper la entrevista si el store fallara.
    try {
      recordAnswer(question.id, result.matched);
    } catch (error) {
      console.error('No se pudo registrar la respuesta de la entrevista:', error);
    }
  };

  const handleNext = () => {
    if (speech.isListening) {
      speech.stop();
    }

    clearSpeech();
    setFeedback(null);
    setText('');

    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }

    setFinished(true);
  };

  const handleRetry = () => {
    // Se pide un simulacro nuevo: 5 preguntas distintas (no las mismas en otro orden).
    setQuestions(buildInterviewQuestions());
    setIndex(0);
    setFeedback(null);
    setText('');
    setAnswers({});
    setResults({});
    setFinished(false);
    clearSpeech();
  };

  const handleExit = async () => {
    // Solo se confirma si ya se respondió a alguna pregunta.
    if (Object.keys(answers).length > 0 && !finished) {
      const accepted = await confirm({
        title: 'Salir de la entrevista',
        message: 'Se perderán las respuestas de esta entrevista. Tu XP y tu racha ya quedan guardados.',
        confirmLabel: 'Salir',
        cancelLabel: 'Seguir practicando',
      });

      if (!accepted) {
        return;
      }
    }

    if (speech.isListening) {
      speech.stop();
    }

    navigate('/');
  };

  if (finished || question === undefined) {
    const entries: SessionReviewItem[] = questions.map((entry) => ({
      question: entry,
      wasCorrect: results[entry.id] === true,
      userAnswer: answers[entry.id],
    }));

    const correctCount = questions.filter((entry) => results[entry.id] === true).length;

    return (
      <div className="page">
        <SessionReview
          items={entries}
          title={`Resultado de la entrevista: ${correctCount} de ${questions.length} correctas`}
          showSummary={false}
        />
        <div className="results-actions">
          <button type="button" className="btn btn--primary" onClick={handleRetry}>
            Hacer otra entrevista
          </button>
          <Link to="/" className="btn btn--secondary">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const answered = feedback !== null;
  const canCheck = text.trim().length > 0 && !answered;

  return (
    <div className="page">
      <div className="topbar">
        <span className="topbar__counter">
          Pregunta {index + 1} de {questions.length}
        </span>
        <button type="button" className="btn btn--ghost" onClick={() => void handleExit()}>
          Salir
        </button>
      </div>

      <ProgressBar value={index / questions.length} label="Progreso de la entrevista" />

      <p className="screen-subtitle">Responde en inglés, en voz alta o por escrito.</p>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="question-head">
          <h1 className="question-head__text">{question.question_en}</h1>
          <SpeakerButton text={question.question_en} compact label="Escuchar la pregunta" />
        </div>

        <p className="answer-single-es">{question.question_es}</p>

        {speech.supported ? (
          <div className="speech-block">
            <button
              type="button"
              className={`speech-button speech-button--${
                speech.isListening ? 'stop' : answered ? 'processing' : 'start'
              }`}
              disabled={answered}
              onClick={() => {
                if (speech.isListening) {
                  speech.stop();
                } else {
                  speech.start();
                }
              }}
            >
              <Icon name={speech.isListening ? 'stop' : 'mic'} />
              {speech.isListening ? 'Detener y usar lo dicho' : 'Responder en voz alta'}
            </button>
            <p className="speech-status">
              {speech.isListening
                ? 'Escuchando… habla claro y en inglés.'
                : 'Toca el micrófono, di tu respuesta y se escribirá abajo.'}
            </p>
            {speech.error !== null && (
              <div className="speech-error">
                <p className="speech-error__text">{speech.error}</p>
                <button type="button" className="speech-error__retry" onClick={speech.start}>
                  Reintentar
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="speech-note">
            Tu navegador no permite responder con la voz. Escribe la respuesta abajo (para usar el
            micrófono, abre la app en Chrome, Edge o Safari con HTTPS).
          </p>
        )}

        <label className="review-item__label" htmlFor="interview-answer">
          Tu respuesta en inglés
        </label>
        <textarea
          id="interview-answer"
          className="interview-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type your answer in English…"
          disabled={answered}
          rows={3}
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck={false}
        />

        {!answered ? (
          <button type="button" className="btn btn--primary" onClick={handleCheck} disabled={!canCheck}>
            Comprobar respuesta
          </button>
        ) : (
          <>
            <AnswerFeedback
              question={question}
              wasCorrect={feedback.matched}
              userAnswer={text}
              score={feedback.score}
            />
            <p className="result-note">
              Respuesta más parecida de las oficiales: «{feedback.bestGuess}».
            </p>
            <button type="button" className="btn btn--primary" onClick={handleNext}>
              {index + 1 < questions.length ? 'Siguiente pregunta' : 'Ver resultado'}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
