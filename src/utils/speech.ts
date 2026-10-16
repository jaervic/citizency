// src/utils/speech.ts
// Propósito: elegir bien la voz de lectura. El problema original era simple: la app cogía la
// PRIMERA voz en inglés de la lista, que suele ser una de las malas y suena robótica.
//
// Criterio (por orden de importancia):
//   1. Voces que NECESITAN INTERNET (`localService === false`). En Chrome son las "Google …" y en
//      Edge las "… Online (Natural)", que son las que mejor suenan y no hay que descargar nada.
//   2. Nombre con pistas de calidad (natural, neural, online, enhanced…).
//   3. Voces conocidas como buenas (Siri, Samantha, Ava… en Apple; Google… en Chrome).
//   4. Inglés de Estados Unidos antes que el británico (la pronunciación del examen).
//   5. La voz marcada por defecto del sistema.
//
// Todo son funciones puras: se prueban sin navegador.

/** Voz del sistema (se usa el tipo del DOM, que ya describe `SpeechSynthesisVoice`). */
export type Voice = SpeechSynthesisVoice;

/** Sufijo que se añade a las voces que necesitan conexión, para que se entienda en Ajustes. */
export const NETWORK_VOICE_NOTE = 'en línea';

/** Ventajas por el nombre de la voz. */
const NAME_BONUSES: ReadonlyArray<readonly [RegExp, number]> = [
  [/(natural|neural|online|premium|enhanced|plus)/i, 500],
  [/google/i, 400],
  [/\b(siri|samantha|ava|allison|zoe|nicky|karen|daniel|moira|tessa|alex|serena|martha|rishi)\b/i, 300],
];

/** Penalizaciones: voces sintéticas antiguas que suenan mal. */
const NAME_PENALTIES: ReadonlyArray<readonly [RegExp, number]> = [
  [/espeak/i, -800],
  [/^microsoft (david|zira|mark|hazel)\b/i, -300],
];

const NETWORK_BONUS = 1000;
const US_ENGLISH_BONUS = 100;
const DEFAULT_BONUS = 50;

/**
 * `true` si la voz necesita conexión. La Web Speech API lo indica con `localService === false`.
 * Se comprueba con `=== false` porque en algunos navegadores el campo llega `undefined` (hay un
 * fallo conocido en Edge 150 que devuelve voces con campos vacíos).
 */
export function isNetworkVoice(voice: Voice): boolean {
  return voice.localService === false;
}

/** `true` si la entrada de la voz es utilizable (algunos navegadores devuelven basura). */
function isUsableVoice(voice: unknown): voice is Voice {
  if (voice === null || typeof voice !== 'object') {
    return false;
  }

  const candidata = voice as Partial<Voice>;

  return typeof candidata.name === 'string' && candidata.name.length > 0 && typeof candidata.lang === 'string';
}

/** Voces en inglés utilizables, sin entradas rotas. */
export function englishVoices(voices: readonly Voice[]): Voice[] {
  return voices.filter((voice) => isUsableVoice(voice) && voice.lang.toLowerCase().startsWith('en'));
}

/** Puntuación de una voz: cuanto más alta, mejor suena (según el criterio de arriba). */
export function scoreVoice(voice: Voice): number {
  let score = 0;

  if (isNetworkVoice(voice)) {
    score += NETWORK_BONUS;
  }

  for (const [patron, bonus] of NAME_BONUSES) {
    if (patron.test(voice.name)) {
      score += bonus;
    }
  }

  for (const [patron, penalty] of NAME_PENALTIES) {
    if (patron.test(voice.name)) {
      score += penalty;
    }
  }

  // `lang` es "en-US" o "en_US" según el navegador.
  if (voice.lang.toLowerCase().replace('_', '-') === 'en-us') {
    score += US_ENGLISH_BONUS;
  }

  if (voice.default) {
    score += DEFAULT_BONUS;
  }

  return score;
}

/**
 * Ordena las voces de mejor a peor. En caso de empate se ordena por nombre, para que el resultado
 * sea siempre el mismo (y las pruebas no dependan del orden del sistema).
 */
export function rankVoices(voices: readonly Voice[]): Voice[] {
  return englishVoices(voices).sort((a, b) => {
    const diferencia = scoreVoice(b) - scoreVoice(a);

    return diferencia !== 0 ? diferencia : a.name.localeCompare(b.name);
  });
}

/** La mejor voz disponible, o `null` si no hay ninguna en inglés. */
export function pickBestVoice(voices: readonly Voice[]): Voice | null {
  return rankVoices(voices)[0] ?? null;
}

/** Busca una voz por nombre exacto (lo que se guarda en Ajustes). */
export function findVoiceByName(voices: readonly Voice[], name: string): Voice | null {
  return voices.find((voice) => isUsableVoice(voice) && voice.name === name) ?? null;
}

/**
 * Resuelve la voz que hay que usar: la elegida a mano si sigue existiendo y, si no, la mejor
 * disponible.
 */
export function resolveVoice(
  voices: readonly Voice[],
  preferredName: string | null,
): Voice | null {
  if (preferredName !== null) {
    const preferida = findVoiceByName(voices, preferredName);

    if (preferida !== null) {
      return preferida;
    }
  }

  return pickBestVoice(voices);
}

/** Etiqueta de una voz para el selector de Ajustes. */
export function describeVoice(voice: Voice): string {
  const idioma = voice.lang.replace('_', '-');
  const sufijos = [idioma];

  if (isNetworkVoice(voice)) {
    sufijos.push(NETWORK_VOICE_NOTE);
  }

  return `${voice.name} (${sufijos.join(', ')})`;
}
