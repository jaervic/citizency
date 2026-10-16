// src/utils/categories.ts
// Propósito: dar identidad visual a las 7 categorías del examen. Cada una tiene un color fuerte
// (texto e iconos), su fondo suave para la insignia y una etiqueta corta.
//
// Los colores son VARIABLES CSS (`--cat-N` / `--cat-N-soft`), definidas en `global.css` para el
// tema claro y el oscuro. Así la misma categoría se ve coherente en toda la app y cambia sola con
// el modo nocturno.
import type { Category } from '@/types';

/** Estilo de una categoría. */
export type CategoryStyle = {
  /** Variable CSS del color fuerte. */
  color: string;
  /** Variable CSS del fondo suave. */
  soft: string;
  /** Etiqueta corta para la insignia (el nombre completo es muy largo para una ficha). */
  short: string;
};

/** Nombre completo en español de cada categoría, en el orden oficial del examen. */
export const CATEGORY_ORDER: Category[] = [
  'Principios del gobierno estadounidense',
  'Sistema de gobierno',
  'Derechos y responsabilidades',
  'Período colonial e independencia',
  'Los años 1800',
  'Historia estadounidense reciente',
  'Símbolos y días festivos',
];

/** Estilo de cada categoría. */
export const CATEGORY_STYLE: Record<Category, CategoryStyle> = {
  'Principios del gobierno estadounidense': {
    color: 'var(--cat-1)',
    soft: 'var(--cat-1-soft)',
    short: 'Principios',
  },
  'Sistema de gobierno': { color: 'var(--cat-2)', soft: 'var(--cat-2-soft)', short: 'Sistema' },
  'Derechos y responsabilidades': {
    color: 'var(--cat-3)',
    soft: 'var(--cat-3-soft)',
    short: 'Derechos',
  },
  'Período colonial e independencia': {
    color: 'var(--cat-4)',
    soft: 'var(--cat-4-soft)',
    short: 'Colonial',
  },
  'Los años 1800': { color: 'var(--cat-5)', soft: 'var(--cat-5-soft)', short: 'Años 1800' },
  'Historia estadounidense reciente': {
    color: 'var(--cat-6)',
    soft: 'var(--cat-6-soft)',
    short: 'Reciente',
  },
  'Símbolos y días festivos': { color: 'var(--cat-7)', soft: 'var(--cat-7-soft)', short: 'Símbolos' },
};
