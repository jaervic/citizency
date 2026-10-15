// src/routes/screens.smoke.test.tsx
// Propósito: renderizar de verdad cada pantalla en el servidor (`renderToString`), con el
// router en memoria. Detecta fallos de ejecución en el render (accesos a datos inexistentes,
// props mal tipadas…) sin necesidad de un DOM ni de dependencias extra.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import App from '@/App';

// Nota: con `renderToString` no se puede comprobar el estado que el usuario configura en runtime,
// porque React usa el "server snapshot" (el estado inicial del store) al renderizar en el
// servidor. La resolución de las respuestas estatales se prueba en `src/utils/content.test.ts` y
// `src/utils/stateOfficials.test.ts`; aquí solo se comprueba que ninguna pantalla revienta.
const ROUTES = ['/', '/flashcards', '/quiz', '/interview', '/progress', '/state', '/ruta-inexistente'];

describe('renderizado de las pantallas', () => {
  for (const route of ROUTES) {
    it(`renderiza ${route} sin errores`, () => {
      const html = renderToString(
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>,
      );

      expect(html.length).toBeGreaterThan(0);
    });
  }

  it('la pantalla de estudio muestra el contador de la sesión', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/flashcards']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('Mostrar respuesta');
  });

  it('el examen de práctica muestra opciones de respuesta', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/quiz']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('Comprobar respuesta');
    expect(html).toContain('role="radiogroup"');
  });

  it('la pantalla "Mi estado" explica para qué sirve', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/state']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('Estado de residencia');
    expect(html).toContain('Elige tu estado');
    // Los 50 estados del dataset llegaron al selector.
    expect(html).toContain('>Wyoming<!-- --> (<!-- -->WY<!-- -->)');
  });
});
