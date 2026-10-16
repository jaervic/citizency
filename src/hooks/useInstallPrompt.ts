// src/hooks/useInstallPrompt.ts
// Propósito: envolver la instalación de la webapp.
//
//   - `canPrompt` + `promptInstall()`: en Chrome/Edge se captura el evento
//     `beforeinstallprompt` y se guarda para poder lanzar el diálogo nativo cuando la persona
//     toque el botón (el navegador exige que sea en respuesta a un gesto).
//   - `installed`: si ya está instalada (`display-mode: standalone` o `navigator.standalone` en
//     iOS), para no seguir ofreciéndola.
//   - `platform`: para mostrar los pasos manuales cuando no hay diálogo automático (iOS, Firefox).
import { useCallback, useEffect, useState } from 'react';

import { detectPlatform, isStandalone } from '@/utils/install';
import type { Platform } from '@/utils/install';

/** El evento no está en los tipos del DOM, así que se declara lo mínimo que se usa. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InstallState = {
  /** `true` si el navegador puede abrir el diálogo nativo de instalación. */
  canPrompt: boolean;
  /** `true` si la app ya se está usando instalada. */
  installed: boolean;
  /** Plataforma detectada, para elegir las instrucciones manuales. */
  platform: Platform;
  /** Abre el diálogo nativo. Devuelve `true` si la persona aceptó. */
  promptInstall: () => Promise<boolean>;
};

export function useInstallPrompt(): InstallState {
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [platform] = useState<Platform>(() =>
    detectPlatform(
      typeof navigator === 'undefined' ? '' : navigator.userAgent,
      typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
    ),
  );

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Sin `preventDefault` el navegador mostraría su propio aviso y perderíamos el control.
      event.preventDefault();
      setDeferred(event as InstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => setInstalled(isStandalone());

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    media.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (deferred === null) {
      return false;
    }

    await deferred.prompt();
    const { outcome } = await deferred.userChoice;

    // El evento solo se puede usar una vez.
    setDeferred(null);

    return outcome === 'accepted';
  }, [deferred]);

  return { canPrompt: deferred !== null, installed, platform, promptInstall };
}
