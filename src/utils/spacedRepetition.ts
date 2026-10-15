// src/utils/spacedRepetition.ts
// Propósito: decidir el orden de estudio de las 128 preguntas garantizando que el
// usuario las vea TODAS hasta dominarlas. Combina aciertos, fallos y el tiempo
// transcurrido desde el último repaso. Sin dependencias externas.

import type { Category, Question, UserProgress } from '@/types';

/** Prioridad de una pregunta que el usuario nunca ha visto. */
const NEW_QUESTION_PRIORITY = 100;
/** Puntos que suma cada fallo (sube la prioridad). */
const INCORRECT_WEIGHT = 10;
/** Puntos que resta cada acierto (baja la prioridad). */
const CORRECT_WEIGHT = 5;
/** Días sin ver la pregunta que aportan el máximo factor de tiempo (+30). */
const MAX_TIME_FACTOR_DAYS = 30;
/** Aciertos seguidos necesarios para considerar una pregunta dominada. */
const MASTERY_CORRECT_STREAK = 3;
/** Preguntas devueltas por defecto en la cola de estudio. */
const DEFAULT_QUEUE_LIMIT = 20;
const MS_PER_DAY = 86_400_000;

/** Nivel de dominio de una pregunta. */
export type MasteryLevel = 'new' | 'learning' | 'reviewing' | 'mastered';

/** Opciones de `buildStudyQueue`. */
export type StudyQueueOptions = {
  /** Máximo de preguntas a devolver (por defecto 20; usa Infinity para todas). */
  limit?: number;
  /** Filtra por categoría oficial. */
  category?: Category;
  /** Solo preguntas elegibles para la exención 65/20. */
  only65_20?: boolean;
  /** Solo preguntas que el usuario ha fallado alguna vez (incorrect > 0). */
  onlyPending?: boolean;
  /**
   * Excluye las preguntas ya dominadas (`getMasteryLevel` devuelve `mastered`:
   * 3 aciertos seguidos sin fallos pendientes). Con esta opción la cola puede
   * quedar vacía: eso significa que no queda nada por repasar.
   */
  excludeMastered?: boolean;
  /** Instante de referencia para el cálculo de prioridades (útil en pruebas). */
  now?: Date;
  /**
   * Fuente de aleatoriedad (por defecto `Math.random`). Solo se usa para barajar las
   * preguntas que empatan en prioridad: sin esto, un usuario nuevo recibe siempre las
   * mismas 20 preguntas en el orden oficial del examen. Inyectarla permite pruebas
   * deterministas.
   */
  random?: () => number;
};

/** Progreso agregado de una categoría (para la pantalla de progreso). */
export type CategoryProgress = {
  total: number;
  mastered: number;
  learning: number;
  new: number;
};

/** Estadísticas de una pregunta tal y como se guardan en `UserProgress`. */
type AnswerStats = UserProgress['answeredQuestions'][string];

/**
 * Categorías oficiales del examen. El tipo `Record<Category, true>` obliga al
 * compilador a avisar si alguna categoría de la union dejara de estar listada.
 */
const CATEGORY_INDEX: Record<Category, true> = {
  'Principios del gobierno estadounidense': true,
  'Sistema de gobierno': true,
  'Derechos y responsabilidades': true,
  'Período colonial e independencia': true,
  'Los años 1800': true,
  'Historia estadounidense reciente': true,
  'Símbolos y días festivos': true,
};

/** Las 7 categorías oficiales en un array. */
const ALL_CATEGORIES = Object.keys(CATEGORY_INDEX) as Category[];

/** Marca de tiempo ISO 8601 completa (fecha y hora, UTC) de un instante. */
function toIsoTimestamp(date: Date): string {
  return date.toISOString();
}

/** Días completos de 24 h transcurridos desde una fecha ISO; 0 si es inválida o futura. */
function daysSince(isoDate: string, now: Date): number {
  const timestamp = Date.parse(isoDate);

  if (Number.isNaN(timestamp)) {
    return 0;
  }

  const days = Math.floor((now.getTime() - timestamp) / MS_PER_DAY);
  return days > 0 ? days : 0;
}

/** Estadísticas de una pregunta, o `undefined` si nunca se ha visto. */
function getStats(progress: UserProgress, questionId: string): AnswerStats | undefined {
  return progress.answeredQuestions[questionId];
}

/**
 * Baraja (Fisher-Yates) cada tramo de elementos consecutivos con la MISMA prioridad, sin
 * alterar el orden entre prioridades distintas. `Array.prototype.sort` es estable, así que
 * sin este paso los empates (p. ej. todas las preguntas nuevas valen 100) conservarían el
 * orden del JSON y la primera sesión sería siempre la misma.
 */
function shuffleEqualPriorities<T extends { priority: number }>(
  items: T[],
  random: () => number,
): T[] {
  const result = [...items];
  let start = 0;

  while (start < result.length) {
    let end = start + 1;

    while (end < result.length && result[end].priority === result[start].priority) {
      end += 1;
    }

    for (let index = end - 1; index > start; index -= 1) {
      const swapIndex = start + Math.floor(random() * (index - start + 1));
      const current = result[index];
      result[index] = result[swapIndex];
      result[swapIndex] = current;
    }

    start = end;
  }

  return result;
}

/**
 * Calcula la prioridad de una pregunta: cuanto mayor es el número, antes debe
 * aparecer. Una pregunta nunca vista vale 100. Si ya se ha visto:
 * `(incorrect * 10) - (correct * 5) + días sin verla (máximo +30)`.
 * Un fallo pesa más que un acierto, así que las preguntas problemáticas suben y
 * las dominadas bajan (incluso a valores negativos).
 * @param progress Progreso actual del usuario.
 * @param questionId Id de la pregunta (p. ej. "gov-001").
 * @param now Instante de referencia para el factor de tiempo.
 */
export function calculatePriority(
  progress: UserProgress,
  questionId: string,
  now: Date = new Date(),
): number {
  const stats = getStats(progress, questionId);

  if (!stats) {
    return NEW_QUESTION_PRIORITY;
  }

  const timeFactor = Math.min(daysSince(stats.lastSeen, now), MAX_TIME_FACTOR_DAYS);

  return stats.incorrect * INCORRECT_WEIGHT - stats.correct * CORRECT_WEIGHT + timeFactor;
}

/**
 * Construye la cola de estudio ordenada por prioridad descendente.
 * Los empates conservan el orden de entrada (numeración oficial del examen),
 * porque `Array.prototype.sort` es estable. Con `excludeMastered: true` solo
 * devuelve preguntas sin dominar, de modo que un array vacío significa que el
 * usuario ya domina todas las preguntas candidatas.
 * @param questions Preguntas candidatas (normalmente las 128).
 * @param progress Progreso actual del usuario.
 * @param options Límite, filtros, exclusión de dominadas y referencia temporal.
 * @returns Nuevo array ordenado por prioridad; no muta `questions`.
 */
export function buildStudyQueue(
  questions: Question[],
  progress: UserProgress,
  options: StudyQueueOptions = {},
): Question[] {
  const {
    limit = DEFAULT_QUEUE_LIMIT,
    category,
    only65_20,
    onlyPending,
    excludeMastered,
    now = new Date(),
    random = Math.random,
  } = options;

  const filtered = questions.filter((question) => {
    if (category !== undefined && question.category !== category) {
      return false;
    }
    if (only65_20 === true && !question.is_65_20) {
      return false;
    }
    if (onlyPending === true) {
      const stats = getStats(progress, question.id);
      if (!stats || stats.incorrect <= 0) {
        return false;
      }
    }
    // Las dominadas se descartan con `excludeMastered` (función declarada más
    // abajo; las declaraciones de función se elevan, así que es seguro llamarla).
    if (excludeMastered === true && getMasteryLevel(progress, question.id) === 'mastered') {
      return false;
    }
    return true;
  });

  const scored = filtered.map((question) => ({
    question,
    priority: calculatePriority(progress, question.id, now),
  }));

  scored.sort((a, b) => b.priority - a.priority);

  const max = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : scored.length;

  return shuffleEqualPriorities(scored, random)
    .slice(0, max)
    .map((item) => item.question);
}

/**
 * Registra el resultado de un intento y devuelve un NUEVO `UserProgress`
 * (no muta el original). Con un acierto sube `correct`, y al llegar a 3 aciertos
 * se resetea `incorrect` (la pregunta pasa a considerarse dominada). Con un fallo
 * sube `incorrect` y se resetea `correct`. Siempre actualiza `lastSeen` con la
 * marca de tiempo ISO actual. No modifica `xp`, `streak` ni `lastStudyDate`.
 * @param progress Progreso actual del usuario.
 * @param questionId Id de la pregunta respondida.
 * @param wasCorrect `true` si el usuario acertó.
 * @param now Instante de la respuesta.
 */
export function recordAnswer(
  progress: UserProgress,
  questionId: string,
  wasCorrect: boolean,
  now: Date = new Date(),
): UserProgress {
  const stats = getStats(progress, questionId);
  const correct = stats ? stats.correct : 0;
  const incorrect = stats ? stats.incorrect : 0;
  const lastSeen = toIsoTimestamp(now);

  const nextStats: AnswerStats = wasCorrect
    ? {
        correct: correct + 1,
        incorrect: correct + 1 >= MASTERY_CORRECT_STREAK ? 0 : incorrect,
        lastSeen,
      }
    : { correct: 0, incorrect: incorrect + 1, lastSeen };

  return {
    ...progress,
    answeredQuestions: { ...progress.answeredQuestions, [questionId]: nextStats },
  };
}

/**
 * Nivel de dominio de una pregunta: `new` si nunca se ha visto, `learning` si
 * tiene algún fallo pendiente, `reviewing` con 1 o 2 aciertos seguidos y
 * `mastered` a partir de 3 aciertos.
 * @param progress Progreso actual del usuario.
 * @param questionId Id de la pregunta.
 */
export function getMasteryLevel(progress: UserProgress, questionId: string): MasteryLevel {
  const stats = getStats(progress, questionId);

  if (!stats) {
    return 'new';
  }
  if (stats.incorrect > 0) {
    return 'learning';
  }
  if (stats.correct >= MASTERY_CORRECT_STREAK) {
    return 'mastered';
  }
  if (stats.correct >= 1) {
    return 'reviewing';
  }
  return 'new';
}

/**
 * Agrupa el progreso por categoría oficial. `mastered` cuenta las dominadas,
 * `new` las nunca vistas y `learning` todo lo intermedio (`learning` y
 * `reviewing`), de modo que `total = mastered + learning + new`. Siempre
 * devuelve las 7 categorías, aunque el array recibido esté filtrado.
 * @param questions Preguntas a analizar (puede ser un subconjunto).
 * @param progress Progreso actual del usuario.
 */
export function getCategoryProgress(
  questions: Question[],
  progress: UserProgress,
): Record<Category, CategoryProgress> {
  const result = {} as Record<Category, CategoryProgress>;

  for (const category of ALL_CATEGORIES) {
    result[category] = { total: 0, mastered: 0, learning: 0, new: 0 };
  }

  for (const question of questions) {
    const bucket = result[question.category];
    const level = getMasteryLevel(progress, question.id);

    bucket.total += 1;

    if (level === 'mastered') {
      bucket.mastered += 1;
    } else if (level === 'new') {
      bucket.new += 1;
    } else {
      bucket.learning += 1;
    }
  }

  return result;
}
