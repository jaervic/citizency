// src/components/Footer.test.tsx
// Propósito: probar el pie de página. Cubre lo que no se puede dejar al azar: que los enlaces
// externos abran en otra pestaña y de forma segura, que el crédito y el aviso legal estén, y que no
// se cuele ningún glifo dependiente de la fuente.
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import Footer from '@/components/Footer';
import { AUTHOR, DONATION_URL, LEGAL_NOTICE } from '@/config/support';
import { findFontDependentGlyph } from '@/test/glyphs';

const html = renderToString(
  <MemoryRouter>
    <Footer />
  </MemoryRouter>,
);

/**
 * React inserta `<!-- -->` entre nodos de texto contiguos, así que "Hecho por <nombre>" llega al
 * HTML como "Hecho por <!-- --><nombre>". Para comprobar textos se limpian esas marcas.
 */
const texto = html.replace(/<!-- -->/g, '');

describe('Footer', () => {
  it('acredita al autor y enlaza su perfil de GitHub', () => {
    expect(texto).toContain(`Hecho por ${AUTHOR.name}`);
    expect(html).toContain(`href="${AUTHOR.githubUrl}"`);
  });

  it('incluye el enlace de donación a Ko-fi', () => {
    expect(html).toContain(`href="${DONATION_URL}"`);
  });

  it('los enlaces externos abren en otra pestaña y con rel seguro', () => {
    // Cada enlace externo debe llevar target="_blank" y rel="noopener noreferrer".
    const externos = [...html.matchAll(/<a[^>]*target="_blank"[^>]*>/g)].map((match) => match[0]);

    expect(externos.length).toBeGreaterThanOrEqual(2);
    for (const ancla of externos) {
      expect(ancla).toContain('rel="noopener noreferrer"');
    }
  });

  it('avisa de que los enlaces abren fuera (accesibilidad)', () => {
    expect(html).toContain('se abre en otra pestaña');
  });

  it('muestra el aviso legal en todas las pantallas', () => {
    expect(html).toContain(LEGAL_NOTICE);
  });

  it('usa iconos SVG y ningún carácter que dependa de la fuente', () => {
    expect(html).toContain('<svg');
    expect(findFontDependentGlyph(html)).toBeNull();
  });

  it('no carga nada de terceros (solo enlaces)', () => {
    // Nada de <script>, <iframe> ni <img> de fuera: la promesa es que no hay peticiones externas
    // hasta que la persona hace clic.
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<img');
  });
});
