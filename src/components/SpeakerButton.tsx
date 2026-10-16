// src/components/SpeakerButton.tsx
// Propósito: leer en voz alta (en inglés) un texto del examen con la Web Speech API
// (`speechSynthesis`). Sustituye al `expo-speech` de la versión nativa: en web la síntesis de voz es
// del propio navegador, así que no hace falta ninguna clave de API ni conexión.
//
// La voz NO se coge al azar: `src/utils/speech.ts` puntúa las disponibles y prefiere las que
// necesitan internet (las "Google…" de Chrome y las "… Online (Natural)" de Edge), que son las que
// mejor suenan. Si la persona ha elegido una voz en Ajustes, se respeta.
//
// `sanitizeForSpeech` se exporta porque `src/utils/fuzzyMatch.ts` documenta que normaliza el texto
// igual que lo sanea este botón: lo que el usuario oye y lo que se compara deben coincidir.
import { useCallback, useEffect, useRef, useState } from 'react';

import { useVoices } from '@/hooks/useVoices';
import { useStore } from '@/store/useStore';
import { isNetworkVoice, rankVoices, resolveVoice } from '@/utils/speech';
import type { Voice } from '@/utils/speech';

/**
 * Prepara un texto para leerlo: quita el contenido entre paréntesis y corchetes (casi siempre
 * aclaraciones que no se dicen en voz alta, p. ej. "(U.S.) Congress" -> "Congress") y colapsa los
 * espacios.
 */
export function sanitizeForSpeech(text: string): string {
  const cleaned = text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Si al quitar los paréntesis no queda nada (p. ej. la respuesta era solo "(U.S.)"),
  // se lee el texto original para no quedarse en silencio.
  return cleaned.length > 0 ? cleaned : text.trim();
}

/** `true` si el navegador puede sintetizar voz. */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Icono de altavoz (SVG inline para no depender de emojis). */
function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
    </svg>
  );
}

type SpeakerButtonProps = {
  /** Texto en inglés que se leerá. */
  text: string;
  /** Etiqueta accesible y, si `compact` es falso, texto visible (por defecto "Escuchar"). */
  label?: string;
  /** Solo el icono, para listas compactas. */
  compact?: boolean;
  /** Velocidad de lectura (por defecto 0.95, algo más lenta para estudiantes). */
  rate?: number;
  className?: string;
};

export default function SpeakerButton({
  text,
  label = 'Escuchar',
  compact = false,
  rate = 0.95,
  className,
}: SpeakerButtonProps) {
  const [supported] = useState(isSpeechSynthesisSupported);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const voices = useVoices();
  const preferredVoiceName = useStore((state) => state.voiceName);

  // Al desmontar se corta la lectura y se sueltan los callbacks.
  useEffect(
    () => () => {
      const utterance = utteranceRef.current;

      if (utterance !== null) {
        utterance.onstart = null;
        utterance.onend = null;
        utterance.onerror = null;
      }

      if (isSpeechSynthesisSupported()) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  // Al cambiar de voz se corta la lectura en curso, para que se note el cambio.
  useEffect(() => {
    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  }, [preferredVoiceName]);

  /** Lanza la lectura con una voz concreta. */
  const speakWith = useCallback(
    (voice: Voice | null, isRetry: boolean) => {
      const synth = window.speechSynthesis;
      const utterance = new SpeechSynthesisUtterance(sanitizeForSpeech(text));

      utterance.lang = 'en-US';
      utterance.rate = rate;

      if (voice !== null) {
        utterance.voice = voice;
      }

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
      };
      utterance.onerror = () => {
        setSpeaking(false);

        // Las voces que necesitan internet fallan sin conexión: se reintenta una vez con la mejor
        // voz LOCAL, para que el botón nunca se quede mudo.
        const puedeReintentar = !isRetry && voice !== null && isNetworkVoice(voice);

        if (puedeReintentar) {
          const local = rankVoices(synth.getVoices()).find((candidata) => !isNetworkVoice(candidata)) ?? null;
          speakWith(local, true);
        }
      };

      utteranceRef.current = utterance;

      // `cancel()` seguido de `speak()` se ignora en algunos Chrome; un pequeño respiro lo evita.
      synth.cancel();
      window.setTimeout(() => synth.speak(utterance), 60);
    },
    [rate, text],
  );

  const speak = useCallback(() => {
    if (!supported) {
      return;
    }

    const synth = window.speechSynthesis;

    // Si este botón ya está leyendo, el toque lo detiene.
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }

    speakWith(
      // Se prefiere la lista que ya tiene el hook (cargada y ordenada); si aún está vacía se le
      // pregunta al navegador por si acaba de llenarla.
      resolveVoice(voices.length > 0 ? voices : synth.getVoices(), preferredVoiceName),
      false,
    );
  }, [preferredVoiceName, speaking, speakWith, supported, voices]);

  if (!supported) {
    return null;
  }

  return (
    <button
      type="button"
      className={className}
      onClick={speak}
      aria-label={speaking ? 'Detener lectura' : label}
      aria-pressed={speaking}
      title={speaking ? 'Detener lectura' : label}
    >
      <SpeakerIcon />
      {!compact && <span>{speaking ? 'Detener' : label}</span>}
    </button>
  );
}
