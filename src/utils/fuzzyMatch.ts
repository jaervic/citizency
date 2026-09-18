// src/utils/fuzzyMatch.ts
// Propósito: comparación difusa de respuestas habladas. Normaliza el texto
// reconocido (minúsculas, acentos, signos, números escritos) y lo compara con
// las respuestas oficiales aceptadas para decidir si la respuesta es correcta.
//
// API prevista (pendiente de implementar):
//   normalizeAnswer(text: string): string
//   similarity(expected: string, actual: string): number   // 0-1
//   isAnswerCorrect(question: Question, spoken: string, threshold?: number): boolean
//   extractNumbers(text: string): number[]                 // p. ej. "dieciocho" -> 18
//
// Placeholder sin implementación.
export {};
