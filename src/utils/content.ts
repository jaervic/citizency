// src/utils/content.ts
// Propósito: cargar el contenido oficial (`questions.json` y `officialData.json`) UNA sola vez,
// con los tipos ya afirmados, y resolver las respuestas de las 8 preguntas dinámicas: las 4
// nacionales (presidente, vicepresidente, speaker, chief justice) desde `officialData.json` y las
// 4 que dependen del estado del solicitante (senadores, representante, gobernador, capital) desde
// `stateOfficials.json`, usando el estado y el distrito que el usuario haya configurado.
import officialDataJson from '@/data/officialData.json';
import questionsJson from '@/data/questions.json';
import type { OfficialData, OfficialField, Question, QuestionsFile } from '@/types';
import { EMPTY_LOCATION, isStateField, resolveStateValues } from '@/utils/stateOfficials';
import type { Location } from '@/utils/stateOfficials';

// El JSON infiere `category`/`officialField` como `string`; se afirma el tipo una vez aquí.
const questionsFile = questionsJson as unknown as QuestionsFile;

/** Las 128 preguntas oficiales, en orden de examen. */
export const QUESTIONS: Question[] = questionsFile.questions;

/** Datos vigentes de los 4 cargos nacionales dinámicos. */
export const OFFICIAL_DATA: OfficialData = officialDataJson as OfficialData;

/**
 * Las 120 preguntas del examen de práctica con respuesta estática en `questions.json`. Es la base
 * que cubre el banco curado de distractores (`quizDistractors.json`). Para el examen real hay que
 * usar `buildQuizPool()`, que añade las preguntas dinámicas que se puedan corregir.
 */
export const QUIZ_POOL: Question[] = QUESTIONS.filter((question) => question.answers_en.length > 0);

/** Campos nacionales (no dependen del estado del solicitante). */
export const NATIONAL_FIELDS = ['president', 'vicePresident', 'speakerOfHouse', 'chiefJustice'] as const;

export type NationalField = (typeof NATIONAL_FIELDS)[number];

/** `true` si el campo es uno de los 4 cargos nacionales. */
export function isNationalField(field: OfficialField): field is NationalField {
  return field !== null && (NATIONAL_FIELDS as readonly string[]).includes(field);
}

/** Etiqueta en español de cada cargo de los que dependen las preguntas dinámicas. */
export const OFFICIAL_FIELD_LABEL: Record<Exclude<OfficialField, null>, string> = {
  senators: 'Senadores de tu estado',
  representative: 'Representante de tu distrito',
  governor: 'Gobernador de tu estado',
  capital: 'Capital de tu estado',
  speakerOfHouse: 'Presidente de la Cámara de Representantes',
  president: 'Presidente de los Estados Unidos',
  vicePresident: 'Vicepresidente de los Estados Unidos',
  chiefJustice: 'Presidente de la Corte Suprema',
};

/**
 * Respuestas esperadas de una pregunta dinámica:
 *   - estatales (senadores, representante, gobernador, capital) → según el estado/distrito del
 *     usuario; array vacío si todavía no los ha configurado;
 *   - nacionales (presidente, vicepresidente, speaker, chief justice) → el dato de
 *     `officialData.json`;
 *   - preguntas estáticas → array vacío.
 */
export function getOfficialValues(
  question: Question,
  official: OfficialData = OFFICIAL_DATA,
  location: Location = EMPTY_LOCATION,
): string[] {
  const field = question.officialField;

  if (field === null) {
    return [];
  }

  if (isStateField(field)) {
    return resolveStateValues(field, location);
  }

  if (isNationalField(field)) {
    const value = official[field];

    return value === null || value === undefined ? [] : [value];
  }

  return [];
}

/**
 * Respuestas aceptadas de una pregunta en inglés para corregirla: las de `questions.json` cuando
 * la pregunta es estática y, cuando es dinámica, el dato vigente (nacional o estatal). Devuelve un
 * array vacío si la pregunta no se puede corregir todavía (p. ej. falta configurar el estado).
 */
export function getAcceptedAnswers(
  question: Question,
  official: OfficialData = OFFICIAL_DATA,
  location: Location = EMPTY_LOCATION,
): string[] {
  if (question.answers_en.length > 0) {
    return question.answers_en;
  }

  return getOfficialValues(question, official, location);
}

/**
 * Preguntas aptas para el examen de práctica con una localización dada: las 120 estáticas, las 4
 * nacionales dinámicas (presidente, vicepresidente, speaker y chief justice, cuyo dato está en
 * `officialData.json`) y, si el usuario ha configurado su estado y su distrito, las 4 que dependen
 * de ellos. En total, entre 124 y 128 preguntas.
 */
export function buildQuizPool(
  location: Location = EMPTY_LOCATION,
  official: OfficialData = OFFICIAL_DATA,
): Question[] {
  return QUESTIONS.filter((question) => getAcceptedAnswers(question, official, location).length > 0);
}
