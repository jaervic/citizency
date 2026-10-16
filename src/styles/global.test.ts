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

/** El CSS sin comentarios: los comentarios no deben contar como tokens ni como colores. */
const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Devuelve el bloque de declaraciones de un selector exacto (p. ej. `.home-card`). */
function rule(selector: string, source = css): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(source);

  return match?.[1] ?? '';
}

/** Nombres de los tokens definidos en un bloque de declaraciones. */
function tokensIn(block: string): string[] {
  return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]!);
}

describe('temas', () => {
  // Se analiza el CSS sin comentarios: si no, un ejemplo como `var(--token)` escrito en un
  // comentario aparecería como un token sin definir.
  const light = rule("[data-theme='light']", sinComentarios);
  const dark = rule("[data-theme='dark']", sinComentarios);

  it('existe el bloque del tema oscuro y define tokens', () => {
    expect(tokensIn(dark).length).toBeGreaterThan(20);
  });

  it('todos los tokens del tema claro tienen valor en el oscuro', () => {
    // Si a un token le faltara el valor oscuro, heredaría el claro en silencio y rompería el
    // contraste en modo nocturno.
    const faltan = tokensIn(light).filter((token) => !tokensIn(dark).includes(token));

    expect(faltan, `sin valor en oscuro: ${faltan.join(', ')}`).toEqual([]);
  });

  it('en el tema oscuro la marca (fondo) y el acento (texto) son distintos', () => {
    const brand = /--brand:\s*([^;]+);/.exec(dark)?.[1]?.trim();
    const accent = /--accent:\s*([^;]+);/.exec(dark)?.[1]?.trim();

    expect(brand).toBeDefined();
    expect(accent).toBeDefined();
    expect(brand).not.toBe(accent);
  });

  it('ningún token se define a sí mismo (sería un valor inválido)', () => {
    // `--overlay: var(--overlay)` no define nada: el token queda inválido y todo lo que lo use se
    // queda sin color. Ya pasó una vez al reemplazar colores literales por tokens, y dejó sin fondo
    // el diálogo de confirmación, sin color el foco y sin verde/rojo las opciones del quiz.
    const autorreferencias = [...sinComentarios.matchAll(/(--[a-z0-9-]+)\s*:\s*var\(\s*(--[a-z0-9-]+)\s*\)/g)]
      .filter((match) => match[1] === match[2])
      .map((match) => match[1]!);

    expect(autorreferencias).toEqual([]);
  });

  it('todos los var(--token) que se usan están definidos en algún sitio', () => {
    // Caza erratas del estilo `var(--color-erorr)`, que dejarían la regla sin efecto en silencio.
    const definidos = new Set([...sinComentarios.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]!));
    const usados = [...sinComentarios.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((match) => match[1]!);
    const sinDefinir = [...new Set(usados)].filter((token) => !definidos.has(token));

    expect(sinDefinir, `tokens sin definir: ${sinDefinir.join(', ')}`).toEqual([]);
  });

  it('ningún color literal fuera del bloque de tokens', () => {
    // A partir del marcador "Fin de los tokens" todo debe ir por variables; un color hardcodeado
    // se quedaría igual en modo oscuro y rompería el tema a medias.
    const rest = (css.split('Fin de los tokens')[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    const literales = [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((match) => match[0]);

    expect(literales, `colores sin tematizar: ${literales.join(', ')}`).toEqual([]);
  });
});

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
