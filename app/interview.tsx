// app/interview.tsx
// Propósito: simulacro de entrevista de Fase 6. La respuesta principal es HABLADA: el usuario toca
// "🎤 Responder", `useSpeechRecognition` transcribe en vivo (Web Speech API en web, motor del
// sistema en Android) y el texto cae en el TextInput, donde puede corregirlo antes de comprobar.
// El TextInput se queda como alternativa para escribir a mano (y es la única vía si el dispositivo
// no tiene motor de voz).
//
// Cinco preguntas al azar del mismo pool de 120 que usa quiz.tsx (las que tienen respuesta
// estática), excluyendo además las que dependen del estado del solicitante. `fuzzyMatch` decide si
// la respuesta vale (umbral 0.75). Cada respuesta comprobada se registra en el store con
// `recordAnswer` (XP + racha del día) y se guarda en `sessionItems` para reutilizar `SessionReview`.
//
// Textos de UI en español; enunciados y respuestas en inglés (la entrevista del USCIS es en
// inglés). La comparación la hace `fuzzyMatch` de principio a fin: aquí no se normaliza nada a mano.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AnswerFeedback from '@/components/AnswerFeedback';
import SessionReview from '@/components/SessionReview';
import type { SessionReviewFilter, SessionReviewItem } from '@/components/SessionReview';
import SpeakerButton from '@/components/SpeakerButton';
import questionsJson from '@/data/questions.json';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useStore } from '@/store/useStore';
import { colors } from '@/theme';
import type { Question, QuestionsFile } from '@/types';
import { fuzzyMatch } from '@/utils/fuzzyMatch';
import type { FuzzyMatchResult } from '@/utils/fuzzyMatch';

/** Las 128 preguntas oficiales (el import de JSON ensancha los tipos: se afirma). */
const QUESTIONS: Question[] = (questionsJson as QuestionsFile).questions;

/** Preguntas por simulacro: corto a propósito, un simulacro no es el examen completo de 20. */
const INTERVIEW_SIZE = 5;

/**
 * Pool del simulacro: las mismas 120 preguntas aptas que usa quiz.tsx (las que tienen respuesta
 * estática) MENOS las que dependen del estado del solicitante (`stateSpecific`), que no se pueden
 * validar sin saber en qué estado vive el usuario.
 *
 * Ojo: hoy esas 4 (`gov-023`, `gov-029`, `gov-061`, `gov-062`) ya quedan fuera por el primer
 * filtro, porque su `answers_en` está vacío; el segundo filtro se deja explícito para que no se
 * cuelen si algún día se rellenan sus respuestas. Las 4 dinámicas restantes (`gov-030`, `gov-038`,
 * `gov-039`, `gov-057`) también quedan fuera por no tener respuesta estática: su texto depende de
 * `officialData.json`, que la entrevista no consulta.
 */
const INTERVIEW_POOL: Question[] = QUESTIONS.filter(
  (question) => question.answers_en.length > 0 && !question.stateSpecific,
);

/** Fase de la pantalla: sesión en curso o resultados. */
type Phase = 'session' | 'results';

/**
 * Mezcla una copia del array (Fisher-Yates); no muta el original.
 *
 * Es una COPIA deliberada de la de `app/quiz.tsx`: el repo todavía no tiene una carpeta de
 * utilidades UI compartidas y dos usos no justifican la abstracción. Cuando un tercer archivo la
 * necesite se moverá a `src/utils/` y se borrarán las copias (entonces sí se tocará quiz.tsx).
 */
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

/** Cola del simulacro: `INTERVIEW_SIZE` preguntas al azar; si el pool fuera más corto, todas. */
function buildInterviewQueue(): Question[] {
  return shuffle(INTERVIEW_POOL).slice(0, INTERVIEW_SIZE);
}

export default function InterviewScreen() {
  const router = useRouter();

  // El progreso se persiste en AsyncStorage (asíncrono): hasta que Zustand hidrata, el estado en
  // memoria está vacío. Por eso la primera cola se construye DESPUÉS de la hidratación, igual que
  // en flashcards.tsx.
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>('session');
  const [queue, setQueue] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  // Resultado de la comprobación actual: `null` mientras no se ha pulsado "Comprobar".
  const [lastResult, setLastResult] = useState<FuzzyMatchResult | null>(null);
  // Intentos del simulacro en orden cronológico, para la vista de revisión de los resultados.
  const [sessionItems, setSessionItems] = useState<SessionReviewItem[]>([]);
  const [correctCount, setCorrectCount] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<SessionReviewFilter>('all');

  // Reconocimiento de voz: es la vía principal de respuesta. El TextInput sigue debajo como
  // alternativa (y para corregir a mano lo que transcriba el motor).
  const {
    state: speechState,
    transcript: speechTranscript,
    isAvailable: isSpeechAvailable,
    error: speechError,
    start: startSpeech,
    stop: stopSpeech,
    reset: resetSpeech,
  } = useSpeechRecognition();

  // Foco del campo de texto: lo usa el enlace "o escribe tu respuesta".
  const inputRef = useRef<TextInput>(null);
  // Último texto que la voz volcó al campo, para saber si el usuario lo editó a mano después.
  const lastSyncedTranscriptRef = useRef('');
  // Espejo del campo: el efecto de sincronización lo lee sin tener `userAnswer` entre sus
  // dependencias (si no, se dispararía con cada tecla y pisaría lo que el usuario escribe).
  const userAnswerRef = useRef('');

  // Hidratación: si ya terminó se rellena la cola; si no, se espera al evento.
  // `onFinishHydration` devuelve su propia función de cancelación (cleanup del efecto).
  useEffect(() => {
    const fillQueueFromHydratedProgress = () => {
      setQueue(buildInterviewQueue());
      setHydrated(true);
    };

    if (useStore.persist.hasHydrated()) {
      fillQueueFromHydratedProgress();
      return;
    }

    return useStore.persist.onFinishHydration(fillQueueFromHydratedProgress);
  }, []);

  // Voz -> campo: cada transcripción nueva se vuelca al TextInput, tanto las parciales mientras
  // escucha como la final (que el motor emite junto al paso a 'idle'). Si el usuario ya editó el
  // texto a mano, su versión manda y no se pisa.
  useEffect(() => {
    if (speechTranscript === lastSyncedTranscriptRef.current) {
      return;
    }

    const fieldIsUntouched = userAnswerRef.current === lastSyncedTranscriptRef.current;

    if (speechState === 'listening' || fieldIsUntouched) {
      lastSyncedTranscriptRef.current = speechTranscript;
      userAnswerRef.current = speechTranscript;
      setUserAnswer(speechTranscript);
    }
  }, [speechState, speechTranscript]);

  const currentQuestion: Question | undefined = queue[currentIndex];
  // Última pregunta del simulacro: el botón de avance pasa a "Ver resultados".
  const isLastQuestion = currentIndex + 1 >= queue.length;
  // El botón de comprobar solo se activa con algo escrito (los espacios no cuentan) y cuando el
  // micrófono no está trabajando: no tiene sentido comprobar mientras se graba o se procesa.
  const canCheck =
    userAnswer.trim() !== '' && speechState !== 'listening' && speechState !== 'processing';

  /** Confirma antes de abandonar la entrevista en curso (mismo patrón que flashcards.tsx). */
  const handleExit = useCallback(() => {
    Alert.alert(
      'Salir de la entrevista',
      '¿Estás seguro? Perderás el progreso de esta entrevista.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir', style: 'destructive', onPress: () => router.push('/') },
      ],
    );
  }, [router]);

  /** Guarda en el campo (y en su espejo) lo que teclea el usuario. */
  const handleChangeAnswer = useCallback((text: string) => {
    userAnswerRef.current = text;
    setUserAnswer(text);
  }, []);

  /** Limpia el campo y los espejos de sincronización de voz (al cambiar de pregunta o reiniciar). */
  const clearAnswer = useCallback(() => {
    userAnswerRef.current = '';
    lastSyncedTranscriptRef.current = '';
    setUserAnswer('');
  }, []);

  /** Arranca la escucha (la promesa no se espera: el hook lo refleja todo en su estado). */
  const handleStartSpeech = useCallback(() => {
    void startSpeech();
  }, [startSpeech]);

  /** Detiene la escucha y deja que llegue el resultado final del motor. */
  const handleStopSpeech = useCallback(() => {
    void stopSpeech();
  }, [stopSpeech]);

  /** Lleva el foco al campo de texto: la alternativa al micrófono. */
  const focusAnswerInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  /** Valida la respuesta escrita con `fuzzyMatch` y registra el intento en el store y la sesión. */
  const handleCheck = useCallback(() => {
    if (currentQuestion === undefined || !canCheck) {
      return;
    }

    const result = fuzzyMatch(userAnswer, currentQuestion.answers_en);

    setLastResult(result);

    if (result.matched) {
      setCorrectCount((count) => count + 1);
    }

    // Igual que en quiz.tsx: cada intento cuenta para el progreso (XP) y para la racha del día.
    useStore.getState().recordAnswer(currentQuestion.id, result.matched);

    setSessionItems((items) => [
      ...items,
      { question: currentQuestion, wasCorrect: result.matched, userChoice: userAnswer },
    ]);
  }, [canCheck, currentQuestion, userAnswer]);

  /** Pasa a la siguiente pregunta, o a los resultados si era la última. */
  const handleNext = useCallback(() => {
    if (isLastQuestion) {
      setPhase('results');
      return;
    }

    setCurrentIndex((index) => index + 1);
    clearAnswer();
    resetSpeech();
    setLastResult(null);
  }, [clearAnswer, isLastQuestion, resetSpeech]);

  /** Nuevo simulacro: cola nueva al azar y todos los estados de sesión reseteados. */
  const handleRestart = useCallback(() => {
    setQueue(buildInterviewQueue());
    setCurrentIndex(0);
    clearAnswer();
    resetSpeech();
    setLastResult(null);
    setSessionItems([]);
    setCorrectCount(0);
    setPhase('session');
    setReviewFilter('all');
  }, [clearAnswer, resetSpeech]);

  // Mientras el progreso persistido no esté hidratado no se puede construir la cola.
  if (!hydrated) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Pool vacío (no ocurre con el JSON actual): se avisa en lugar de dejar la pantalla en blanco.
  if (queue.length === 0 || currentQuestion === undefined) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>No hay preguntas disponibles para la entrevista.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Ir al inicio</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (phase === 'results') {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <View style={styles.resultsHeader}>
          <Text style={styles.title}>Entrevista completada</Text>
          <Text style={styles.resultsSummary}>
            Aciertos: {correctCount} de {queue.length}
          </Text>
        </View>

        <SessionReview
          items={sessionItems}
          filter={reviewFilter}
          onFilterChange={setReviewFilter}
          showFilter
        />

        {/* Pie fijo: las dos salidas del simulacro quedan siempre a la vista. */}
        <View style={styles.resultsFooter}>
          <Pressable accessibilityRole="button" onPress={handleRestart} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Nuevo simulacro</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/')}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Ir al inicio</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.topBar}>
        <Text style={styles.counter}>
          Pregunta {currentIndex + 1} de {queue.length}
        </Text>
        <Pressable accessibilityRole="button" onPress={handleExit} style={styles.exitButton}>
          <Text style={styles.exitText}>Salir</Text>
        </Pressable>
      </View>

      {/* En Android el modo 'resize' ya deja ver el campo; en iOS hay que empujar el contenido. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.questionRow}>
            <Text style={styles.questionEn}>{currentQuestion.question_en}</Text>
            <SpeakerButton text={currentQuestion.question_en} size="small" />
          </View>

          {/* Respuesta por voz (vía principal). El bloque cambia por completo según el hook. */}
          {!isSpeechAvailable && (
            <Text style={styles.speechUnavailable}>
              El dictado por voz no está disponible en este dispositivo.
            </Text>
          )}

          {isSpeechAvailable && speechState === 'error' && (
            <View style={styles.speechError}>
              <Text style={styles.speechErrorText}>
                {speechError ?? 'No se pudo usar el micrófono.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={resetSpeech}
                style={styles.speechRetryButton}
              >
                <Text style={styles.speechRetryText}>Reintentar</Text>
              </Pressable>
            </View>
          )}

          {isSpeechAvailable && speechState === 'listening' && (
            <View style={styles.speechBlock}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Detener la grabación"
                onPress={handleStopSpeech}
                style={[styles.speechButton, styles.speechButtonStop]}
              >
                <Text style={styles.speechButtonText}>⏹ Detener</Text>
              </Pressable>
              <Text style={styles.speechStatus}>🎤 Escuchando…</Text>
            </View>
          )}

          {isSpeechAvailable && speechState === 'processing' && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel="Procesando tu respuesta"
              disabled
              style={[styles.speechButton, styles.speechButtonProcessing]}
            >
              <ActivityIndicator size="small" color={colors.onPrimary} />
              <Text style={styles.speechButtonText}>Procesando…</Text>
            </Pressable>
          )}

          {isSpeechAvailable && speechState === 'idle' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Responder con voz"
              onPress={handleStartSpeech}
              style={[styles.speechButton, styles.speechButtonStart]}
            >
              <Text style={styles.speechButtonText}>🎤 Responder</Text>
            </Pressable>
          )}

          {/* El campo sigue siendo la alternativa: se puede corregir lo transcrito o escribir a mano. */}
          {isSpeechAvailable && speechState === 'idle' && (
            <Pressable
              accessibilityRole="button"
              onPress={focusAnswerInput}
              style={styles.keyboardLink}
            >
              <Text style={styles.keyboardLinkText}>o escribe tu respuesta</Text>
            </Pressable>
          )}

          <TextInput
            ref={inputRef}
            value={userAnswer}
            onChangeText={handleChangeAnswer}
            editable={lastResult === null}
            multiline
            placeholder="Escribe lo que dirías en la entrevista…"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="sentences"
            style={[styles.input, lastResult !== null && styles.inputLocked]}
          />

          {lastResult !== null && (
            <AnswerFeedback
              state={lastResult.matched ? 'correct' : 'incorrect'}
              score={lastResult.score}
              correctAnswer={currentQuestion.answers_en[0] ?? ''}
              userAnswer={userAnswer}
            />
          )}

          {lastResult === null ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canCheck }}
              disabled={!canCheck}
              onPress={handleCheck}
              style={[styles.primaryButton, !canCheck && styles.primaryButtonDisabled]}
            >
              <Text style={styles.primaryButtonText}>Comprobar</Text>
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" onPress={handleNext} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                {isLastQuestion ? 'Ver resultados' : 'Siguiente'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  // Necesario para que el KeyboardAvoidingView ocupe todo el alto disponible.
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: colors.surface,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
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
    color: colors.primary,
  },
  exitButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exitText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  // Enunciado y su botón 🔊 en fila, como en flashcards.
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  questionEn: {
    flexShrink: 1,
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 27,
  },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    // Android: sin esto el texto de un multilinea arranca centrado verticalmente.
    textAlignVertical: 'top',
  },
  inputLocked: {
    backgroundColor: colors.background,
    color: colors.textSecondary,
  },
  // Bloque de respuesta por voz: mismo alto y forma que los botones principales, con el color
  // según el estado que reporta `useSpeechRecognition`.
  speechBlock: {
    gap: 6,
  },
  speechButton: {
    alignSelf: 'stretch',
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  speechButtonStart: {
    backgroundColor: colors.primary,
  },
  speechButtonStop: {
    backgroundColor: colors.error,
  },
  // Gris y deshabilitado mientras el motor entrega el resultado final.
  speechButtonProcessing: {
    backgroundColor: colors.textMuted,
  },
  speechButtonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  speechStatus: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Sin motor de voz: se avisa y se sigue con el teclado (no se pinta el botón 🎤).
  speechUnavailable: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  // Error de voz: fondo claro con borde, texto y botón en el color de aviso de la paleta.
  speechError: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  speechErrorText: {
    fontSize: 14,
    color: colors.warning,
    lineHeight: 20,
  },
  speechRetryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  speechRetryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },
  keyboardLink: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  keyboardLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  // Deshabilitado: se atenúa el botón entero en vez de cambiar el color del texto.
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 17,
    fontWeight: '700',
  },
  resultsHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
  },
  resultsSummary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resultsFooter: {
    padding: 20,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

