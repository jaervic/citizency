// src/utils/fuzzyMatch.test.ts
// Pruebas del comparador difuso que usa la entrevista. Cubren la alineación con el TTS (el
// contenido entre paréntesis se ignora), las contracciones, los números escritos de otra forma
// y el umbral de aceptación.
import { describe, expect, it } from 'vitest';

import { fuzzyMatch, normalize, similarity } from '@/utils/fuzzyMatch';

describe('normalize', () => {
  it('quita el contenido entre paréntesis (igual que el TTS)', () => {
    expect(normalize('Freed the slaves (Emancipation Proclamation)')).toBe('freed the slaves');
  });

  it('expande contracciones', () => {
    expect(normalize("don't")).toBe('do not');
  });

  it('escribe en palabras los números de 0 a 100', () => {
    expect(normalize('27')).toBe('twenty seven');
  });
});

describe('similarity', () => {
  it('da 1 a dos textos idénticos', () => {
    expect(similarity('republic', 'republic')).toBe(1);
  });
});

describe('fuzzyMatch', () => {
  it('acepta la respuesta cuando coincide con la oficial', () => {
    const result = fuzzyMatch('Freed the slaves', ['Freed the slaves (Emancipation Proclamation)']);
    expect(result.matched).toBe(true);
    expect(result.score).toBe(1);
  });

  it('acepta un número dicho en dígitos o en palabras', () => {
    expect(fuzzyMatch('twenty seven', ['Twenty-seven (27)']).matched).toBe(true);
    expect(fuzzyMatch('27', ['Twenty-seven (27)']).matched).toBe(true);
  });

  it('rechaza una respuesta que no tiene nada que ver', () => {
    expect(fuzzyMatch('banana', ['Republic']).matched).toBe(false);
  });

  it('sin respuestas aceptadas nunca da por bueno nada', () => {
    const result = fuzzyMatch('anything', []);
    expect(result.matched).toBe(false);
    expect(result.bestGuess).toBe('');
  });
});
