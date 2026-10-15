#!/usr/bin/env node
/**
 * scripts/mergeQuestions.js
 * ---------------------------------------------------------------------------
 * Fusiona las 128 preguntas oficiales del USCIS en inglés (src/data/en.json)
 * y en español (src/data/es.json) en un único archivo bilingüe:
 * src/data/questions.json
 *
 * Ambos arrays fuente tienen la misma longitud, el mismo orden y el mismo
 * `id` (1-128); el script lo verifica posición a posición antes de fusionar.
 *
 * Uso:  npm run merge      (equivale a: node scripts/mergeQuestions.js)
 * ---------------------------------------------------------------------------
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const EN_PATH = path.join(DATA_DIR, 'en.json');
const ES_PATH = path.join(DATA_DIR, 'es.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'questions.json');

/** Número de preguntas que debe traer cada archivo fuente. */
const EXPECTED_TOTAL = 128;

/**
 * Prefijo del nuevo id según la categoría en INGLÉS (según la especificación):
 *   gov -> Principles of American Government | System of Government
 *   his -> Colonial Period and Independence | 1800s | Recent American History
 *   civ -> Rights and Responsibilities | Symbols and Holidays
 * @type {Record<string, 'gov' | 'his' | 'civ'>}
 */
const CATEGORY_PREFIX = {
  'Principles of American Government': 'gov',
  'System of Government': 'gov',
  'Colonial Period and Independence': 'his',
  '1800s': 'his',
  'Recent American History': 'his',
  'Rights and Responsibilities': 'civ',
  'Symbols and Holidays': 'civ',
};

/**
 * Lee y parsea un JSON de forma tolerante al BOM UTF-8.
 * @param {string} filePath Ruta absoluta del archivo.
 * @returns {any} Contenido parseado.
 */
function readJson(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`No se pudo leer "${filePath}": ${error.message}`);
  }

  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`JSON inválido en "${filePath}": ${error.message}`);
  }
}

/**
 * Verifica que el archivo tenga exactamente EXPECTED_TOTAL preguntas.
 * @param {any} data Contenido parseado del archivo.
 * @param {string} filePath Ruta del archivo (para el mensaje de error).
 * @returns {any[]} El array `questions` validado.
 */
function assertQuestionCount(data, filePath) {
  const name = path.basename(filePath);
  const questions = data ? data.questions : undefined;

  if (!Array.isArray(questions)) {
    throw new Error(`"${name}" no contiene un array con la propiedad "questions".`);
  }
  if (questions.length !== EXPECTED_TOTAL) {
    throw new Error(
      `"${name}" debe tener ${EXPECTED_TOTAL} preguntas, pero tiene ${questions.length}.`,
    );
  }

  return questions;
}

/**
 * Lee el questions.json existente y crea un índice por id con el contenido
 * pedagógico ya generado (`explanation_es` y `vocabulary`), para poder
 * preservarlo al regenerar el archivo.
 * Si el archivo no existe todavía (primera ejecución) devuelve un objeto vacío.
 * @returns {Record<string, { explanation_es?: string, vocabulary?: any[] }>} Índice por id.
 */
function readExistingContent() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return {};
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(
      `No se pudo leer el "${path.basename(OUTPUT_PATH)}" existente (${error.message}). ` +
        'Repáralo o elimínalo para regenerarlo desde cero.',
    );
  }

  /** @type {Record<string, { explanation_es?: string, vocabulary?: any[] }>} */
  const byId = {};
  const questions = data && Array.isArray(data.questions) ? data.questions : [];

  for (const question of questions) {
    if (question && typeof question.id === 'string') {
      byId[question.id] = {
        explanation_es: question.explanation_es,
        vocabulary: question.vocabulary,
      };
    }
  }

  return byId;
}

/**
 * Devuelve el prefijo del id que corresponde a una categoría en inglés.
 * @param {string} category Categoría tal cual viene en en.json.
 * @param {number} id Id de la pregunta (para el mensaje de error).
 * @returns {'gov' | 'his' | 'civ'} Prefijo del id.
 */
function prefixForCategory(category, id) {
  const prefix = CATEGORY_PREFIX[category];

  if (!prefix) {
    throw new Error(
      `Categoría desconocida en la pregunta id ${id}: "${category}". ` +
        `Categorías válidas: ${Object.keys(CATEGORY_PREFIX).join(', ')}.`,
    );
  }

  return prefix;
}

/**
 * Formatea el nuevo id: prefijo + número con 3 dígitos (1 -> "001", 45 -> "045").
 * @param {'gov' | 'his' | 'civ'} prefix Prefijo de la categoría.
 * @param {number} id Id original (1-128).
 * @returns {string} Id formateado, por ejemplo "gov-001".
 */
function formatQuestionId(prefix, id) {
  return `${prefix}-${String(id).padStart(3, '0')}`;
}

/**
 * Recorre ambos arrays en paralelo (por índice), comprueba que los `id`
 * coincidan y construye el array bilingüe fusionado.
 * @param {any[]} enQuestions Preguntas de en.json.
 * @param {any[]} esQuestions Preguntas de es.json.
 * @param {Record<string, { explanation_es?: string, vocabulary?: any[] }>} existingById
 *   Contenido pedagógico ya existente, indexado por id (puede estar vacío).
 * @returns {{
 *   questions: any[],
 *   warnings: string[],
 *   preserved: { explanations: number, vocabularies: number },
 * }} Preguntas fusionadas, avisos y contadores de contenido preservado.
 */
function mergeQuestions(enQuestions, esQuestions, existingById = {}) {
  /** @type {any[]} */
  const questions = [];
  /** @type {string[]} */
  const warnings = [];
  const usedIds = new Set();
  let preservedExplanations = 0;
  let preservedVocabularies = 0;

  for (let index = 0; index < EXPECTED_TOTAL; index += 1) {
    const en = enQuestions[index];
    const es = esQuestions[index];

    if (en.id !== es.id) {
      throw new Error(
        `Los id no coinciden en el índice ${index}: ` +
          `en.json tiene id=${en.id} y es.json tiene id=${es.id}.`,
      );
    }

    const id = formatQuestionId(prefixForCategory(en.category, en.id), en.id);

    if (usedIds.has(id)) {
      throw new Error(`Id duplicado al fusionar: "${id}" (pregunta original ${en.id}).`);
    }
    usedIds.add(id);

    // Los flags de exención y de pregunta estatal deben coincidir en ambos idiomas.
    if (en.seniorExemption !== es.seniorExemption) {
      warnings.push(`id ${en.id}: seniorExemption difiere entre en.json y es.json.`);
    }
    if (Boolean(en.stateSpecific) !== Boolean(es.stateSpecific)) {
      warnings.push(`id ${en.id}: stateSpecific difiere entre en.json y es.json.`);
    }

    // Preserva el contenido pedagógico ya generado para esta pregunta:
    // solo se reutiliza si NO está vacío; si está vacío se deja "", [].
    const previous = existingById[id];
    const previousExplanation = previous ? previous.explanation_es : undefined;
    const previousVocabulary = previous ? previous.vocabulary : undefined;

    const explanationEs =
      typeof previousExplanation === 'string' && previousExplanation !== ''
        ? previousExplanation
        : '';
    const vocabulary =
      Array.isArray(previousVocabulary) && previousVocabulary.length > 0
        ? previousVocabulary
        : [];

    if (explanationEs !== '') {
      preservedExplanations += 1;
    }
    if (vocabulary.length > 0) {
      preservedVocabularies += 1;
    }

    questions.push({
      id,
      category: es.category,
      question_en: en.question,
      answers_en: en.answers,
      question_es: es.question,
      answers_es: es.answers,
      explanation_es: explanationEs,
      vocabulary,
      is_65_20: en.seniorExemption,
      stateSpecific: en.stateSpecific,
      officialField: en.officialField === undefined ? null : en.officialField,
    });
  }

  return {
    questions,
    warnings,
    preserved: { explanations: preservedExplanations, vocabularies: preservedVocabularies },
  };
}

/** Punto de entrada: lee, valida, fusiona y escribe el archivo de salida. */
function main() {
  const enQuestions = assertQuestionCount(readJson(EN_PATH), EN_PATH);
  const esQuestions = assertQuestionCount(readJson(ES_PATH), ES_PATH);

  const existingById = readExistingContent();

  const { questions, warnings, preserved } = mergeQuestions(
    enQuestions,
    esQuestions,
    existingById,
  );

  const output = {
    languageCode: 'multi',
    questions,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  for (const warning of warnings) {
    console.warn(`⚠️  ${warning}`);
  }

  console.log(`✅ Fusión completa. Total: ${questions.length} preguntas.`);
  console.log(
    `✅ Preservadas ${preserved.explanations} explicaciones y ${preserved.vocabularies} vocabularios existentes.`,
  );
}

try {
  main();
} catch (error) {
  console.error(`❌ Error al fusionar las preguntas: ${error.message}`);
  process.exitCode = 1;
}
