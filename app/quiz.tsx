// app/quiz.tsx
// Propósito: examen de práctica con 20 preguntas aleatorias de las 120 oficiales que tienen
// respuesta estática (las 8 dinámicas quedan fuera: su respuesta depende del gobierno o del
// estado del solicitante). Cada pregunta se convierte en un multiple choice de 4 opciones: la
// correcta es SIEMPRE la primera respuesta aceptada y los 3 distractores salen del banco de
// respuestas, dando prioridad a las de la misma categoría. A diferencia de flashcards, aquí no
// hay pista ni explicación antes de responder: el usuario selecciona, confirma con "Siguiente" y
// la corrección completa llega al final. Tres fases: 'quiz' | 'results' | 'review'. Cada respuesta
// se registra con `recordAnswer` para que cuente en el progreso y en el repaso espaciado.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SessionReview from '@/components/SessionReview';
import type { SessionReviewFilter, SessionReviewItem } from '@/components/SessionReview';
import questionsJson from '@/data/questions.json';
import { useStore } from '@/store/useStore';
import type { Category, Question, QuestionsFile } from '@/types';

/** Preguntas del examen de práctica (igual que el examen real). */
const QUIZ_SIZE = 20;
/** Aciertos necesarios para aprobar (el examen real exige 12 de 20). */
const PASS_THRESHOLD = 12;
/** Opciones por pregunta: 1 correcta + 3 distractores. */
const OPTIONS_PER_QUESTION = 4;
/** Distractores que hay que reunir por pregunta. */
const DISTRACTORS_PER_QUESTION = OPTIONS_PER_QUESTION - 1;

/**
 * DECISIÓN DE PRODUCTO: permitir que las demás respuestas aceptadas de la propia pregunta actúen
 * como distractores prioritarios.
 *
 * `false` (actual, elegido): solo la opción marcada como correcta es válida para la pregunta; sus
 * demás respuestas aceptadas quedan vetadas como distractores y los 3 se toman del banco de otras
 * preguntas, con prioridad para la misma categoría.
 * `true`: los distractores salen primero de las variantes oficiales de la respuesta, de modo que en
 * las 42 preguntas que aceptan 4 o más respuestas las 3 opciones descartadas TAMBIÉN valen para el
 * USCIS (el simulado medía ~50% de distractores válidos).
 *
 * Mejora futura (no bloqueante): banco de distractores curados a mano
 * (src/data/quizDistractors.json) para eliminar el riesgo residual de
 * que una respuesta válida de OTRA pregunta aparezca como incorrecta.
 * Costo estimado: 360 distractores (120 preguntas × 3). Evaluar en Fase 7
 * según feedback de usuarios reales.
 */
const USE_SIBLING_ANSWERS_AS_DISTRACTORS = false;

/** Las 128 preguntas oficiales (el import de JSON ensancha los tipos: se afirma). */
const QUESTIONS: Question[] = (questionsJson as QuestionsFile).questions;

/**
 * Preguntas aptas para el multiple choice: las que tienen al menos una respuesta estática.
 * Quedan fuera las 8 dinámicas (`answers_en` vacío), cuya respuesta no puede fijarse como opción
 * (4 dependen del estado del solicitante y las otras 4 esperan a integrar officialData.json aquí).
 */
const QUIZ_POOL: Question[] = QUESTIONS.filter((question) => question.answers_en.length > 0);

/** Fase de la pantalla. */
type Phase = 'quiz' | 'results' | 'review';

/** Una opción del multiple choice. */
type QuizOption = {
  /** Id estable dentro del examen (p. ej. "gov-001-opt-2"). */
  id: string;
  /** Texto en inglés: es lo que se pregunta. */
  en: string;
  /** Traducción al español, para reforzar el vocabulario. */
  es: string;
  /** `true` en la única opción correcta. */
  isCorrect: boolean;
};

/** Una pregunta con sus opciones ya barajadas. */
type QuizItem = {
  question: Question;
  options: QuizOption[];
};

/** Respuesta del usuario, con lo necesario para el repaso posterior. */
type UserAnswer = {
  /** Pregunta y opciones tal y como se mostraron. */
  item: QuizItem;
  /** Id de la opción elegida. */
  selectedOptionId: string;
  /** `true` si la opción elegida era la correcta. */
  isCorrect: boolean;
};

/** Respuesta aceptada del banco de distractores, con su categoría de origen. */
type AnswerPair = {
  en: string;
  es: string;
  category: Category;
};

/** Texto normalizado para comparar opciones (minúsculas y sin espacios de más). */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Mezcla una copia del array (Fisher-Yates); no muta el original. */
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

/** Todas las respuestas aceptadas de las preguntas aptas: el banco de donde salen los distractores. */
const ANSWER_BANK: AnswerPair[] = QUIZ_POOL.flatMap((question) =>
  question.answers_en.map((en, index) => ({
    en,
    es: question.answers_es[index],
    category: question.category,
  })),
);

/**
 * Banco de distractores agrupado por categoría (se construye una sola vez al cargar el módulo).
 * Preferir la misma categoría hace los distractores más plausibles y el examen más útil.
 */
const DISTRACTORS_BY_CATEGORY = new Map<Category, AnswerPair[]>();

for (const answer of ANSWER_BANK) {
  const bucket = DISTRACTORS_BY_CATEGORY.get(answer.category);

  if (bucket === undefined) {
    DISTRACTORS_BY_CATEGORY.set(answer.category, [answer]);
  } else {
    bucket.push(answer);
  }
}

/**
 * Diferencia máxima de palabras entre la correcta y un distractor en el primer y en el segundo
 * intento de la cascada (`STRICT_WORD_DELTA` en los niveles 1 y 3, `LOOSE_WORD_DELTA` en 2 y 4).
 */
const STRICT_WORD_DELTA = 3;
const LOOSE_WORD_DELTA = 6;

/** Palabras a partir de las cuales la correcta se considera "larga" (ver `isTooShort`). */
const LONG_CORRECT_WORDS = 5;

/**
 * Palabras o menos que convierten un distractor en absurdo junto a una correcta larga: es el caso
 * real que motivó esta heurística ("Citizens eighteen (18) and older can vote." con "Vote").
 */
const SHORT_DISTRACTOR_WORDS = 2;

/** Respuesta del banco con su diferencia de palabras respecto a la respuesta correcta. */
type AnswerCandidate = {
  candidate: AnswerPair;
  /** |palabras(correcta) - palabras(candidato)|. */
  delta: number;
};

/**
 * Número de palabras de un texto en inglés: los signos se tratan como espacios y los espacios de
 * más se colapsan ("Citizens eighteen (18) and older can vote." -> 7 palabras). Se usa para medir
 * la paridad de longitud entre la correcta y cada distractor.
 */
function countWords(text: string): number {
  return text
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Opciones de una pregunta: 1 correcta + 3 distractores, barajadas.
 *
 * La opción correcta es SIEMPRE la primera respuesta aceptada (`answers_en[0]`: en
 * `questions.json` las más comunes van al inicio). Los distractores se buscan en una CASCADA de
 * coherencia que prioriza que sean formal y temáticamente plausibles, y solo se relaja si no hay
 * candidatos suficientes:
 *
 *   Nivel 1: misma categoría + diferencia de palabras <= 3.
 *   Nivel 2: misma categoría + diferencia de palabras <= 6.
 *   Nivel 3: cualquier categoría + diferencia de palabras <= 3.
 *   Nivel 4: cualquier categoría + diferencia de palabras <= 6.
 *   Nivel 5: cualquier categoría, cualquier longitud (el reparto antiguo, sin filtro de coherencia).
 *
 * El nivel 5 existe para NUNCA romper el examen: garantiza que siempre haya 4 opciones aunque los
 * niveles 1-4 se queden cortos. Con `questions.json` actual no se alcanza (el nivel 1 cubre ~98%
 * de las preguntas y los niveles 4-5 no llegan a usarse); queda como red de seguridad para el
 * futuro y para datos nuevos. Después, por el mismo motivo, una última pasada con el banco
 * completo sin el veto de coherencia.
 *
 * Antes de los niveles se aplica el veto "Vote-style": si la correcta es larga (>= 5 palabras) se
 * descartan los distractores de 1-2 palabras, que el usuario percibe como un sinsentido.
 *
 * En todos los niveles se excluyen la propia pregunta, TODAS sus `answers_en` (ver
 * `USE_SIBLING_ANSWERS_AS_DISTRACTORS`) y los distractores ya elegidos, y los candidatos se
 * barajan dentro de cada nivel para no sesgarse por el orden del JSON. Si un nivel no llega a 3
 * candidatos se pasa al siguiente y se completan los que falten.
 */
function buildOptions(question: Question): QuizOption[] {
  const correct: AnswerPair = {
    en: question.answers_en[0],
    es: question.answers_es[0],
    category: question.category,
  };

  const usedEn = new Set([normalize(correct.en)]);
  const usedEs = new Set([normalize(correct.es)]);

  // Con los distractores hermanos prohibidos, ninguna respuesta aceptada de esta pregunta puede
  // aparecer como opción equivocada (ni siquiera llegando por el banco general): así solo la
  // opción marcada como correcta es válida.
  if (!USE_SIBLING_ANSWERS_AS_DISTRACTORS) {
    for (const accepted of question.answers_en) {
      usedEn.add(normalize(accepted));
    }
  }

  const siblingDistractors: AnswerPair[] = USE_SIBLING_ANSWERS_AS_DISTRACTORS
    ? question.answers_en.slice(1).map((en, index) => ({
        en,
        es: question.answers_es[index + 1],
        category: question.category,
      }))
    : [];

  const correctWords = countWords(correct.en);

  // Veto "Vote-style": una correcta larga no admite distractores de 1-2 palabras.
  const isTooShort = (candidate: AnswerPair): boolean =>
    correctWords >= LONG_CORRECT_WORDS && countWords(candidate.en) <= SHORT_DISTRACTOR_WORDS;

  // La diferencia de palabras de cada respuesta del banco se mide UNA sola vez: la cascada
  // reevalúa el mismo banco en varios niveles.
  const measure = (pool: AnswerPair[]): AnswerCandidate[] =>
    pool.map((candidate) => ({
      candidate,
      delta: Math.abs(countWords(candidate.en) - correctWords),
    }));

  const coherentOnly = (entries: AnswerCandidate[]): AnswerCandidate[] =>
    entries.filter((entry) => !isTooShort(entry.candidate));

  const withMaxDelta = (entries: AnswerCandidate[], maxDelta: number): AnswerPair[] =>
    entries.filter((entry) => entry.delta <= maxDelta).map((entry) => entry.candidate);

  const coherentSameCategory = coherentOnly(
    measure(DISTRACTORS_BY_CATEGORY.get(question.category) ?? []),
  );
  const coherentBank = coherentOnly(measure(ANSWER_BANK));

  // Cascada en orden de preferencia (niveles 1-5) + pasada final con el banco completo SIN el veto
  // de coherencia, que es la que garantiza las 4 opciones si algún día los niveles no bastaran.
  const pools: AnswerPair[][] = [
    withMaxDelta(coherentSameCategory, STRICT_WORD_DELTA),
    withMaxDelta(coherentSameCategory, LOOSE_WORD_DELTA),
    withMaxDelta(coherentBank, STRICT_WORD_DELTA),
    withMaxDelta(coherentBank, LOOSE_WORD_DELTA),
    coherentBank.map((entry) => entry.candidate),
    ANSWER_BANK,
  ];

  const candidatesInOrder = [
    ...shuffle(siblingDistractors),
    ...pools.flatMap((pool) => shuffle(pool)),
  ];

  const distractors: AnswerPair[] = [];

  for (const candidate of candidatesInOrder) {
    if (distractors.length >= DISTRACTORS_PER_QUESTION) {
      break;
    }

    const en = normalize(candidate.en);
    const es = normalize(candidate.es);

    if (usedEn.has(en) || usedEs.has(es)) {
      continue;
    }

    usedEn.add(en);
    usedEs.add(es);
    distractors.push(candidate);
  }

  return shuffle<QuizOption>([
    { id: `${question.id}-opt-correct`, en: correct.en, es: correct.es, isCorrect: true },
    ...distractors.map((distractor, index) => ({
      id: `${question.id}-opt-${index}`,
      en: distractor.en,
      es: distractor.es,
      isCorrect: false,
    })),
  ]);
}

/** Construye el examen: `QUIZ_SIZE` preguntas al azar, cada una con sus 4 opciones barajadas. */
function buildQuizQueue(): QuizItem[] {
  return shuffle(QUIZ_POOL)
    .slice(0, QUIZ_SIZE)
    .map((question) => ({ question, options: buildOptions(question) }));
}

export default function QuizScreen() {
  const router = useRouter();

  // El progreso vive en AsyncStorage y Zustand lo hidrata de forma asíncrona. Hasta que termina,
  // una respuesta registrada podría perderse al llegar el estado persistido: se espera, igual que
  // hace la pantalla de flashcards.
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>('quiz');
  const [queue, setQueue] = useState<QuizItem[]>(() => buildQuizQueue());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [reviewFilter, setReviewFilter] = useState<SessionReviewFilter>('incorrect');

  useEffect(() => {
    const markHydrated = () => setHydrated(true);

    if (useStore.persist.hasHydrated()) {
      markHydrated();
      return;
    }

    // `onFinishHydration` devuelve su propia función de cancelación (cleanup del efecto).
    return useStore.persist.onFinishHydration(markHydrated);
  }, []);

  const totalQuestions = queue.length;
  const currentItem: QuizItem | undefined = queue[currentIndex];
  const isLastQuestion = currentIndex === totalQuestions - 1;

  const correctCount = userAnswers.filter((answer) => answer.isCorrect).length;
  const incorrectAnswers = userAnswers.filter((answer) => !answer.isCorrect);
  // Intentos en orden cronológico, con la opción elegida, para la vista de revisión.
  const reviewItems: SessionReviewItem[] = userAnswers.map((answer) => ({
    question: answer.item.question,
    wasCorrect: answer.isCorrect,
    userChoice: answer.item.options.find((option) => option.id === answer.selectedOptionId)?.en,
  }));
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = correctCount >= PASS_THRESHOLD;

  /** Selecciona una opción; se puede cambiar de idea hasta confirmar con "Siguiente". */
  const handleSelect = useCallback((optionId: string) => {
    setSelectedOptionId(optionId);
  }, []);

  /**
   * Confirma la respuesta y avanza (o pasa a resultados). El registro en el store se hace aquí y
   * no en `handleSelect` para que cambiar de opción antes de confirmar no cuente doble.
   */
  const handleNext = useCallback(() => {
    if (currentItem === undefined || selectedOptionId === null) {
      return;
    }

    const selectedOption = currentItem.options.find((option) => option.id === selectedOptionId);

    if (selectedOption === undefined) {
      return;
    }

    const answer: UserAnswer = {
      item: currentItem,
      selectedOptionId,
      isCorrect: selectedOption.isCorrect,
    };

    // Un fallo del store (AsyncStorage, hidratación...) no debe romper el examen.
    try {
      useStore.getState().recordAnswer(currentItem.question.id, selectedOption.isCorrect);
    } catch (error) {
      console.warn('[quiz] no se pudo registrar la respuesta en el store:', error);
    }

    setUserAnswers((answers) => [...answers, answer]);

    if (isLastQuestion) {
      setPhase('results');
      return;
    }

    setCurrentIndex((index) => index + 1);
    setSelectedOptionId(null);
  }, [currentItem, isLastQuestion, selectedOptionId]);

  /** Nuevo examen: cola nueva, contadores a cero y vuelta a la primera pregunta. */
  const handleRestart = useCallback(() => {
    setQueue(buildQuizQueue());
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setUserAnswers([]);
    setReviewFilter('incorrect');
    setPhase('quiz');
  }, []);

  /** Pasa al repaso de las preguntas falladas. */
  const handleReview = useCallback(() => {
    // Se entra al repaso con el filtro de falladas (el comportamiento de siempre).
    setReviewFilter('incorrect');
    setPhase('review');
  }, []);

  /** Vuelve a la pantalla de inicio. */
  const handleHome = useCallback(() => {
    router.push('/');
  }, [router]);

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3a6b" />
      </SafeAreaView>
    );
  }

  // Sin preguntas aptas (no ocurre con el JSON actual) o índice fuera de rango.
  if (queue.length === 0 || currentItem === undefined) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>No hay preguntas disponibles para el examen.</Text>
        <Pressable accessibilityRole="button" onPress={handleHome} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Volver al inicio</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === 'results') {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.resultsContent}>
          <Text style={styles.title}>Examen completado</Text>

          <View style={[styles.badge, passed ? styles.badgePassed : styles.badgeFailed]}>
            <Text
              style={[styles.badgeText, passed ? styles.badgeTextPassed : styles.badgeTextFailed]}
            >
              {passed ? '✓ Aprobado' : '✗ No aprobado'}
            </Text>
          </View>

          <Text style={styles.percentage}>{percentage}%</Text>

          <Text style={styles.summary}>
            {correctCount} correctas · {incorrectAnswers.length} incorrectas
          </Text>

          <Text style={styles.thresholdNote}>
            Se necesitan {PASS_THRESHOLD} de {QUIZ_SIZE} respuestas correctas para aprobar.
          </Text>

          {incorrectAnswers.length > 0 && (
            <Pressable accessibilityRole="button" onPress={handleReview} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                Revisar falladas ({incorrectAnswers.length})
              </Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={handleRestart}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Nuevo examen</Text>
          </Pressable>

          <Pressable accessibilityRole="button" onPress={handleHome} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Volver al inicio</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'review') {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          <Text style={styles.counter}>
            Repaso · {incorrectAnswers.length} falladas de {totalQuestions}
          </Text>
          <Pressable accessibilityRole="button" onPress={handleHome} style={styles.exitButton}>
            <Text style={styles.exitText}>Salir</Text>
          </Pressable>
        </View>

        <SessionReview items={reviewItems} filter={reviewFilter} onFilterChange={setReviewFilter} />

        <View style={styles.reviewFooter}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPhase('results')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Volver a resultados</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          Pregunta {currentIndex + 1} de {totalQuestions}
        </Text>
        <Pressable accessibilityRole="button" onPress={handleHome} style={styles.exitButton}>
          <Text style={styles.exitText}>Salir</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.questionEn}>{currentItem.question.question_en}</Text>

        <View accessibilityRole="radiogroup" style={styles.optionsBlock}>
          {currentItem.options.map((option) => {
            const isSelected = option.id === selectedOptionId;

            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={option.en}
                onPress={() => handleSelect(option.id)}
                style={({ pressed }) => [
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                  pressed && !isSelected && styles.optionCardPressed,
                ]}
              >
                <View style={styles.optionTextBlock}>
                  <Text style={styles.optionEn}>{option.en}</Text>
                  <Text style={styles.optionEs}>{option.es}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: selectedOptionId === null }}
          disabled={selectedOptionId === null}
          onPress={handleNext}
          style={[styles.nextButton, selectedOptionId === null && styles.nextButtonDisabled]}
        >
          <Text
            style={[
              styles.nextButtonText,
              selectedOptionId === null && styles.nextButtonTextDisabled,
            ]}
          >
            {isLastQuestion ? 'Ver resultados' : 'Siguiente'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: '#ffffff',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  counter: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a3a6b',
  },
  exitButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d5dbe5',
  },
  exitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555555',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  questionEn: {
    fontSize: 21,
    fontWeight: '600',
    color: '#1a3a6b',
    textAlign: 'center',
    marginTop: 8,
  },
  optionsBlock: {
    gap: 10,
    marginTop: 6,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  optionCardPressed: {
    backgroundColor: '#f0f4f9',
  },
  optionCardSelected: {
    borderColor: '#1a3a6b',
    backgroundColor: '#f0f4f9',
  },
  optionTextBlock: {
    flex: 1,
    gap: 2,
  },
  optionEn: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  optionEs: {
    fontSize: 14,
    color: '#666666',
  },
  nextButton: {
    backgroundColor: '#1a3a6b',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  nextButtonDisabled: {
    backgroundColor: '#c7d0dd',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  nextButtonTextDisabled: {
    color: '#eef2f7',
  },
  resultsContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a3a6b',
    textAlign: 'center',
  },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 2,
  },
  badgePassed: {
    borderColor: '#2e7d32',
    backgroundColor: '#eef7ee',
  },
  badgeFailed: {
    borderColor: '#c62828',
    backgroundColor: '#fdeeee',
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '700',
  },
  badgeTextPassed: {
    color: '#2e7d32',
  },
  badgeTextFailed: {
    color: '#c62828',
  },
  percentage: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  summary: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333333',
  },
  thresholdNote: {
    fontSize: 13,
    color: '#888888',
    textAlign: 'center',
  },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: '#1a3a6b',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a3a6b',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1a3a6b',
    fontSize: 17,
    fontWeight: '700',
  },
  // Pie fijo de la fase de repaso: mantiene "Volver a resultados" siempre a la vista.
  reviewFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a3a6b',
    textAlign: 'center',
  },
});
