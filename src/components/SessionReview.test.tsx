// src/components/SessionReview.test.tsx
// Propósito: probar el repaso de una sesión terminada. Como las respuestas se muestran al desplegar
// cada pregunta (una interacción, que `renderToString` no puede simular), aquí se comprueba la
// estructura y los textos siempre visibles; el desplegado se valida en el flujo E2E con navegador
// (`scripts/e2e.mjs`) y el requisito de "listar TODAS las respuestas aceptadas" se prueba en
// `src/components/AnswerFeedback.test.tsx`, que las muestra sin interacción.
//
// Lo que sí se prueba aquí es que los iconos de acierto/fallo y el chevron son SVG y no glifos que
// dependen de la fuente (✓ ✗ ▲ ▼), que es un fallo que ya se coló una vez.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import SessionReview from '@/components/SessionReview';
import type { SessionReviewItem } from '@/components/SessionReview';
import { findFontDependentGlyph } from '@/test/glyphs';
import { QUESTIONS } from '@/utils/content';

const question = (id: string) => QUESTIONS.find((entry) => entry.id === id)!;

const render = (items: SessionReviewItem[]) =>
  renderToString(
    <MemoryRouter>
      <SessionReview items={items} />
    </MemoryRouter>,
  );

const ITEMS: SessionReviewItem[] = [
  { question: question('gov-001'), wasCorrect: true },
  { question: question('gov-021'), wasCorrect: false, userAnswer: 'Fifty (50)' },
];

describe('SessionReview', () => {
  it('resume el resultado de la sesión', () => {
    const html = render(ITEMS);

    expect(html).toContain('1');
    expect(html).toContain('de');
    expect(html).toContain('2');
    expect(html).toContain('correctas');
    expect(html).toContain('50');
  });

  it('usa iconos SVG en lugar de glifos que dependen de la fuente', () => {
    const html = render(ITEMS);

    expect(html).toContain('<svg');
    expect(findFontDependentGlyph(html)).toBeNull();
  });

  it('numera las preguntas y las deja plegadas, con el desplegable accesible', () => {
    const html = render(ITEMS);

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('>1</span>');
    expect(html).toContain('>2</span>');
    // Las respuestas no se muestran hasta desplegar la pregunta.
    expect(html).not.toContain('Republic');
  });

  it('ofrece los tres filtros', () => {
    const html = render(ITEMS);

    expect(html).toContain('Todas');
    expect(html).toContain('Falladas');
    expect(html).toContain('Acertadas');
  });

  it('sin preguntas no revienta', () => {
    expect(render([])).toContain('No hay preguntas que repasar');
  });
});
