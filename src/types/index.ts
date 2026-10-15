// src/types/index.ts
// Propósito: tipos compartidos de la webapp, alineados con el modelo de datos real
// de src/data/questions.json (generado por scripts/mergeQuestions.js a partir de
// src/data/en.json y src/data/es.json).

/**
 * Entrada de vocabulario de apoyo de una pregunta: palabra en inglés y su
 * traducción al español. `Question.vocabulary` está vacío hasta que se genere
 * ese contenido.
 */
export type VocabularyItem = {
  /** Palabra o expresión en inglés (p. ej. "amendment"). */
  word: string;
  /** Traducción al español (p. ej. "enmienda"). */
  translation: string;
};

/**
 * Cargo oficial del que depende dinámicamente la respuesta de una pregunta
 * (preguntas cuyo `answers_en`/`answers_es` vienen vacíos porque la respuesta
 * cambia con el tiempo: senadores, presidente, speaker, capital, etc.).
 * Es `null` en las preguntas con respuestas estáticas.
 */
export type OfficialField =
  | 'senators'
  | 'representative'
  | 'speakerOfHouse'
  | 'president'
  | 'vicePresident'
  | 'chiefJustice'
  | 'governor'
  | 'capital'
  | null;

/**
 * Datos oficiales vigentes de los cargos de los que dependen las 8 preguntas dinámicas
 * (las que no tienen respuesta estática en `questions.json`). Se mantienen a mano en
 * `src/data/officialData.json` y `lastUpdated` (ISO YYYY-MM-DD) indica hasta cuándo
 * estaban verificados esos valores.
 *
 * Las claves coinciden 1:1 con `OfficialField`. Los campos que dependen del estado o del
 * distrito del solicitante (`senators`, `representative`, `governor`, `capital`) pueden
 * ser `null` mientras no se rellenen: en ese caso la app solo muestra el aviso genérico.
 */
export type OfficialData = {
  /** Fecha ISO (YYYY-MM-DD) de la última revisión manual de los datos. */
  lastUpdated: string;
  /** Nombre del presidente de los Estados Unidos. */
  president: string;
  /** Nombre del vicepresidente de los Estados Unidos. */
  vicePresident: string;
  /** Nombre del Speaker de la Cámara de Representantes. */
  speakerOfHouse: string;
  /** Nombre del Chief Justice de la Corte Suprema. */
  chiefJustice: string;
  /** Senadores del estado del solicitante (`null` si aún no se ha rellenado). */
  senators: string | null;
  /** Representante del distrito del solicitante (`null` si aún no se ha rellenado). */
  representative: string | null;
  /** Gobernador del estado del solicitante (`null` si aún no se ha rellenado). */
  governor: string | null;
  /** Capital del estado del solicitante (`null` si aún no se ha rellenado). */
  capital: string | null;
};

/**
 * Las 7 categorías oficiales del examen de ciudadanía del USCIS, tal y como
 * aparecen en español en `questions.json` (campo `category`).
 */
export type Category =
  | 'Principios del gobierno estadounidense'
  | 'Sistema de gobierno'
  | 'Derechos y responsabilidades'
  | 'Período colonial e independencia'
  | 'Los años 1800'
  | 'Historia estadounidense reciente'
  | 'Símbolos y días festivos';

/**
 * Una de las 128 preguntas oficiales del USCIS, en versión bilingüe
 * inglés/español.
 */
export type Question = {
  /**
   * Identificador legible: prefijo de categoría (`gov` | `his` | `civ`) +
   * número de 3 dígitos. Ejemplos reales: "gov-001", "his-073", "civ-128".
   */
  id: string;
  /** Categoría oficial en español. */
  category: Category;
  /** Enunciado de la pregunta en inglés. */
  question_en: string;
  /** Respuestas aceptadas en inglés (varias si el USCIS admite más de una). */
  answers_en: string[];
  /** Enunciado de la pregunta en español. */
  question_es: string;
  /** Respuestas aceptadas en español. */
  answers_es: string[];
  /** Explicación en español; cadena vacía hasta que se genere el contenido. */
  explanation_es: string;
  /** Vocabulario de apoyo; array vacío hasta que se genere el contenido. */
  vocabulary: VocabularyItem[];
  /** `true` si la pregunta entra en la exención 65/20 (origen: `seniorExemption`). */
  is_65_20: boolean;
  /** `true` si la respuesta depende del estado del solicitante. */
  stateSpecific: boolean;
  /**
   * Cargo oficial del que depende la respuesta, o `null` si la pregunta tiene
   * respuestas estáticas.
   */
  officialField: OfficialField;
};

/**
 * Estructura completa del archivo src/data/questions.json.
 *
 * Nota sobre su uso: al importar el JSON, TypeScript infiere `category` y
 * `officialField` como `string`, por lo que hay que afirmar el tipo
 * (`questionsJson as QuestionsFile`) o validarlo antes en runtime.
 */
export type QuestionsFile = {
  /** Código de idioma del archivo; aquí siempre "multi" (contenido bilingüe). */
  languageCode: string;
  /** Las 128 preguntas oficiales fusionadas. */
  questions: Question[];
};

/**
 * Progreso del usuario, base del estado global de Zustand (racha, XP y
 * estadísticas por pregunta). Nota: las claves de `answeredQuestions` son ids de
 * pregunta como "gov-001".
 */
export type UserProgress = {
  /** Puntos de experiencia acumulados. */
  xp: number;
  /** Días consecutivos de estudio (racha actual). */
  streak: number;
  /**
   * Fecha ISO (YYYY-MM-DD) del último día de estudio, o `null` si el usuario
   * todavía no ha estudiado.
   */
  lastStudyDate: string | null;
  /**
   * Estadísticas acumuladas por pregunta; la clave es el `id` de la pregunta
   * (p. ej. "gov-001").
   */
  answeredQuestions: Record<
    string,
    {
      /** Número de veces que se acertó. */
      correct: number;
      /** Número de veces que se falló. */
      incorrect: number;
      /** Fecha ISO (YYYY-MM-DD) en la que se respondió por última vez. */
      lastSeen: string;
    }
  >;
};
