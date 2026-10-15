// src/utils/content.test.ts
// Pruebas de la resolución de las 8 preguntas dinámicas: las 4 nacionales (de `officialData.json`)
// y las 4 estatales (de `stateOfficials.json` + estado/distrito del usuario).
import { describe, expect, it } from 'vitest';

import { OFFICIAL_DATA, QUESTIONS, getAcceptedAnswers, getOfficialValues } from '@/utils/content';
import { getStateEntry } from '@/utils/stateOfficials';

const question = (id: string) => QUESTIONS.find((entry) => entry.id === id)!;

describe('preguntas dinámicas nacionales', () => {
  it('resuelve presidente, vicepresidente, speaker y chief justice', () => {
    expect(getOfficialValues(question('gov-038'))).toEqual([OFFICIAL_DATA.president]);
    expect(getOfficialValues(question('gov-039'))).toEqual([OFFICIAL_DATA.vicePresident]);
    expect(getOfficialValues(question('gov-030'))).toEqual([OFFICIAL_DATA.speakerOfHouse]);
    expect(getOfficialValues(question('gov-057'))).toEqual([OFFICIAL_DATA.chiefJustice]);
  });

  it('se pueden corregir sin configurar el estado (la entrevista las admite)', () => {
    expect(getAcceptedAnswers(question('gov-038')).length).toBeGreaterThan(0);
  });
});

describe('preguntas dinámicas estatales', () => {
  it('sin estado configurado no devuelven respuesta', () => {
    for (const id of ['gov-023', 'gov-029', 'gov-061', 'gov-062']) {
      expect(getOfficialValues(question(id))).toEqual([]);
    }
  });

  it('con estado y distrito devuelven el dato del usuario', () => {
    const location = { state: 'TX', district: '35' };
    const texas = getStateEntry('TX')!;

    expect(getAcceptedAnswers(question('gov-023'), OFFICIAL_DATA, location)).toEqual(texas.senators);
    expect(getAcceptedAnswers(question('gov-029'), OFFICIAL_DATA, location)).toEqual([
      texas.representatives['35'],
    ]);
    expect(getAcceptedAnswers(question('gov-061'), OFFICIAL_DATA, location)).toEqual([
      texas.governor,
    ]);
    expect(getAcceptedAnswers(question('gov-062'), OFFICIAL_DATA, location)).toEqual([
      texas.capital,
    ]);
  });
});

describe('preguntas estáticas', () => {
  it('devuelven sus respuestas de questions.json', () => {
    expect(getAcceptedAnswers(question('gov-001'), OFFICIAL_DATA, { state: 'CA', district: '1' })).toEqual([
      'Republic',
      'Constitution-based federal republic',
      'Representative democracy',
    ]);
  });
});
