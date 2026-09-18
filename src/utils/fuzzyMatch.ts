// src/utils/fuzzyMatch.ts
// Propósito: comparación difusa de la respuesta HABLADA contra las respuestas aceptadas de una
// pregunta oficial. Es la base del modo voz (Fase 6): el reconocimiento de voz nunca devuelve el
// texto exacto ("Washinton" por "Washington"), así que primero se normalizan los dos lados y
// después se mide cuánto se parecen antes de decidir si la respuesta vale.
//
// La comparación es SIEMPRE en inglés: la entrevista del USCIS se rinde en inglés y `answers_en`
// es la referencia oficial de cada pregunta, de modo que `answers_es` no participa en el modo voz
// (solo se usa como traducción de apoyo en las pantallas de estudio).
//
// `normalize` replica el saneado que `sanitizeForSpeech` (SpeakerButton.tsx) aplica antes del TTS
// —empezando por borrar el texto entre paréntesis— para que lo que el usuario OYE y lo que se
// compara no diverjan: si el TTS dice "Freed the slaves", repetirlo debe contar como correcto.
//
// Lógica PURA y sin estado: nada de React, store, red ni disco. `normalize` y `similarity` se
// pueden usar por separado (p. ej. para inspeccionar por qué falló una respuesta concreta) y
// `fuzzyMatch` las combina con un umbral. Sin dependencias externas; verificada por
// `.expo/selftest/fuzzy-match-check.js`.

/**
 * Signos que se convierten en espacio (no se borran, para no pegar palabras: "one, two" son dos
 * palabras, no "one,two" -> "onetwo"). Incluye apóstrofos y comillas tipográficos, que el
 * reconocimiento de voz devuelve a veces según el dispositivo.
 */
const PUNCTUATION = /[.,;:!?'"()[\]_\-’‘`“”]/g;

/**
 * Contracciones inglesas frecuentes. Las claves van SIN apóstrofo a propósito: el paso de
 * puntuación ya lo convirtió en espacio, así que "don't" llega aquí como "don t" (y el "don’t"
 * tipográfico acaba igual). El orden de las claves es el de inserción del objeto.
 */
const CONTRACTIONS: Record<string, string> = {
  'don t': 'do not',
  'doesn t': 'does not',
  'didn t': 'did not',
  'can t': 'cannot',
  'won t': 'will not',
  'isn t': 'is not',
  'aren t': 'are not',
  'wasn t': 'was not',
  'weren t': 'were not',
  'i m': 'i am',
  'i ve': 'i have',
  'i ll': 'i will',
  'i d': 'i would',
  'it s': 'it is',
  'that s': 'that is',
  'there s': 'there is',
  'he s': 'he is',
  'she s': 'she is',
  'we re': 'we are',
  'they re': 'they are',
  'you re': 'you are',
  'you ve': 'you have',
  'we ve': 'we have',
};

/** Números del 0 al 19 (los "teens" irregulares viven todos aquí). */
const NUMBER_UNITS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

/** Decenas (los índices 0 y 1 no se usan: sus números están en `NUMBER_UNITS`). */
const NUMBER_TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
];

/** Número máximo que `numberToWords` sabe escribir (el examen no necesita más). */
const MAX_WRITTEN_NUMBER = 100;

/**
 * Escribe un número arábigo en inglés: 0-19 con palabra directa, 21-99 como "decena unidad"
 * ("twenty seven") y 100 como "one hundred". Se usa en `normalize` para que la respuesta hablada
 * "27" y la escrita "twenty-seven" converjan en el mismo texto.
 *
 * @param value Número entero entre 0 y `MAX_WRITTEN_NUMBER`.
 * @returns El número escrito en inglés, en minúsculas y sin guiones.
 */
function numberToWords(value: number): string {
  if (value === MAX_WRITTEN_NUMBER) {
    return 'one hundred';
  }

  if (value < NUMBER_UNITS.length) {
    return NUMBER_UNITS[value] ?? String(value);
  }

  const tens = NUMBER_TENS[Math.floor(value / 10)] ?? '';
  const unit = value % 10;

  return unit === 0 ? tens : `${tens} ${NUMBER_UNITS[unit] ?? ''}`.trim();
}

/**
 * Expande las contracciones de `CONTRACTIONS` sobre un texto ya colapsado (palabras separadas por
 * un único espacio). Se trabaja con el texto acolchado por espacios para que solo coincidan
 * palabras completas ("i m" no debe dispararse dentro de otra palabra).
 */
function expandContractions(text: string): string {
  let result = ` ${text} `;

  for (const [contraction, expansion] of Object.entries(CONTRACTIONS)) {
    result = result.split(` ${contraction} `).join(` ${expansion} `);
  }

  return result.replace(/\s+/g, ' ').trim();
}

/**
 * Normaliza un texto para poder compararlo con otro de forma tolerante. Pasos, en este orden:
 *   1. Borra el contenido entre paréntesis y corchetes.
 *   2. Minúsculas.
 *   3. Signos de puntuación -> espacio (para no pegar palabras).
 *   4. Espacios múltiples colapsados y `trim`.
 *   5. Contracciones comunes expandidas ("don't" -> "do not", "i'm" -> "i am").
 *   6. Números arábigos 0-100 escritos en palabras ("27" -> "twenty seven").
 *
 * El paso 1 es deliberado y va PRIMERO: reproduce lo que `sanitizeForSpeech` (SpeakerButton.tsx)
 * ya quita del texto que se pronuncia, de modo que lo que el usuario oye y lo que se compara sean
 * el mismo texto. Casi siempre el contenido entre paréntesis es una aclaración o una respuesta
 * alternativa completa ("Freed the slaves (Emancipation Proclamation)"), no parte de la respuesta
 * esencial que el usuario tiene que decir. Además va antes del paso 3 porque, una vez convertidos
 * los signos en espacios, ya no habría forma de saber qué había entre paréntesis.
 *
 * El paso 6 va DESPUÉS del 3 para que "twenty-seven" (que pierde el guion en el paso 3) y "27"
 * acaben en el mismo string. Los números mayores que 100 se dejan como dígitos: la entrevista
 * USCIS no los necesita como palabra, así que no se inventa una regla de lectura de años.
 *
 * Es la pieza que hace posible comparar la respuesta hablada con las respuestas oficiales: se
 * aplica a AMBOS lados antes de medir similitud, y se compara en inglés porque el examen se rinde
 * en inglés (`answers_es` no participa en el modo voz).
 *
 * @param text Texto crudo (respuesta hablada reconocida o respuesta aceptada de `questions.json`).
 * @returns Texto en minúsculas, sin signos, con contracciones y números 0-100 en palabras.
 */
export function normalize(text: string): string {
  // Paso 1: fuera el contenido entre paréntesis y corchetes (mismo saneado que el TTS).
  const withoutParentheticals = text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '');

  const collapsed = withoutParentheticals
    .toLowerCase()
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return expandContractions(collapsed)
    .split(' ')
    .map((word) => {
      if (!/^\d+$/.test(word)) {
        return word;
      }

      const value = Number(word);

      return value >= 0 && value <= MAX_WRITTEN_NUMBER ? numberToWords(value) : word;
    })
    .join(' ');
}

/**
 * Distancia de Levenshtein (mínimo número de inserciones, borrados y sustituciones para convertir
 * `a` en `b`). Implementación clásica de dos filas: O(n*m) de tiempo y O(min(n,m)) de espacio,
 * porque solo se conservan la fila anterior y la actual.
 *
 * Se usa desde `similarity`; no compara en minúsculas ni normaliza: eso es decisión del llamador.
 */
function levenshteinDistance(a: string, b: string): number {
  // Las filas se construyen sobre la cadena corta para gastar O(min(n, m)) de espacio.
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;

  let previous = Array.from({ length: shorter.length + 1 }, (_, index) => index);

  for (let row = 1; row <= longer.length; row += 1) {
    const current = [row];

    for (let column = 1; column <= shorter.length; column += 1) {
      const cost = longer[row - 1] === shorter[column - 1] ? 0 : 1;

      current[column] = Math.min(
        (previous[column] ?? 0) + 1, // borrado en `longer`
        (current[column - 1] ?? 0) + 1, // inserción en `longer`
        (previous[column - 1] ?? 0) + cost, // sustitución
      );
    }

    previous = current;
  }

  return previous[shorter.length] ?? 0;
}

/**
 * Similitud entre dos textos, medida como `1 - (distancia de Levenshtein / longitud máxima)`:
 * 1 significa "idénticos" y 0 significa "sin nada en común".
 *
 * Compara los strings CRUDOS (no normaliza): el llamador decide qué pasarle. `fuzzyMatch` le pasa
 * los dos lados ya normalizados con `normalize`, que es lo que hace tolerante la comparación frente
 * a mayúsculas, signos, contracciones y números escritos de otra forma.
 *
 * @param a Primer texto.
 * @param b Segundo texto.
 * @returns Similitud de 0 a 1. Dos vacíos son 1; uno vacío y el otro no, 0.
 */
export function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) {
    return 1;
  }

  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  return 1 - levenshteinDistance(a, b) / Math.max(a.length, b.length);
}

/** Resultado de comparar una respuesta hablada con las respuestas aceptadas de una pregunta. */
export type FuzzyMatchResult = {
  /** `true` si la mejor similitud alcanzó el umbral. */
  matched: boolean;
  /** Mejor similitud obtenida (0..1), se haya alcanzado el umbral o no. */
  score: number;
  /** Respuesta aceptada ORIGINAL contra la que hizo match (solo si `matched`). */
  matchedAnswer?: string;
  /** Respuesta aceptada original más cercana, haya match o no: es la que se muestra al usuario. */
  bestGuess: string;
};

/**
 * Compara la respuesta hablada del usuario con las respuestas aceptadas (en inglés) de una
 * pregunta oficial del USCIS y decide si la da por válida. Es el corazón del modo voz de Fase 6:
 * el reconocimiento nunca devuelve el texto exacto, así que se normalizan los dos lados y se
 * acepta la respuesta si la similitud alcanza el umbral (0.75 por defecto, tolerante a un error
 * tipográfico o de pronunciación en palabras cortas, pero no a decir otra cosa).
 *
 * Los textos que devuelve son los ORIGINALES de `acceptedAnswers` (sin normalizar), porque son los
 * que se le enseñan al usuario como respuesta oficial.
 *
 * @param userAnswer Texto reconocido del usuario (inglés).
 * @param acceptedAnswers Respuestas oficiales aceptadas de la pregunta (`answers_en`).
 * @param threshold Similitud mínima para dar la respuesta por buena (0.75 por defecto).
 * @returns Si hubo match, la mejor similitud, la respuesta aceptada que hizo match y la más cercana.
 */
export function fuzzyMatch(
  userAnswer: string,
  acceptedAnswers: string[],
  threshold = 0.75,
): FuzzyMatchResult {
  if (acceptedAnswers.length === 0) {
    return { matched: false, score: 0, bestGuess: '' };
  }

  const normalizedUser = normalize(userAnswer);

  // Sin nada que comparar (silencio, ruido): no hay match posible, pero se sugiere la primera
  // respuesta aceptada para poder mostrarle algo al usuario.
  if (normalizedUser.length === 0) {
    return { matched: false, score: 0, bestGuess: acceptedAnswers[0] ?? '' };
  }

  let bestScore = 0;
  let bestIndex = 0;

  for (let index = 0; index < acceptedAnswers.length; index += 1) {
    // Estrictamente mayor: en empate se conserva la primera del array (orden de `questions.json`).
    const score = similarity(normalizedUser, normalize(acceptedAnswers[index] ?? ''));

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  const bestGuess = acceptedAnswers[bestIndex] ?? '';

  return bestScore >= threshold
    ? { matched: true, score: bestScore, matchedAnswer: bestGuess, bestGuess }
    : { matched: false, score: bestScore, bestGuess };
}

