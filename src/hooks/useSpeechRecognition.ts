// src/hooks/useSpeechRecognition.ts
// Propósito: exponer el reconocimiento de voz del navegador (Web Speech API) con una API
// pequeña y estable: `supported`, `isListening`, `transcript`, `error`, `start`, `stop` y
// `clear`.
//
// Soporte real (2025/2026): funciona en Chrome y Edge de escritorio y Android, y en Safari
// 14.1+ (iOS/macOS). Requiere HTTPS (Vercel lo sirve) o localhost. Firefox NO lo soporta:
// las pantallas deben degradar a escribir la respuesta a mano cuando `supported` es `false`.
//
// La versión nativa usaba `expo-speech-recognition`; aquí se usa el objeto global
// `SpeechRecognition`/`webkitSpeechRecognition` directamente. Como TypeScript no siempre
// trae estos tipos en `lib.dom`, se declaran localmente en vez de depender de ellos.
import { useCallback, useEffect, useRef, useState } from 'react';

/* ------------------------------------------- Tipos mínimos de la Web Speech API */

type SpeechAlternative = { transcript: string; confidence: number };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechResultList = { length: number; [index: number]: SpeechResult };
type SpeechResultEvent = { resultIndex: number; results: SpeechResultList };
type SpeechErrorEvent = { error: string; message?: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** Devuelve el constructor disponible en el navegador, o `null` si no lo hay. */
function getRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/** Mensajes en español para los códigos de error de la Web Speech API. */
const ERROR_MESSAGES: Record<string, string> = {
  'no-speech': 'No se detectó voz. Acércate al micrófono e inténtalo de nuevo.',
  'audio-capture': 'No se encontró un micrófono. Revisa el dispositivo e inténtalo de nuevo.',
  'not-allowed': 'Bloqueaste el acceso al micrófono. Permítelo en el navegador para usar la voz.',
  'service-not-allowed': 'El navegador no permite el reconocimiento de voz en este momento.',
  network: 'Sin conexión con el servicio de voz. Revisa tu internet o escribe la respuesta.',
  aborted: 'Se canceló la escucha.',
  'language-not-supported': 'Tu navegador no admite el reconocimiento de voz en inglés.',
  'bad-grammar': 'No se pudo interpretar el audio. Inténtalo otra vez.',
};

/** Mensaje en español de un error de reconocimiento. */
function describeError(code: string): string {
  return ERROR_MESSAGES[code] ?? `No se pudo reconocer la voz (${code}). Escribe la respuesta o reinténtalo.`;
}

export type SpeechRecognitionState = {
  /** `true` si el navegador soporta reconocimiento de voz. */
  supported: boolean;
  /** `true` mientras el micrófono está escuchando. */
  isListening: boolean;
  /** Texto reconocido (se va completando mientras llegan resultados parciales). */
  transcript: string;
  /** Mensaje de error en español, o `null`. */
  error: string | null;
  /** Empieza a escuchar (reinicia el texto y el error). */
  start: () => void;
  /** Deja de escuchar conservando lo reconocido. */
  stop: () => void;
  /** Limpia el texto reconocido y el error. */
  clear: () => void;
};

/**
 * Reconocimiento de voz de una respuesta corta en inglés.
 * @param lang Idioma del reconocimiento (por defecto 'en-US': el examen se rinde en inglés).
 */
export function useSpeechRecognition(lang = 'en-US'): SpeechRecognitionState {
  const [supported] = useState(() => getRecognitionConstructor() !== null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Texto ya confirmado (resultados finales); los parciales se añaden solo para mostrar.
  const finalTextRef = useRef('');

  useEffect(() => {
    const Constructor = getRecognitionConstructor();

    if (Constructor === null) {
      return undefined;
    }

    const recognition = new Constructor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      let interim = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];

        if (alternative === undefined) {
          continue;
        }

        if (result.isFinal) {
          finalTextRef.current = `${finalTextRef.current} ${alternative.transcript}`.trim();
        } else {
          interim = `${interim} ${alternative.transcript}`.trim();
        }
      }

      setTranscript(`${finalTextRef.current} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      // 'aborted' suele ser consecuencia de parar nosotros: no es un fallo que mostrar.
      if (event.error === 'aborted') {
        return;
      }

      setError(describeError(event.error));
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;

    if (recognition === null) {
      setError('Este navegador no permite el reconocimiento de voz. Escribe tu respuesta.');
      return;
    }

    setError(null);
    finalTextRef.current = '';
    setTranscript('');

    try {
      recognition.start();
    } catch {
      // Llamar a `start()` con una escucha ya activa lanza excepción: se ignora.
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;

    if (recognition === null) {
      return;
    }

    try {
      recognition.stop();
    } catch {
      // Si ya estaba parada, `stop()` puede lanzar: se ignora.
    }
  }, []);

  const clear = useCallback(() => {
    finalTextRef.current = '';
    setTranscript('');
    setError(null);
  }, []);

  return { supported, isListening, transcript, error, start, stop, clear };
}
