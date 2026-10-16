// src/utils/install.ts
// Propósito: saber en qué plataforma estamos y qué pasos hay que dar para instalar la webapp.
//
// Por qué hace falta: sólo Chrome/Edge (Android y escritorio) ofrecen el diálogo de instalación
// automático (`beforeinstallprompt`). En iPhone/iPad NO existe: hay que hacerlo a mano desde
// Compartir → «Añadir a pantalla de inicio». Y en Firefox de escritorio no se puede instalar, así
// que se explica la alternativa (marcador). Cada plataforma tiene sus pasos.
//
// Son funciones puras: se prueban sin navegador.

/** Dónde está la persona. */
export type Platform = 'ios' | 'android' | 'desktop';

/** Pasos a seguir en cada plataforma (el primero es el título de la sección). */
export const INSTALL_STEPS: Record<Platform, string[]> = {
  ios: [
    'Abre esta página en Safari (en iPhone o iPad no funciona desde Chrome).',
    'Toca el botón Compartir, el cuadrado con la flecha hacia arriba.',
    'Desliza y elige «Añadir a pantalla de inicio».',
    'Toca «Añadir» arriba a la derecha. La app aparecerá con las demás.',
  ],
  android: [
    'Abre el menú del navegador: los tres puntos de arriba a la derecha.',
    'Toca «Instalar aplicación» (o «Añadir a pantalla de inicio»).',
    'Confirma tocando «Instalar».',
  ],
  desktop: [
    'En Chrome o Edge, busca el icono de instalar en la barra de direcciones (una pantalla con una flecha).',
    'Si no lo ves, abre el menú del navegador y elige «Instalar Ciudadanía» o «Instalar aplicación».',
    'Confirma. La app se abre en su propia ventana, sin la barra del navegador.',
  ],
};

/** Nota extra por plataforma. */
export const INSTALL_NOTES: Record<Platform, string> = {
  ios: 'En iPhone y iPad la instalación se hace desde Safari. Si estás en otro navegador, copia la dirección y ábrela en Safari.',
  android: 'Si no aparece la opción, puede que ya esté instalada o que el navegador no lo permita. Chrome es el que mejor lo soporta.',
  desktop: 'En Firefox no se pueden instalar aplicaciones web: puedes añadirla a marcadores para tenerla siempre a mano.',
};

/**
 * Detecta la plataforma a partir del `userAgent` (y del número de puntos táctiles, para distinguir
 * un iPad que se identifica como Mac).
 */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  const ua = userAgent.toLowerCase();

  if (/iphone|ipod/.test(ua)) {
    return 'ios';
  }

  // iPadOS 13+ se anuncia como "Macintosh"; se distingue por los puntos táctiles.
  if (/ipad/.test(ua) || (/macintosh/.test(ua) && maxTouchPoints > 1)) {
    return 'ios';
  }

  if (/android/.test(ua)) {
    return 'android';
  }

  return 'desktop';
}

/** `true` si la app ya se está ejecutando instalada (no dentro de una pestaña del navegador). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  // `navigator.standalone` es la forma de iOS; `display-mode` la estándar.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}
