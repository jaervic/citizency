// src/components/AnswerFeedback.tsx
// Propósito: tarjeta presentacional con el resultado de una respuesta ya corregida: si fue
// correcta o no, con qué similitud, qué respondió el usuario y cuál es la respuesta oficial (con su
// botón 🔊 para oírla). No guarda estado, no tiene botón ni auto-avance: quien la usa decide qué
// hacer después ("Siguiente", "Repetir", etc.).
//
// Nace para el simulacro de entrevista (app/interview.tsx) y está pensada para reutilizarse en el
// Modo Práctica del quiz (pendiente, ver NOTES.md §7) y en la entrevista con voz real de Fase 6.
// Los cuatro textos los recibe ya formateados: el componente no normaliza ni compara nada.
import { StyleSheet, Text, View } from 'react-native';

import SpeakerButton from '@/components/SpeakerButton';
import { colors } from '@/theme';

/** Si la respuesta se dio por válida o no. */
export type AnswerFeedbackState = 'correct' | 'incorrect';

/** Props de la tarjeta de feedback. */
export type AnswerFeedbackProps = {
  /** Resultado de la corrección (`fuzzyMatch` en la entrevista). */
  state: AnswerFeedbackState;
  /** Similitud obtenida, de 0 a 1 (se muestra como porcentaje entero). */
  score: number;
  /** Respuesta oficial original (`answers_en[0]`, sin normalizar): la que se muestra y se pronuncia. */
  correctAnswer: string;
  /** Lo que respondió el usuario, tal cual escribió o dijo (ya legible). */
  userAnswer: string;
};

export default function AnswerFeedback({
  state,
  score,
  correctAnswer,
  userAnswer,
}: AnswerFeedbackProps) {
  const isCorrect = state === 'correct';

  return (
    <View style={styles.card}>
      <Text style={[styles.title, isCorrect ? styles.titleCorrect : styles.titleIncorrect]}>
        {isCorrect ? '✓ Correcto' : '✗ Incorrecto'}
      </Text>

      <Text style={styles.score}>Similitud: {Math.round(score * 100)}%</Text>

      <Text style={styles.userAnswer}>Tu respuesta: {userAnswer}</Text>

      <View style={styles.answerBlock}>
        <Text style={styles.answerLabel}>Respuesta correcta:</Text>
        <View style={styles.answerRow}>
          <Text style={styles.correctAnswer}>{correctAnswer}</Text>
          <SpeakerButton text={correctAnswer} size="small" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  titleCorrect: {
    color: colors.success,
  },
  titleIncorrect: {
    color: colors.error,
  },
  score: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  userAnswer: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  answerBlock: {
    gap: 4,
  },
  answerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  // El texto y su botón 🔊 van juntos: la respuesta correcta se puede oír tal cual se pronuncia.
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  correctAnswer: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    lineHeight: 22,
  },
});
