// src/components/SpeakerButton.tsx
// Propósito: leer en voz alta (en inglés) un texto del examen con la Web Speech API
// (`speechSynthesis`). Sustituye al `expo-speech` de la versión nativa: en web la síntesis
// de voz es del propio navegador, así que no hace falta ninguna clave de API ni conexión.
//
// `sanitizeForSpeech` se exporta porque `src/utils/fuzzyMatch.ts` documenta que normaliza el
// texto igual que lo sanea este botón: lo que el usuario oye y lo que se compara deben coincidir.
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Prepara un texto para leerlo: quita el contenido entre paréntesis y corchetes (casi
 * siempre aclaraciones que no se dicen en voz alta, p. ej. "(U.S.) Congress" -> "Congress") y
 * colapsa los espacios.
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

    const utterance = new SpeechSynthesisUtterance(sanitizeForSpeech(text));
    utterance.lang = 'en-US';
    utterance.rate = rate;

    // Se prefiere una voz en inglés si el navegador ya la tiene cargada.
    const englishVoice = synth.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('en'));
    if (englishVoice !== undefined) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    utteranceRef.current = utterance;

    // `cancel()` seguido de `speak()` se ignora en algunos Chrome; un pequeño respiro lo evita.
    synth.cancel();
    window.setTimeout(() => synth.speak(utterance), 60);
  }, [rate, speaking, supported, text]);

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
