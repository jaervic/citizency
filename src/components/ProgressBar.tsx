// src/components/ProgressBar.tsx
// Propósito: barra de progreso reutilizable (sesiones de estudio, quiz, categorías…).
// Mobile-first: altura mínima visible y sin texto dentro (el texto va al lado).
type ProgressBarProps = {
  /** Progreso de 0 a 1 (se recorta a ese rango). */
  value: number;
  /** Altura en píxeles (por defecto 8). */
  height?: number;
  /** Etiqueta accesible que describe la barra. */
  label?: string;
};

export default function ProgressBar({ value, height = 8, label }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const percentage = Math.round(clamped * 100);

  return (
    <div
      className="progress-bar"
      style={{ height }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percentage}
      aria-label={label}
    >
      <div className="progress-bar__fill" style={{ width: `${percentage}%` }} />
    </div>
  );
}
