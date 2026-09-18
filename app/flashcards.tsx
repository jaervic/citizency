// app/flashcards.tsx
// Propósito: pantalla principal de estudio con recuerdo activo. Espera a que Zustand
// hidrate el progreso persistido (AsyncStorage) y entonces construye la cola de 20
// preguntas con `buildStudyQueue`. Muestra solo el enunciado en inglés y, al pedirlo,
// revela respuestas, explicación y vocabulario antes de autocorregirse. Cada respuesta pasa
// por el store (`recordAnswer`: XP + racha del día, idempotente dentro del día) y las
// preguntas falladas se re-encolan (hasta MAX_REQUEUES veces) para reforzarlas en la misma
// sesión. Incluye además un "Repaso intensivo" (`excludeMastered: true`) para estudiar solo
// lo que queda por dominar. Todos
// los textos en inglés (enunciado, respuestas y vocabulario) llevan un botón 🔊 de
// pronunciación, y las preguntas con más de MAX_VISIBLE_ANSWERS respuestas se pliegan para
// no saturar la pantalla. El contador va en dos fases (la sesión original y el repaso de las
// re-encoladas) para que no dé la sensación de retroceder al fallar una pregunta.
//
// AVISO: officialData.json contiene información vigente a la fecha lastUpdated.
// Actualízalo manualmente cuando cambie el gobierno (elecciones, renuncias, etc.).
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SessionReview from '@/components/SessionReview';
import type { SessionReviewFilter, SessionReviewItem } from '@/components/SessionReview';
import SpeakerButton from '@/components/SpeakerButton';
import officialDataJson from '@/data/officialData.json';
import questionsJson from '@/data/questions.json';
import { useStore } from '@/store/useStore';
import type { OfficialData, OfficialField, Question, QuestionsFile } from '@/types';
import { buildStudyQueue } from '@/utils/spacedRepetition';

/** Las 128 preguntas oficiales (el import de JSON ensancha los tipos: se afirma). */
const QUESTIONS: Question[] = (questionsJson as QuestionsFile).questions;

/**
 * Datos oficiales vigentes de los cargos de las preguntas dinámicas (el import de JSON
 * ensancha los tipos: se afirma). Es contenido que se actualiza A MANO: ver el aviso de la
 * cabecera del archivo y el campo `lastUpdated`.
 */
const OFFICIAL_DATA: OfficialData = officialDataJson as OfficialData;

/** Preguntas por sesión de estudio. */
const SESSION_SIZE = 20;

/**
 * Umbral de respuestas en inglés a partir del cual se muestra cada una con su traducción
 * española justo debajo (en lugar de la lista de inglés seguida de la de español). La
 * condición usada es `answers_en.length > MULTIPLE_ANSWERS_THRESHOLD`, así que con 1 solo
 * las preguntas de UNA única respuesta conservan el formato simple. `questions.json`
 * garantiza que `answers_en[i]` y `answers_es[i]` son la misma respuesta en ambos idiomas.
 */
const MULTIPLE_ANSWERS_THRESHOLD = 1;

/**
 * Máximo de respuestas en inglés que se listan de golpe cuando una pregunta admite muchas
 * (en `questions.json` hay hasta 25). A partir de ahí el resto queda detrás del botón
 * "Ver las N restantes", porque en el examen solo hay que recordar DOS de la lista.
 */
const MAX_VISIBLE_ANSWERS = 5;

/** Veces que una pregunta fallada vuelve al final de la cola dentro de la misma sesión. */
const MAX_REQUEUES = 2;

/** Aviso para las preguntas cuya respuesta depende del estado o del gobierno actual. */
const DYNAMIC_ANSWER_NOTE =
  'Esta pregunta depende de tu estado o del gobierno actual. Consulta la información vigente.';

/** Meses en español: se escriben a mano para no depender de Intl (irregular en Hermes). */
const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Convierte "2025-01-20" en "20 de enero de 2025"; si el formato no cuadra, deja la fecha. */
function formatSpanishDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthName = MONTHS_ES[Number(month) - 1];

  if (year === undefined || day === undefined || monthName === undefined) {
    return isoDate;
  }

  return `${Number(day)} de ${monthName} de ${year}`;
}

/**
 * Respuesta vigente de una pregunta dinámica (p. ej. "Donald Trump") según
 * `officialData.json`. Devuelve `null` si el campo no está definido o sigue pendiente
 * (senadores, representante, gobernador y capital): en ese caso la pantalla se queda
 * únicamente con el aviso genérico.
 */
function getOfficialFieldValue(field: OfficialField): string | null {
  if (field === null) {
    return null;
  }

  const value = OFFICIAL_DATA[field];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Resultado acumulado de la FASE A (las preguntas originales de la sesión). */
type SessionResults = {
  correct: number;
  incorrect: number;
};

export default function FlashcardsScreen() {
  const router = useRouter();

  // El progreso se persiste en AsyncStorage, que es asíncrono: hasta que Zustand
  // termina de hidratar, el estado en memoria está vacío. Por eso la primera cola se
  // construye DESPUÉS de la hidratación y no en el inicializador de `useState`.
  const [hydrated, setHydrated] = useState(false);
  const [queue, setQueue] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  // `true` cuando el usuario despliega la lista completa de respuestas de una pregunta larga.
  const [expandedAnswers, setExpandedAnswers] = useState(false);
  // Solo cuenta la FASE A: las preguntas re-encoladas son refuerzo y no alteran el resultado.
  const [originalResults, setOriginalResults] = useState<SessionResults>({
    correct: 0,
    incorrect: 0,
  });
  // Tamaño de la FASE A de la sesión en curso (20 en la sesión normal, 128 en el repaso
  // completo). A partir de este índice las preguntas de la cola son re-encoladas (FASE B).
  const [originalSessionSize, setOriginalSessionSize] = useState(SESSION_SIZE);
  const [sessionFinished, setSessionFinished] = useState(false);
  // `true` cuando el "Repaso intensivo" no encuentra ninguna pregunta sin dominar.
  const [allMastered, setAllMastered] = useState(false);
  // Veces que cada pregunta se ha re-encolado por fallarla (clave = id de pregunta).
  const [requeueCount, setRequeueCount] = useState<Record<string, number>>({});
  // Vista de revisión post-sesión: se abre desde la pantalla de fin y lista todos los intentos.
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<SessionReviewFilter>('all');
  // Intentos de la sesión en orden cronológico. Una pregunta re-encolada se guarda otra vez: la
  // revisión refleja lo que pasó realmente en la sesión (fallo y luego acierto, por ejemplo).
  const [sessionReviewItems, setSessionReviewItems] = useState<SessionReviewItem[]>([]);

  /** Cola de la sesión normal: 20 preguntas por prioridad, con el progreso ya hidratado. */
  const buildSessionQueue = useCallback(
    () => buildStudyQueue(QUESTIONS, useStore.getState(), { limit: SESSION_SIZE }),
    [],
  );

  // Hidratación: si ya terminó se rellena la cola; si no, se espera al evento.
  // `onFinishHydration` devuelve su propia función de cancelación (cleanup del efecto).
  useEffect(() => {
    const fillQueueFromHydratedProgress = () => {
      const initialQueue = buildSessionQueue();
      setQueue(initialQueue);
      setOriginalSessionSize(initialQueue.length);
      setHydrated(true);
    };

    if (useStore.persist.hasHydrated()) {
      fillQueueFromHydratedProgress();
      return;
    }

    return useStore.persist.onFinishHydration(fillQueueFromHydratedProgress);
  }, [buildSessionQueue]);

  // Al cambiar de pregunta la tarjeta vuelve a empezar limpia: la respuesta se oculta otra
  // vez y, si la pregunta anterior tenía una lista larga desplegada, se vuelve a plegar.
  useEffect(() => {
    setRevealAnswer(false);
    setExpandedAnswers(false);
  }, [currentIndex]);

  // Al desmontar la pantalla (salir de la sesión) se corta la pronunciación en curso.
  useEffect(
    () => () => {
      void Speech.stop();
    },
    [],
  );

  /** Reinicia todo el estado local con la cola indicada. */
  const resetSessionState = useCallback((nextQueue: Question[]) => {
    setQueue(nextQueue);
    setCurrentIndex(0);
    setRevealAnswer(false);
    setShowHint(false);
    setExpandedAnswers(false);
    setOriginalResults({ correct: 0, incorrect: 0 });
    // La FASE A de la nueva sesión es su cola inicial: los re-encolados llegan después.
    setOriginalSessionSize(nextQueue.length);
    setSessionFinished(false);
    setAllMastered(false);
    // "Estudiar otra vez" (y el resto de modos) empiezan con el contador de re-encolados limpio.
    setRequeueCount({});
    setReviewOpen(false);
    setReviewFilter('all');
    setSessionReviewItems([]);
  }, []);

  /** Sesión normal: 20 preguntas por prioridad, con el progreso actual del store. */
  const startSession = useCallback(() => {
    resetSessionState(buildSessionQueue());
  }, [buildSessionQueue, resetSessionState]);

  /**
   * Repaso intensivo: solo las preguntas que aún no se dominan (menos de 3 aciertos
   * seguidos o con fallos pendientes). Si no queda ninguna, se muestra la pantalla de
   * "has dominado todas las preguntas" en lugar de una sesión vacía.
   */
  const startIntensiveReview = useCallback(() => {
    const intensiveQueue = buildStudyQueue(QUESTIONS, useStore.getState(), {
      limit: Infinity,
      excludeMastered: true,
    });

    if (intensiveQueue.length === 0) {
      setQueue([]);
      setAllMastered(true);
      return;
    }

    resetSessionState(intensiveQueue);
  }, [resetSessionState]);

  /** Repaso completo: las 128 preguntas en orden oficial, sin recorte por prioridad. */
  const startFullReview = useCallback(() => {
    resetSessionState([...QUESTIONS]);
  }, [resetSessionState]);

  const currentQuestion: Question | undefined = queue[currentIndex];

  /** Registra el intento, re-encola la pregunta si se falló, acumula el resultado y avanza. */
  const handleAnswer = useCallback(
    (wasCorrect: boolean) => {
      if (currentQuestion === undefined) {
        return;
      }

      const questionId = currentQuestion.id;
      useStore.getState().recordAnswer(questionId, wasCorrect);

      // Se guarda el intento para la revisión post-sesión (orden cronológico).
      setSessionReviewItems((items) => [...items, { question: currentQuestion, wasCorrect }]);

      // El resultado solo cuenta en la FASE A: acertar una re-encolada en la fase de refuerzo
      // no debe maquillar el porcentaje de la sesión original.
      if (currentIndex < originalSessionSize) {
        setOriginalResults((results) => ({
          correct: results.correct + (wasCorrect ? 1 : 0),
          incorrect: results.incorrect + (wasCorrect ? 0 : 1),
        }));
      }

      // Refuerzo: la pregunta fallada vuelve al final de la cola (hasta MAX_REQUEUES
      // veces) para poder acertarla otra vez dentro de la misma sesión.
      const timesRequeued = requeueCount[questionId] ?? 0;
      const willRequeue = !wasCorrect && timesRequeued < MAX_REQUEUES;

      if (willRequeue) {
        setQueue((currentQueue) => [...currentQueue, currentQuestion]);
        setRequeueCount((counts) => ({ ...counts, [questionId]: timesRequeued + 1 }));
      }

      // El fin de sesión se calcula con la cola ya actualizada: si la pregunta se acaba
      // de re-encolar, la sesión continúa y esa pregunta quedará pendiente al final.
      if (currentIndex + 1 >= queue.length + (willRequeue ? 1 : 0)) {
        // La racha ya quedó actualizada por `recordAnswer` (store) en cada respuesta.
        setSessionFinished(true);
        return;
      }

      setCurrentIndex((index) => index + 1);
      setRevealAnswer(false);
      setShowHint(false);
    },
    [currentIndex, currentQuestion, originalSessionSize, queue.length, requeueCount],
  );

  /**
   * Intentos que se listan en la revisión. Una pregunta fallada se guarda varias veces en
   * `sessionReviewItems` (el fallo y cada re-encolada), así que aquí se conserva SOLO su
   * ÚLTIMA aparición, con su posición y su resultado: la revisión muestra cómo se cerró la
   * sesión y no el recorrido completo. El estado sigue siendo el registro cronológico íntegro
   * y `SessionReview` no sabe nada de esto (sigue siendo presentacional).
   */
  const reviewItems = useMemo(() => {
    const lastIndexById = new Map<string, number>();
    sessionReviewItems.forEach((item, index) => lastIndexById.set(item.question.id, index));

    return sessionReviewItems.filter(
      (item, index) => lastIndexById.get(item.question.id) === index,
    );
  }, [sessionReviewItems]);

  // Mientras el progreso persistido no esté hidratado no se puede decidir qué estudiar.
  if (!hydrated) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3a6b" />
      </SafeAreaView>
    );
  }

  // Cola vacía real: el "Repaso intensivo" no encontró nada por dominar (o no hay preguntas).
  if (allMastered || queue.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>¡Has dominado todas las preguntas disponibles! 🎉</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Volver al inicio</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={startFullReview}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Repasar de todas formas</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Revisión post-sesión: todos los intentos de la sesión, con filtro "Todas" / "Solo falladas".
  if (reviewOpen) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.topBar}>
          {/* Cuenta los items listados (únicos): cuadra con la lista deduplicada de arriba. */}
          <Text style={styles.counter}>Revisión · {reviewItems.length} respuestas</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/')}
            style={styles.exitButton}
          >
            <Text style={styles.exitText}>Ir al inicio</Text>
          </Pressable>
        </View>

        <SessionReview
          items={reviewItems}
          filter={reviewFilter}
          onFilterChange={setReviewFilter}
          showFilter
        />
      </SafeAreaView>
    );
  }

  if (sessionFinished || currentQuestion === undefined) {
    // El porcentaje se calcula SOLO con la FASE A: si se acertaron 15 de las 20 originales es
    // 75%, sin importar cuántas preguntas se re-encolaron ni cómo se resolvieran después.
    const phaseATotal = originalSessionSize;
    const percentage =
      phaseATotal > 0 ? Math.round((originalResults.correct / phaseATotal) * 100) : 0;
    // Hubo refuerzo si alguna pregunta fallada se re-encoló durante la sesión.
    const hasRequeuedQuestions = Object.values(requeueCount).some((count) => count > 0);

    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.title}>¡Sesión completada! 🎉</Text>
        <Text style={styles.score}>
          Correctas: {originalResults.correct} de {phaseATotal}
        </Text>
        <Text style={styles.percentage}>{percentage}%</Text>
        {hasRequeuedQuestions && (
          <Text style={styles.requeueNote}>
            Algunas preguntas se repitieron para reforzar el aprendizaje.
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Volver al inicio</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setReviewFilter('all');
            setReviewOpen(true);
          }}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Revisar todas las respuestas</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={startSession} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Estudiar otra vez</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={startIntensiveReview}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Repaso intensivo</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  /**
   * La sesión se muestra en DOS fases con contador y barra independientes:
   * - FASE A (las preguntas originales): "Pregunta X de <tamaño de la sesión original>".
   * - FASE B (las re-encoladas por fallo): "Repaso adicional · X de N".
   * Así, cuando una pregunta fallada vuelve al final de la cola, el contador de la sesión
   * original no cambia y el usuario no percibe que retrocede.
   */
  const inReinforcementPhase = currentIndex >= originalSessionSize;
  // Posición y total dentro de la fase actual (la FASE B puede crecer si se vuelve a fallar).
  const phaseIndex = inReinforcementPhase ? currentIndex - originalSessionSize : currentIndex;
  const phaseSize = inReinforcementPhase
    ? queue.length - originalSessionSize
    : originalSessionSize;
  // La barra se mide dentro de la fase: en su primera pregunta está vacía (0%) y en la última
  // queda casi llena, porque el índice de la pregunta actual empieza en 0.
  const progressPercent = (phaseIndex / Math.max(phaseSize, 1)) * 100;

  // Respuesta oficial vigente de las 8 preguntas dinámicas (`null` si el campo está pendiente).
  const officialValue = getOfficialFieldValue(currentQuestion.officialField);

  const totalAnswers = currentQuestion.answers_en.length;
  // Respuestas que quedan ocultas por el recorte (0 si la lista es corta o ya está abierta).
  const hiddenAnswersCount = Math.max(totalAnswers - MAX_VISIBLE_ANSWERS, 0);
  // Recorte de la lista visible: las respuestas más comunes están al inicio del array, así
  // que basta con mostrar las primeras MAX_VISIBLE_ANSWERS mientras no se pida ver el resto.
  const visibleAnswers = expandedAnswers
    ? currentQuestion.answers_en
    : currentQuestion.answers_en.slice(0, MAX_VISIBLE_ANSWERS);

  /**
   * Aviso de cabecera del bloque de respuestas. Evita dos extremos: que una pregunta de una
   * única respuesta parezca tener varias, y que una de 25 respuestas agobie. En las listas
   * largas se recuerda que basta con memorizar dos (las primeras son las más habituales).
   */
  const answersHint =
    totalAnswers <= 1
      ? 'Respuesta:'
      : totalAnswers <= MAX_VISIBLE_ANSWERS
        ? 'Puedes responder con cualquiera de estas:'
        : `Solo necesitas recordar 2 de estas ${totalAnswers}. Las más comunes están al inicio:`;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          {inReinforcementPhase
            ? `Repaso adicional · ${phaseIndex + 1} de ${phaseSize}`
            : `Pregunta ${currentIndex + 1} de ${originalSessionSize}`}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/')}
          style={styles.exitButton}
        >
          <Text style={styles.exitText}>Salir</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
      </View>

      {inReinforcementPhase && (
        <Text style={styles.reinforcementNote}>Estas son preguntas que necesitan refuerzo.</Text>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.questionRow}>
          {/* Espaciador simétrico al botón: el enunciado queda centrado en la pantalla. */}
          <View style={styles.questionRowSpacer} />
          <Text style={styles.question}>{currentQuestion.question_en}</Text>
          <SpeakerButton text={currentQuestion.question_en} size="large" />
        </View>

        {!revealAnswer && (
          <View style={styles.answerBlock}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowHint((visible) => !visible)}
              style={styles.hintButton}
            >
              <Text style={styles.hintButtonText}>💡 Ver pista en español</Text>
            </Pressable>

            {showHint && <Text style={styles.hint}>{currentQuestion.question_es}</Text>}

            <Pressable
              accessibilityRole="button"
              onPress={() => setRevealAnswer(true)}
              style={styles.showAnswerButton}
            >
              <Text style={styles.showAnswerText}>Mostrar respuesta</Text>
            </Pressable>
          </View>
        )}

        {revealAnswer && (
          <View style={styles.answerBlock}>
            {currentQuestion.answers_en.length > 0 ? (
              currentQuestion.answers_en.length > MULTIPLE_ANSWERS_THRESHOLD ? (
                // Muchas respuestas válidas: cada una con su traducción justo debajo, para
                // no obligar a cruzar dos listas largas de idiomas distintos. Si pasan de
                // MAX_VISIBLE_ANSWERS solo se ven las primeras hasta que el usuario pulse
                // "Ver las N restantes".
                <View style={styles.answerBlock}>
                  <Text style={styles.multipleAnswersNote}>{answersHint}</Text>

                  {visibleAnswers.map((answer, index) => (
                    <View key={answer} style={styles.answerPair}>
                      <View style={styles.answerRow}>
                        <Text style={styles.answerEnMultiple}>• {answer}</Text>
                        <SpeakerButton text={answer} size="small" />
                      </View>
                      <Text style={styles.answerEsMultiple}>
                        {currentQuestion.answers_es[index]}
                      </Text>
                    </View>
                  ))}

                  {hiddenAnswersCount > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        expandedAnswers
                          ? 'Ocultar el resto de las respuestas'
                          : `Ver las ${hiddenAnswersCount} respuestas restantes`
                      }
                      onPress={() => setExpandedAnswers((expanded) => !expanded)}
                      style={styles.expandButton}
                    >
                      <Text style={styles.expandButtonText}>
                        {expandedAnswers
                          ? 'Ocultar ▲'
                          : `Ver las ${hiddenAnswersCount} restantes ▼`}
                      </Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <>
                  {/* Respuesta única: se anuncia como tal y cada texto lleva su voz. */}
                  <Text style={styles.multipleAnswersNote}>{answersHint}</Text>
                  {currentQuestion.answers_en.map((answer) => (
                    <View key={answer} style={styles.answerRow}>
                      <Text style={styles.answerEn}>• {answer}</Text>
                      <SpeakerButton text={answer} size="small" />
                    </View>
                  ))}
                  {currentQuestion.answers_es.map((answer) => (
                    <Text key={answer} style={styles.answerEs}>
                      • {answer}
                    </Text>
                  ))}
                </>
              )
            ) : (
              <>
                <Text style={styles.dynamicNote}>{DYNAMIC_ANSWER_NOTE}</Text>

                {/* Preguntas dinámicas: si el dato oficial está rellenado se muestra aquí, con
                    su fecha de actualización y su botón para escuchar la pronunciación. */}
                {officialValue !== null && (
                  <View style={styles.officialCard}>
                    <Text style={styles.officialLabel}>Respuesta actual:</Text>
                    <View style={styles.answerRow}>
                      <Text style={styles.officialValue}>{officialValue}</Text>
                      <SpeakerButton text={officialValue} size="small" />
                    </View>
                    <Text style={styles.officialUpdated}>
                      (Actualizado: {formatSpanishDate(OFFICIAL_DATA.lastUpdated)})
                    </Text>
                  </View>
                )}
              </>
            )}

            {currentQuestion.explanation_es !== '' && (
              <Text style={styles.explanation}>{currentQuestion.explanation_es}</Text>
            )}

            {currentQuestion.vocabulary.length > 0 && (
              <View style={styles.vocabulary}>
                {currentQuestion.vocabulary.map((item) => (
                  <View key={item.word} style={styles.vocabularyRow}>
                    <Text style={styles.vocabularyWord}>{item.word}</Text>
                    <SpeakerButton text={item.word} size="small" />
                    <Text style={styles.vocabularyTranslation}>{item.translation}</Text>
                  </View>
                ))}
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              onPress={() => handleAnswer(false)}
              style={[styles.answerButton, styles.reviewButton]}
            >
              <Text style={[styles.answerButtonText, styles.reviewButtonText]}>
                ❌ Necesito repasar
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => handleAnswer(true)}
              style={[styles.answerButton, styles.knewButton]}
            >
              <Text style={[styles.answerButtonText, styles.knewButtonText]}>✅ La sabía</Text>
            </Pressable>
          </View>
        )}
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
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#1a3a6b',
  },
  // Indicador de que la pregunta actual pertenece al repaso de refuerzo (FASE B).
  reinforcementNote: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
    marginHorizontal: 20,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  // El enunciado va en fila con su botón de voz. El espaciador de la izquierda tiene el
  // mismo ancho aproximado que el botón "large", así el texto queda centrado de verdad.
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  questionRowSpacer: {
    width: 46,
  },
  question: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a3a6b',
    textAlign: 'center',
    // Puede encogerse si el enunciado es largo: el botón nunca se aplasta.
    flexShrink: 1,
  },
  hintButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f2f5fa',
  },
  hintButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a3a6b',
  },
  hint: {
    fontSize: 15,
    color: '#888888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  showAnswerButton: {
    backgroundColor: '#1a3a6b',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  showAnswerText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  answerBlock: {
    gap: 10,
    marginTop: 4,
  },
  answerEn: {
    fontSize: 16,
    color: '#1f1f1f',
    flexShrink: 1,
  },
  // Fila de un texto en inglés con su SpeakerButton al lado.
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  answerEs: {
    fontSize: 15,
    color: '#666666',
  },
  multipleAnswersNote: {
    fontSize: 13,
    color: '#666666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  // "Ver las N restantes ▼" / "Ocultar ▲" de las preguntas con lista larga de respuestas.
  expandButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f4f9',
  },
  expandButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a3a6b',
  },
  answerPair: {
    gap: 2,
  },
  answerEnMultiple: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333333',
    flexShrink: 1,
  },
  answerEsMultiple: {
    fontSize: 13,
    color: '#888888',
    marginLeft: 8,
  },
  dynamicNote: {
    fontSize: 15,
    color: '#7a5c00',
    lineHeight: 21,
  },
  // Bloque destacado con la respuesta oficial vigente de las preguntas dinámicas.
  officialCard: {
    backgroundColor: '#f0f4f9',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  officialLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  officialValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a3a6b',
    flexShrink: 1,
  },
  officialUpdated: {
    fontSize: 12,
    color: '#888888',
    fontStyle: 'italic',
  },
  explanation: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },
  vocabulary: {
    gap: 6,
  },
  vocabularyRow: {
    flexDirection: 'row',
    // Centrado (y no `baseline`) porque ahora la fila incluye el botón 🔊 entre la palabra
    // y su traducción: con un Pressable la línea base no es fiable y descuadraba la fila.
    alignItems: 'center',
    gap: 8,
  },
  vocabularyWord: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  vocabularyTranslation: {
    fontSize: 14,
    color: '#555555',
    flexShrink: 1,
  },
  answerButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewButton: {
    backgroundColor: '#ffe5e5',
  },
  knewButton: {
    backgroundColor: '#e5f5e5',
  },
  answerButtonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  reviewButtonText: {
    color: '#c0392b',
  },
  knewButtonText: {
    color: '#2e7d32',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a3a6b',
    textAlign: 'center',
  },
  score: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  percentage: {
    fontSize: 42,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  requeueNote: {
    fontSize: 13,
    color: '#666666',
    fontStyle: 'italic',
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
});
