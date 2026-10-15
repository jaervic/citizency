// src/utils/quizOptions.test.ts
// Pruebas del banco curado de distractores y de `buildQuizOptions`. Son las que garantizan que
// ninguna pregunta del examen de práctica pueda quedarse sin opciones, con dos correctas o con
// distractores repetidos/iguales a una respuesta aceptada.
import { describe, expect, it } from 'vitest';

import quizDistractors from '@/data/quizDistractors.json';
import { OFFICIAL_DATA, QUIZ_POOL, buildQuizPool, getAcceptedAnswers } from '@/utils/content';
import { OPTIONS_PER_QUESTION, buildQuizOptions } from '@/utils/quizOptions';

/** Localización de prueba: California, distrito 11. */
const CALIFORNIA = { state: 'CA', district: '11' };
/** Las 4 preguntas que dependen del estado del solicitante. */
const STATE_QUESTIONS = ['gov-023', 'gov-029', 'gov-061', 'gov-062'];

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Comprueba las invariantes de un juego de opciones. */
function expectValidOptions(questionId: string, options: ReturnType<typeof buildQuizOptions>): void {
  expect(options).toHaveLength(OPTIONS_PER_QUESTION);

  const correct = options.filter((option) => option.isCorrect);
  expect(correct).toHaveLength(1);
  expect(correct[0]?.id).toBe(`${questionId}-correct`);

  const texts = options.map((option) => normalize(option.en));
  expect(new Set(texts).size).toBe(texts.length);

  for (const option of options) {
    expect(option.en.trim().length).toBeGreaterThan(0);
    expect(option.es.trim().length).toBeGreaterThan(0);
  }
}

describe('banco de distractores', () => {
  it('cubre exactamente las 120 preguntas estáticas del examen de práctica', () => {
    expect(Object.keys(quizDistractors).sort()).toEqual(QUIZ_POOL.map((question) => question.id).sort());
    expect(QUIZ_POOL).toHaveLength(120);
  });

  it('da a cada pregunta estática 4 opciones válidas, con una sola correcta', () => {
    for (const question of QUIZ_POOL) {
      const options = buildQuizOptions({ question, quizPool: QUIZ_POOL });

      expectValidOptions(question.id, options);
      expect(options.find((option) => option.isCorrect)?.en).toBe(question.answers_en[0]);

      const accepted = new Set(question.answers_en.map(normalize));
      const acceptedSpanish = new Set(question.answers_es.map(normalize));

      for (const option of options.filter((entry) => !entry.isCorrect)) {
        expect(accepted.has(normalize(option.en))).toBe(false);
        expect(acceptedSpanish.has(normalize(option.es))).toBe(false);
      }
    }
  });

  it('sigue generando 4 opciones para una pregunta fuera del banco (respaldo heurístico)', () => {
    const question = { ...QUIZ_POOL[0]!, id: 'sin-banco-999' };
    expectValidOptions('sin-banco-999', buildQuizOptions({ question, quizPool: QUIZ_POOL }));
  });
});

describe('preguntas dinámicas en el examen', () => {
  it('sin estado configurado el examen incluye las 120 estáticas y las 4 nacionales', () => {
    expect(buildQuizPool()).toHaveLength(124);
  });

  it('con estado y distrito configurados entran también las 4 estatales', () => {
    expect(buildQuizPool(CALIFORNIA)).toHaveLength(128);
  });

  it('con estado pero sin distrito se queda fuera solo el representante', () => {
    expect(buildQuizPool({ state: 'CA', district: null })).toHaveLength(127);
  });

  it('las 4 nacionales se distraen con los otros cargos nacionales (no con cualquier respuesta)', () => {
    const pool = buildQuizPool();
    const nationalIds = ['gov-030', 'gov-038', 'gov-039', 'gov-057'];
    const officials = [
      OFFICIAL_DATA.president,
      OFFICIAL_DATA.vicePresident,
      OFFICIAL_DATA.speakerOfHouse,
      OFFICIAL_DATA.chiefJustice,
    ];

    for (const id of nationalIds) {
      const question = pool.find((entry) => entry.id === id);
      expect(question, `falta ${id} en el grupo`).toBeDefined();

      const options = buildQuizOptions({ question: question!, quizPool: pool });
      const correct = options.find((option) => option.isCorrect)!.en;
      const distractors = options.filter((option) => !option.isCorrect).map((option) => option.en);

      expectValidOptions(id, options);
      expect(officials).toContain(correct);

      // Cada distractor es otro cargo nacional vigente: plausible y claramente incorrecto.
      for (const distractor of distractors) {
        expect(officials).toContain(distractor);
        expect(distractor).not.toBe(correct);
      }
    }
  });

  it('genera opciones coherentes para las 4 preguntas estatales', () => {
    const pool = buildQuizPool(CALIFORNIA);

    for (const id of STATE_QUESTIONS) {
      const question = pool.find((entry) => entry.id === id);
      expect(question, `falta ${id} en el grupo`).toBeDefined();

      if (question === undefined) {
        continue;
      }

      const options = buildQuizOptions({ question, quizPool: pool, location: CALIFORNIA });
      const expected = getAcceptedAnswers(question, OFFICIAL_DATA, CALIFORNIA);

      expectValidOptions(id, options);
      expect(options.find((option) => option.isCorrect)?.en).toBe(expected[0]);

      // Los distractores son valores del MISMO campo en otros estados, nunca la respuesta propia.
      const distractors = options.filter((option) => !option.isCorrect).map((option) => option.en);
      for (const distractor of distractors) {
        expect(expected).not.toContain(distractor);
      }
    }
  });

  it('los senadores se resuelven con las dos opciones aceptadas', () => {
    const question = buildQuizPool(CALIFORNIA).find((entry) => entry.id === 'gov-023');
    expect(getAcceptedAnswers(question!, OFFICIAL_DATA, CALIFORNIA)).toHaveLength(2);
  });
});
