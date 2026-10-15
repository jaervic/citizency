// src/styles/global.test.ts
// Propósito: dejar por escrito (y comprobado) el contrato de la hoja de estilos que se rompió una
// vez y dejó la app con mal aspecto:
//   1. Los enlaces heredaban el azul y el subrayado del navegador, así que las tarjetas del inicio
//      y los botones hechos con `<a>` salían subrayados.
//   2. El título y el subtítulo de las tarjetas de inicio son `<span>` (elementos en línea) y se
//      pegaban en la misma línea.
// No hay pruebas de CSS en navegador en el proyecto, así que estas comprobaciones textuales evitan
// que vuelvan a colarse.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./global.css', import.meta.url), 'utf8');

/** Devuelve el bloque de declaraciones de un selector exacto (p. ej. `.home-card`). */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(css);

  return match?.[1] ?? '';
}

describe('contrato de la hoja de estilos', () => {
  it('los enlaces no heredan el azul ni el subrayado del navegador', () => {
    const block = rule('a');

    expect(block).toContain('color: inherit');
    expect(block).toContain('text-decoration: none');
  });

  it('los enlaces dentro de un texto sí se subrayan', () => {
    expect(rule('.state-link')).toContain('text-decoration: underline');
  });

  it('las tarjetas del inicio apilan el título y el subtítulo', () => {
    expect(rule('.home-card')).toContain('flex-direction: column');
    expect(rule('.home-card__title')).toContain('display: flex');
    expect(rule('.home-card__subtitle')).toContain('display: block');
  });

  it('los iconos SVG escalan con el tamaño de la fuente', () => {
    expect(rule('.icon')).toContain('1.15em');
  });
});
