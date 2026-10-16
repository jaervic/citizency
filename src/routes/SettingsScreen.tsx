// src/routes/SettingsScreen.tsx
// Propósito: pantalla de Ajustes. Agrupa las preferencias que no pertenecen a ninguna pantalla de
// estudio. De momento el tema; las siguientes fases añaden aquí la voz del audio, la copia de
// seguridad del progreso y el estado del almacenamiento.
import { Link } from 'react-router-dom';

import Icon from '@/components/Icon';
import { AUTHOR, DONATION_LABEL, DONATION_URL } from '@/config/support';
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

      <section className="card settings-section">
        <h2 className="settings-title">Instalar la app</h2>
        <p className="settings-hint">
          Añádela a la pantalla de inicio de tu teléfono o computadora para abrirla como una app y
          usarla sin conexión.
        </p>
        <Link to="/install" className="settings-donate">
          <Icon name="download" />
          Ver cómo instalarla
        </Link>
      </section>

      <section className="card settings-section">
        <h2 className="settings-title">Apoyar el proyecto</h2>
        <p className="settings-hint">
          La app es gratis y sin anuncios, y tu progreso se queda en tu dispositivo. Si te está
          sirviendo para prepararte, puedes invitarme a un café. Es voluntario y no desbloquea nada:
          todo el contenido ya está disponible.
        </p>

        <a
          className="settings-donate"
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${DONATION_LABEL} en Ko-fi (se abre en otra pestaña)`}
        >
          <Icon name="coffee" />
          {DONATION_LABEL}
        </a>

        <a
          className="settings-author"
          href={AUTHOR.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`GitHub de ${AUTHOR.name} (se abre en otra pestaña)`}
        >
          <Icon name="github" />
          Hecho por {AUTHOR.name}
        </a>
      </section>

      <Link to="/" className="btn btn--secondary">
        Volver al inicio
      </Link>
    </div>
  );
}
