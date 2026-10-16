// src/routes/screens.smoke.test.tsx
// Propósito: renderizar de verdad cada pantalla en el servidor (`renderToString`), con el
// router en memoria. Detecta fallos de ejecución en el render (accesos a datos inexistentes,
// props mal tipadas…) sin necesidad de un DOM ni de dependencias extra.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import App from '@/App';
import { findFontDependentGlyph } from '@/test/glyphs';

// Nota: con `renderToString` no se puede comprobar el estado que el usuario configura en runtime,
// porque React usa el "server snapshot" (el estado inicial del store) al renderizar en el
// servidor. La resolución de las respuestas estatales se prueba en `src/utils/content.test.ts` y
// `src/utils/stateOfficials.test.ts`; aquí solo se comprueba que ninguna pantalla revienta.
const ROUTES = ['/', '/flashcards', '/quiz', '/interview', '/progress', '/state', '/settings', '/ruta-inexistente'];

const renderRoute = (route: string) =>
  renderToString(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );

describe('renderizado de las pantallas', () => {
  for (const route of ROUTES) {
    it(`renderiza ${route} sin errores`, () => {
      expect(renderRoute(route).length).toBeGreaterThan(0);
    });

    it(`${route} usa solo iconos SVG (ningún carácter que dependa de una fuente)`, () => {
      const glyph = findFontDependentGlyph(renderRoute(route));

      expect(glyph, `se coló el carácter ${JSON.stringify(glyph)}`).toBeNull();
    });

    it(`${route} incluye el pie con el crédito y el aviso legal`, () => {
      const html = renderRoute(route);

      expect(html).toContain('Hecho por');
      expect(html).toContain('No está afiliada ni respaldada por USCIS');
      expect(html).toContain('ko-fi.com/jaervic');
    });
  }

  it('la pantalla de estudio muestra el contador de la sesión', () => {
    expect(renderRoute('/flashcards')).toContain('Mostrar respuesta');
  });

  it('el examen de práctica muestra opciones de respuesta', () => {
    const html = renderRoute('/quiz');

    expect(html).toContain('Comprobar respuesta');
    expect(html).toContain('role="radiogroup"');
  });

  it('la pantalla "Mi estado" explica para qué sirve', () => {
    const html = renderRoute('/state');

    expect(html).toContain('Estado de residencia');
    expect(html).toContain('Elige tu estado');
    // Los 50 estados del dataset llegaron al selector.
    expect(html).toContain('>Wyoming<!-- --> (<!-- -->WY<!-- -->)');
  });
});
