// src/components/AnswerFeedback.tsx
// Propósito: resultado de una pregunta una vez corregida (en el quiz o en la entrevista).
// Muestra si se acertó, lo que respondió el usuario y TODAS las respuestas aceptadas (no solo
// la primera: el USCIS admite varias y el usuario debe poder verlas).
import OfficialAnswerCard from '@/components/OfficialAnswerCard';
import SpeakerButton from '@/components/SpeakerButton';
import type { Question } from '@/types';

type AnswerFeedbackProps = {
  question: Question;
  wasCorrect: boolean;
  /** Respuesta elegida (quiz) o escrita/dictada (entrevista). */
  userAnswer?: string;
  /** Coincidencia de 0 a 1 (solo entrevista); se muestra como porcentaje. */
  score?: number;
};

export default function AnswerFeedback({ question, wasCorrect, userAnswer, score }: AnswerFeedbackProps) {
  return (
    <section className="feedback" aria-live="polite">
      <p className={`feedback__title feedback__title--${wasCorrect ? 'correct' : 'incorrect'}`}>
        {wasCorrect ? '¡Correcto!' : 'Respuesta incorrecta'}
      </p>

      {score !== undefined && (
        <p className="feedback__score">Coincidencia con la respuesta oficial: {Math.round(score * 100)} %</p>
      )}

      {userAnswer !== undefined && userAnswer.trim().length > 0 && (
        <p className="feedback__user">
          <strong>Tú dijiste:</strong> {userAnswer}
        </p>
      )}

      {question.answers_en.length > 0 ? (
        <div className="feedback__block">
          <span className="feedback__title" style={{ fontSize: 14 }}>
            {question.answers_en.length === 1 ? 'Respuesta correcta:' : 'Respuestas correctas:'}
          </span>
          <ul className="answer-list">
            {question.answers_en.map((answer, index) => (
              <li key={answer} className="answer-row">
                <div className="feedback__correct">
                  {answer}
                  {question.answers_es[index] !== undefined && question.answers_es[index] !== answer && (
                    <span className="answer-pair__es">{question.answers_es[index]}</span>
                  )}
                </div>
                <SpeakerButton text={answer} compact label={`Escuchar: ${answer}`} />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <OfficialAnswerCard question={question} />
      )}
    </section>
  );
}
