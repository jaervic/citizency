// src/hooks/useVoices.ts
// Propósito: cargar la lista de voces del navegador.
//
// El detalle que hay que resolver: `speechSynthesis.getVoices()` devuelve una lista VACÍA la primera
// vez (sobre todo en Chrome), y se llena cuando el navegador dispara `voiceschanged`. Si se elige la
// voz sin esperar a ese evento, la lectura sale con la voz por defecto —y esa es, casi siempre, la
// robótica.
import { useEffect, useState } from 'react';

import { rankVoices } from '@/utils/speech';
import type { Voice } from '@/utils/speech';

/** `true` si el navegador puede sintetizar voz. */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Voces en inglés, ordenadas de mejor a peor. */
export function useVoices(): Voice[] {
  const [voices, setVoices] = useState<Voice[]>([]);

  useEffect(() => {
    if (!isSpeechSupported()) {
      return undefined;
    }

    const synth = window.speechSynthesis;
    let activo = true;

    const cargar = () => {
      if (!activo) {
        return;
      }

      const lista = rankVoices(synth.getVoices());

      if (lista.length > 0) {
        setVoices(lista);
      }
    };

    cargar();

    // Si la primera llamada vino vacía, hay que esperar al evento.
    synth.addEventListener('voiceschanged', cargar);

    // Red de seguridad: en algunos navegadores `voiceschanged` no llega nunca.
    const temporizador = window.setTimeout(cargar, 1000);

    return () => {
      activo = false;
      synth.removeEventListener('voiceschanged', cargar);
      window.clearTimeout(temporizador);
    };
  }, []);

  return voices;
}
