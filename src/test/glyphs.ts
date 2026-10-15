// src/test/glyphs.ts
// Propósito: utilidad de prueba compartida para detectar caracteres que dependen de una fuente
// concreta (emoji, flechas, símbolos como ✓ ✗ ▲ ▼). Si el sistema no tiene esa fuente, se dibujan
// como una caja vacía (▯) y la interfaz parece rota: por eso todos los iconos de la app son SVG.
//
// Se usa desde `src/routes/screens.smoke.test.tsx` y `src/components/SessionReview.test.tsx`.

/**
 * Rangos de emoji, flechas y símbolos "dibujados por la fuente". Deja fuera la puntuación normal
 * (guiones largos —, comillas «»), que sí está en cualquier fuente de texto.
 */
const GLYPH_DE_FUENTE =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{25A0}-\u{25FF}]/u;

/** Devuelve el primer carácter problemático del HTML, o `null` si no hay ninguno. */
export function findFontDependentGlyph(html: string): string | null {
  return GLYPH_DE_FUENTE.exec(html)?.[0] ?? null;
}
