// src/utils/theme.test.ts
// Pruebas de la lógica del tema (funciones puras).
import { describe, expect, it } from 'vitest';

import {
  THEME_COLORS,
  THEME_LABELS,
  THEME_OPTIONS,
  resolveTheme,
  systemPrefersDark,
} from '@/utils/theme';

describe('resolveTheme', () => {
  it('respeta una preferencia explícita', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('con «sistema» sigue al sistema operativo', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});

describe('catálogo de temas', () => {
  it('ofrece las tres opciones, empezando por «sistema»', () => {
    expect(THEME_OPTIONS).toEqual(['system', 'light', 'dark']);
  });

  it('cada opción tiene etiqueta en español', () => {
    for (const option of THEME_OPTIONS) {
      expect(THEME_LABELS[option].length).toBeGreaterThan(0);
    }
  });

  it('cada tema resuelto tiene su color de barra del navegador', () => {
    expect(THEME_COLORS.light).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_COLORS.dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_COLORS.light).not.toBe(THEME_COLORS.dark);
  });
});

describe('systemPrefersDark', () => {
  it('en el entorno de pruebas (sin window) devuelve false sin reventar', () => {
    expect(typeof systemPrefersDark()).toBe('boolean');
  });
});
