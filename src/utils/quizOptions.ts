// src/utils/quizOptions.ts
// Propósito: construir las 4 opciones (1 correcta + 3 distractores) de una pregunta del examen de
// práctica.
//
// La correcta es la primera respuesta aceptada: para las 120 preguntas estáticas es
// `answers_en[0]` (en `questions.json` las más comunes van primero) y para las 4 que dependen del
// estado del solicitante es el dato vigente de su estado/distrito (`stateOfficials.json`).
//
// Los distractores salen, por este orden, de:
//   1. El banco curado a mano `src/data/quizDistractors.json` (una entrada por pregunta estática):
//      plausibles pero inequívocamente incorrectos y del mismo tipo que la respuesta.
//   2. Para las preguntas estatales, valores del MISMO campo en OTROS estados (otro gobernador,
//      otra capital…): igual de plausibles y claramente incorrectos.
//   3. Un respaldo heurístico con respuestas de otras preguntas del examen, por si algún día falta
//      contenido. Garantiza que el examen nunca se rompa.
import quizDistractorsJson from '@/data/quizDistractors.json';
import type { Category, OfficialData, Question } from '@/types';
import {
  NATIONAL_FIELDS,
  OFFICIAL_DATA,
  getAcceptedAnswers,
  isNationalField,
} from '@/utils/content';
import type { NationalField } from '@/utils/content';
import { EMPTY_LOCATION, isStateField, otherStateValues } from '@/utils/stateOfficials';
import type { Location } from '@/utils/stateOfficials';

/** Una opción del multiple choice. */
export type QuizOption = {
  /** Id estable dentro del examen (p. ej. "gov-001-correct"). */
  id: string;
  /** Texto en inglés: es lo que se pregunta. */
  en: string;
  /** Traducción al español; en las respuestas que son nombres propios coincide con `en`. */
  es: string;
  /** `true` en la única opción correcta. */
  isCorrect: boolean;
};

/** Opciones por pregunta: 1 correcta + 3 distractores. */
export const OPTIONS_PER_QUESTION = 4;
/** Distractores que hay que reunir por pregunta. */
const DISTRACTORS_PER_QUESTION = OPTIONS_PER_QUESTION - 1;

/** Respuesta candidata a distractor, con la categoría de origen. */
type AnswerPair = {
  en: string;
  es: string;
  category: Category;
};

/** Forma del banco curado cargado desde JSON. */
type DistractorBank = Record<string, { en: string[]; es: string[] }>;

const CURATED_DISTRACTORS = quizDistractorsJson as DistractorBank;

/** Fuente de aleatoriedad inyectable (pruebas deterministas). */
export type RandomSource = () => number;

/** Texto normalizado para comparar opciones (minúsculas y sin espacios de más). */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Mezcla una copia del array (Fisher-Yates); no muta el original. */
function shuffle<T>(items: T[], random: RandomSource = Math.random): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = current;
  }

  return result;
}

/** Número de palabras de un texto (los signos cuentan como separadores). */
function countWords(text: string): number {
  return text
    .replace(/[^A-Za-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Distractores de respaldo: las respuestas aceptadas del resto del examen, ordenadas por cercanía
 * de longitud a la correcta y con la misma categoría primero.
 */
function heuristicCandidates(
  question: Question,
  quizPool: Question[],
  location: Location,
  official: OfficialData,
): AnswerPair[] {
  const bank: AnswerPair[] = quizPool.flatMap((item) =>
    getAcceptedAnswers(item, official, location).map((en, index) => ({
      en,
      es: item.answers_es[index] ?? en,
      category: item.category,
    })),
  );

  const correctEn = getAcceptedAnswers(question, official, location)[0] ?? '';
  const correctWords = countWords(correctEn);
  const byDelta = (a: AnswerPair, b: AnswerPair): number =>
    Math.abs(countWords(a.en) - correctWords) - Math.abs(countWords(b.en) - correctWords);

  const sameCategory = bank.filter((answer) => answer.category === question.category).sort(byDelta);
  const otherCategories = bank.filter((answer) => answer.category !== question.category).sort(byDelta);

  return [...sameCategory, ...otherCategories];
}

/**
 * Los otros tres cargos nacionales vigentes. Sirven como distractores de las 4 preguntas
 * nacionales dinámicas: son personas reales del gobierno (plausibles) pero la respuesta a "¿quién
 * es el presidente ahora?" no puede ser el vicepresidente ni el speaker.
 *
 * Se derivan de `officialData.json` en vez de escribirlos a mano para que no se queden viejos
 * cuando cambie el gobierno.
 */
function otherNationalValues(field: NationalField, official: OfficialData): string[] {
  return NATIONAL_FIELDS.filter((candidate) => candidate !== field)
    .map((candidate) => official[candidate])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/** Parámetros de `buildQuizOptions`. */
export type BuildQuizOptionsParams = {
  /** Pregunta a la que construirle las opciones. */
  question: Question;
  /** Preguntas aptas del examen (fuente del respaldo heurístico). */
  quizPool: Question[];
  /** Estado y distrito del usuario (resuelven las preguntas estatales). */
  location?: Location;
  /** Datos de los cargos nacionales. */
  official?: OfficialData;
  /** Fuente de aleatoriedad (por defecto `Math.random`). */
  random?: RandomSource;
};

/**
 * Opciones de una pregunta: 1 correcta + 3 distractores, barajadas.
 *
 * Garantiza SIEMPRE 4 opciones (se completa con el respaldo heurístico), así que el examen nunca
 * se rompe aunque cambie el contenido.
 */
export function buildQuizOptions({
  question,
  quizPool,
  location = EMPTY_LOCATION,
  official = OFFICIAL_DATA,
  random = Math.random,
}: BuildQuizOptionsParams): QuizOption[] {
  const accepted = getAcceptedAnswers(question, official, location);
  const correctEn = accepted[0] ?? '';
  const correctEs = question.answers_es[0] ?? correctEn;

  // Ninguna respuesta aceptada de esta pregunta puede aparecer como opción incorrecta.
  const usedEn = new Set(accepted.map(normalize));
  const usedEs = new Set(question.answers_es.map(normalize));

  const distractors: AnswerPair[] = [];

  const tryPush = (pair: AnswerPair): void => {
    if (distractors.length >= DISTRACTORS_PER_QUESTION) {
      return;
    }

    const en = normalize(pair.en);
    const es = normalize(pair.es);

    if (en === '' || usedEn.has(en) || usedEs.has(es)) {
      return;
    }

    usedEn.add(en);
    usedEs.add(es);
    distractors.push(pair);
  };

  // 1) Banco curado (no hay entradas para las 4 preguntas estatales).
  const curated = CURATED_DISTRACTORS[question.id];
  if (curated !== undefined) {
    const curatedPairs: AnswerPair[] = curated.en.map((en, index) => ({
      en,
      es: curated.es[index] ?? en,
      category: question.category,
    }));

    for (const pair of shuffle(curatedPairs, random)) {
      tryPush(pair);
    }
  }

  // 2) Preguntas estatales: valores del mismo campo en otros estados.
  if (isStateField(question.officialField)) {
    const candidates = shuffle(otherStateValues(question.officialField, location), random);

    for (const value of candidates) {
      tryPush({ en: value, es: value, category: question.category });
    }
  }

  // 2 bis) Preguntas nacionales dinámicas: los otros tres cargos nacionales.
  if (isNationalField(question.officialField)) {
    const candidates = shuffle(otherNationalValues(question.officialField, official), random);

    for (const value of candidates) {
      tryPush({ en: value, es: value, category: question.category });
    }
  }

  // 3) Respaldo heurístico para lo que falte.
  for (const pair of heuristicCandidates(question, quizPool, location, official)) {
    tryPush(pair);
  }

  const options: QuizOption[] = [
    { id: `${question.id}-correct`, en: correctEn, es: correctEs, isCorrect: true },
    ...distractors.map((distractor, index) => ({
      id: `${question.id}-opt-${index}`,
      en: distractor.en,
      es: distractor.es,
      isCorrect: false,
    })),
  ];

  return shuffle(options, random);
}
