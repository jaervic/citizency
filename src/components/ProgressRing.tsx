// src/components/ProgressRing.tsx
// Propósito: anillo de progreso en SVG (sin librerías). Se usa en el inicio y en el progreso,
// donde un anillo se lee mejor que una barra en pantalla de móvil.
import type { CSSProperties, ReactNode } from 'react';

type ProgressRingProps = {
  /** Progreso de 0 a 1 (se recorta a ese rango). */
  value: number;
  /** Diámetro en píxeles. */
  size?: number;
  /** Grosor del trazo en píxeles. */
  stroke?: number;
  /** Color del arco (variable CSS). */
  color?: string;
  /** Color de la pista (variable CSS). */
  track?: string;
  /** Etiqueta accesible. */
  label: string;
  /** Contenido centrado (el porcentaje, normalmente). */
  children?: ReactNode;
};

export default function ProgressRing({
  value,
  size = 76,
  stroke = 8,
  color = 'var(--accent)',
  track = 'var(--color-surface-3)',
  label,
  children,
}: ProgressRingProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="ring"
      style={
        {
          width: size,
          height: size,
          '--ring-color': color,
          '--ring-track': track,
          '--ring-stroke': `${stroke}px`,
        } as CSSProperties
      }
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${label}: ${Math.round(clamped * 100)} %`}
      >
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {children !== undefined && <div className="ring__center">{children}</div>}
    </div>
  );
}
