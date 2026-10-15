// src/constants.ts
// Propósito: valores de configuración de la app en un único sitio, para que ninguna
// pantalla repita números mágicos. Los que son reglas del producto están comentados.

/** Preguntas de cada sesión de estudio (flashcards). */
export const FLASHCARD_SESSION_SIZE = 20;

/** Preguntas del examen de práctica (quiz). */
export const QUIZ_SIZE = 20;

/** Aciertos mínimos para aprobar el examen de práctica (12/20, el 60 %). */
export const PASS_THRESHOLD = 12;

/** Preguntas del simulacro de entrevista. */
export const INTERVIEW_SIZE = 5;

/** Umbral de similitud con el que la entrevista da una respuesta hablada por válida. */
export const INTERVIEW_MATCH_THRESHOLD = 0.75;
