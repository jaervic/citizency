// src/utils/theme.ts
// Propósito: decidir y aplicar el tema visual (claro/oscuro). La preferencia del usuario puede ser
// 'system' (seguir al sistema operativo), 'light' o 'dark'.
//
// El atributo `data-theme` del elemento <html> es lo que activa los tokens del tema en
// `src/styles/global.css`. Lo pone un script en línea de `index.html` antes del primer pintado
// (para no ver un destello del tema equivocado) y, a partir de ahí, lo mantiene al día
// `useThemeEffect()`.

/** Lo que elige el usuario. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** El tema que se aplica de verdad (ya resuelta la preferencia). */
export type ResolvedTheme = 'light' | 'dark';

/** Etiqueta de cada opción, para la interfaz. */
export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

/**
 * Color de la barra del navegador (`theme-color`) y del fondo del sistema en cada tema. Debe
 * coincidir con `--brand` de `global.css`: si no, en móvil se ve una franja de otro azul.
 */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: '#1a3a6b',
  dark: '#16233c',
};

/** Orden de las opciones en la interfaz. */
export const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

/** Resuelve la preferencia ('system' mira el sistema operativo). Función pura. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return prefersDark ? 'dark' : 'light';
  }

  return preference;
}

/** `true` si el sistema operativo pide tema oscuro. */
export function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Aplica el tema: atributo en <html> y color de la barra del navegador. Marca también el
 * `color-scheme` para que los controles nativos (select, scrollbar, autofill) acompañen.
 */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;

  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta !== null) {
    meta.setAttribute('content', THEME_COLORS[theme]);
  }
}
