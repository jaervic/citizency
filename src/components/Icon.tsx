// src/components/Icon.tsx
// Propósito: iconos SVG de la interfaz.
//
// Por qué no emojis: los emojis dependen de que el sistema tenga una fuente de emoji instalada.
// Sin ella (bastantes Linux, algunos Android antiguos, navegadores en modo quiosco) se dibujan
// como una caja vacía (▯), así que la interfaz se veía rota. Estos SVG se dibujan siempre igual,
// heredan el color del texto (`currentColor`) y escalan con el tamaño de la fuente.
import type { ReactNode } from 'react';

/** Iconos disponibles. */
export type IconName =
  | 'back'
  | 'book'
  | 'quiz'
  | 'mic'
  | 'stop'
  | 'chart'
  | 'pin'
  | 'speaker'
  | 'check'
  | 'cross'
  | 'chevron'
  | 'settings'
  | 'github'
  | 'coffee';

/**
 * Iconos de relleno (no de trazo). El logotipo de GitHub solo tiene sentido relleno, así que estos
 * se pintan con `fill` en vez de `stroke`.
 */
const SOLID: ReadonlySet<IconName> = new Set<IconName>(['github']);

/**
 * Trazos de cada icono, en un lienzo de 24x24. Todos usan trazo (no relleno) salvo `stop`, que es
 * un cuadrado relleno.
 */
const PATHS: Record<IconName, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  book: (
    <>
      <path d="M12 6.5C10.5 5 8.5 4.2 4 4.2v13.6c4.5 0 6.5.8 8 2.3 1.5-1.5 3.5-2.3 8-2.3V4.2c-4.5 0-6.5.8-8 2.3z" />
      <path d="M12 6.5v13.6" />
    </>
  ),
  quiz: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M8.5 21h7" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  chart: (
    <>
      <path d="M5 20v-6M12 20V6M19 20v-9" />
      <path d="M3 20h18" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.5h3L12 5.5v13l-5-4H4z" />
      <path d="M16 9.2a4 4 0 0 1 0 5.6M18.8 6.4a8 8 0 0 1 0 11.2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  chevron: <path d="M6 9.5l6 6 6-6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
    </>
  ),
  // Marca de GitHub (trazado de dominio público, como en Simple Icons).
  github: (
    <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.1 4.6 18.1 5 18.1 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z" />
  ),
  coffee: (
    <>
      <path d="M4 8h13v5.5a5.5 5.5 0 0 1-5.5 5.5h-2A5.5 5.5 0 0 1 4 13.5z" />
      <path d="M17 9.5h1.8a2.7 2.7 0 0 1 0 5.4H17" />
      <path d="M6.5 3.2c.7.7.7 1.4 0 2.1M10.5 3.2c.7.7.7 1.4 0 2.1" />
    </>
  ),
};

export type IconProps = {
  name: IconName;
  /** Clase extra; el icono ya lleva la clase base `icon`. */
  className?: string;
};

export default function Icon({ name, className }: IconProps) {
  const solid = SOLID.has(name);

  return (
    <svg
      className={className === undefined ? 'icon' : `icon ${className}`}
      viewBox="0 0 24 24"
      fill={solid ? 'currentColor' : 'none'}
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={solid ? undefined : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
