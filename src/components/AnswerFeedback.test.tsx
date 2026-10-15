// src/components/AnswerFeedback.test.tsx
// Propósito: probar el resultado de una pregunta corregida (quiz y entrevista). Aquí sí se puede
// comprobar en el servidor el requisito de producto de que se listen TODAS las respuestas
// aceptadas, no solo la primera: este componente las muestra sin necesidad de desplegar nada.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import AnswerFeedback from '@/components/AnswerFeedback';
import { OFFICIAL_DATA, QUESTIONS } from '@/utils/content';
import { findFontDependentGlyph } from '@/test/glyphs';
import type { Question } from '@/types';

const question = (id: string) => QUESTIONS.find((entry) => entry.id === id)!;

const render = (props: {
  question: Question;
  wasCorrect: boolean;
  userAnswer?: string;
  score?: number;
}) =>
  renderToString(
    <MemoryRouter>
      <AnswerFeedback {...props} />
    </MemoryRouter>,
  );

describe('AnswerFeedback', () => {
  it('lista TODAS las respuestas aceptadas, no solo la primera', () => {
    const multi = question('gov-001');
    expect(multi.answers_en.length).toBeGreaterThan(1);

    const html = render({ question: multi, wasCorrect: false });

    for (const answer of multi.answers_en) {
      expect(html, `falta "${answer}"`).toContain(answer);
    }
    expect(html).toContain('Respuestas correctas');
  });

  it('en singular cuando solo hay una respuesta', () => {
    const html = render({ question: question('gov-002'), wasCorrect: true });

    expect(html).toContain('Respuesta correcta');
    expect(html).not.toContain('Respuestas correctas');
  });

  it('avisa del acierto y muestra lo que respondió el usuario', () => {
    const html = render({ question: question('gov-001'), wasCorrect: true, userAnswer: 'Republic' });

    expect(html).toContain('Correcto');
    expect(html).toContain('Republic');
  });

  it('avisa del fallo y muestra el porcentaje de coincidencia de la entrevista', () => {
    const html = render({
      question: question('gov-001'),
      wasCorrect: false,
      userAnswer: 'banana',
      score: 0.42,
    });

    expect(html).toContain('incorrecta');
    expect(html).toContain('42');
  });

  it('en una pregunta dinámica muestra el dato oficial vigente', () => {
    const html = render({ question: question('gov-038'), wasCorrect: true });

    expect(html).toContain(OFFICIAL_DATA.president);
  });

  it('no usa glifos que dependan de la fuente', () => {
    expect(findFontDependentGlyph(render({ question: question('gov-001'), wasCorrect: true }))).toBeNull();
  });
});
