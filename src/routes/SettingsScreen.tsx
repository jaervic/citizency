// src/routes/SettingsScreen.tsx
// Propósito: pantalla de Ajustes. Agrupa las preferencias que no pertenecen a ninguna pantalla de
// estudio. De momento el tema; las siguientes fases añaden aquí la voz del audio, la copia de
// seguridad del progreso y el estado del almacenamiento.
import { Link } from 'react-router-dom';

import { useStore } from '@/store/useStore';
import { THEME_LABELS, THEME_OPTIONS } from '@/utils/theme';
import type { ThemePreference } from '@/utils/theme';

export default function SettingsScreen() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  return (
    <div className="page">
      <section className="card settings-section">
        <h2 className="settings-title">Tema</h2>
        <p className="settings-hint">
          Elige cómo se ve la app. Con «Sistema» sigue el modo claro u oscuro de tu teléfono o
          computadora, y cambia con él.
        </p>

        <div className="segmented" role="group" aria-label="Tema de la aplicación">
          {THEME_OPTIONS.map((option: ThemePreference) => (
            <button
              key={option}
              type="button"
              className="segment"
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
            >
              {THEME_LABELS[option]}
            </button>
          ))}
        </div>
      </section>

      <Link to="/" className="btn btn--secondary">
        Volver al inicio
      </Link>
    </div>
  );
}
