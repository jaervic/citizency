// src/routes/InstallScreen.tsx
// Propósito: explicar cómo instalar la app en el teléfono o la computadora. Si el navegador ofrece
// el diálogo nativo (Chrome/Edge), el botón lo abre; si no (iPhone, Firefox), se muestran los pasos
// que hay que dar a mano, elegidos según la plataforma detectada.
import { useState } from 'react';
import { Link } from 'react-router-dom';

import Icon from '@/components/Icon';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { INSTALL_NOTES, INSTALL_STEPS } from '@/utils/install';
import type { Platform } from '@/utils/install';

const PLATFORM_TITLES: Record<Platform, string> = {
  ios: 'En iPhone o iPad',
  android: 'En Android',
  desktop: 'En computadora',
};

export default function InstallScreen() {
  const { canPrompt, installed, platform, promptInstall } = useInstallPrompt();
  const [resultado, setResultado] = useState<'accepted' | 'dismissed' | null>(null);

  return (
    <div className="page">
      <section className="card settings-section">
        <h2 className="settings-title">Instalar la app</h2>
        <p className="settings-hint">
          Puedes añadir esta web a tu pantalla de inicio y usarla como una app: se abre a pantalla
          completa, sin la barra del navegador, y funciona sin conexión.
        </p>

        {installed ? (
          <div className="install-done">
            <Icon name="check" />
            <span>Ya la tienes instalada. Estás usando la app como aplicación.</span>
          </div>
        ) : canPrompt ? (
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={async () => {
                const aceptado = await promptInstall();
                setResultado(aceptado ? 'accepted' : 'dismissed');
              }}
            >
              <Icon name="download" />
              Instalar ahora
            </button>
            <p className="settings-hint">
              Se abrirá el aviso de tu navegador para confirmarlo.
            </p>
          </>
        ) : (
          <p className="settings-hint">
            Tu navegador no ofrece la instalación automática, pero se puede hacer a mano:
          </p>
        )}

        {resultado === 'accepted' && (
          <p className="install-ok">¡Listo! Busca el icono en tu pantalla de inicio.</p>
        )}
        {resultado === 'dismissed' && (
          <p className="settings-hint">
            No pasa nada: puedes instalarla cuando quieras desde esta misma pantalla.
          </p>
        )}
      </section>

      {!installed && (
        <section className="card settings-section">
          <h2 className="settings-title">{PLATFORM_TITLES[platform]}</h2>

          <ol className="install-steps">
            {INSTALL_STEPS[platform].map((paso, index) => (
              <li key={paso} className="install-steps__item">
                <span className="install-steps__number">{index + 1}</span>
                <span className="install-steps__text">{paso}</span>
              </li>
            ))}
          </ol>

          <p className="state-note">{INSTALL_NOTES[platform]}</p>
        </section>
      )}

      <p className="settings-hint">
        También puedes instalarla desde otro dispositivo: abre esta misma dirección allí y repite
        los pasos. Tu progreso es de cada dispositivo.
      </p>

      <Link to="/" className="btn btn--secondary">
        Volver al inicio
      </Link>
    </div>
  );
}
