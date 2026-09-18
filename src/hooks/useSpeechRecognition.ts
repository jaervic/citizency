// src/hooks/useSpeechRecognition.ts
// Propósito: envolver `expo-speech-recognition` en un hook con una API propia y estable para la
// pantalla de entrevista. La librería ya abstrae las diferencias entre plataformas (Web Speech API
// en web, `SpeechRecognizer` en Android, `SFSpeechRecognizer` en iOS) y emite el MISMO mapa de
// eventos en todas, así que este hook se centra en lo que la UI no debería tener que resolver:
//   1. Reducir el ciclo de vida a cuatro estados: idle / listening / processing / error.
//   2. Traducir los códigos de error del motor a mensajes legibles en español.
//   3. Encapsular disponibilidad, permisos y suscripción a eventos, sin fugas al desmontar.
//
// El hook no pinta nada ni decide cuándo grabar: expone `start`, `stop` y `reset`. La pantalla
// `app/interview.tsx` lo consumirá en el sub-bloque 3.3.
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import type { ExpoSpeechRecognitionErrorCode } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** Idioma por defecto del reconocimiento: la entrevista del USCIS se rinde en inglés. */
const DEFAULT_LANG = 'en-US';

/** Mensaje cuando el dispositivo no tiene ningún motor de reconocimiento de voz. */
const NOT_AVAILABLE_MESSAGE = 'El reconocimiento de voz no está disponible en este dispositivo.';

/** Mensaje cuando el usuario deniega el permiso de micrófono o de reconocimiento. */
const PERMISSION_DENIED_MESSAGE =
  'Sin permiso de micrófono no se puede transcribir tu respuesta. Habilítalo en los ajustes del dispositivo.';

/** Mensaje de reserva para un fallo sin código conocido o sin mensaje del motor. */
const GENERIC_ERROR_MESSAGE = 'No se pudo transcribir la respuesta. Inténtalo de nuevo.';

/**
 * Mensajes en español para los códigos de error de `expo-speech-recognition`.
 *
 * Es un `Partial<Record<...>>` a propósito: si la librería añade un código nuevo, aquí no hay que
 * tocarlo para que compile y el hook cae al mensaje del evento o al genérico.
 */
const ERROR_MESSAGES: Partial<Record<ExpoSpeechRecognitionErrorCode, string>> = {
  aborted: 'Se canceló la escucha antes de terminar.',
  'audio-capture': 'No se pudo acceder al micrófono. Comprueba que ninguna otra app lo esté usando.',
  interrupted: 'La escucha se interrumpió (¿una llamada o el asistente de voz?). Inténtalo de nuevo.',
  'bad-grammar': 'El motor de voz no entendió la configuración de la escucha.',
  'language-not-supported': 'El idioma configurado no está disponible en este dispositivo.',
  network: 'La transcripción necesita conexión y la red falló. Comprueba tu conexión.',
  'no-speech': 'No se oyó ninguna respuesta. Inténtalo de nuevo.',
  'not-allowed': 'No hay permiso para usar el micrófono o el reconocimiento de voz.',
  'service-not-allowed': 'El reconocimiento de voz no está disponible en este dispositivo.',
  busy: 'El reconocimiento de voz está ocupado ahora mismo. Inténtalo de nuevo en unos segundos.',
  client: 'El reconocimiento de voz falló en el dispositivo. Inténtalo de nuevo.',
  'speech-timeout': 'Se agotó el tiempo de espera sin oír una respuesta.',
  unknown: GENERIC_ERROR_MESSAGE,
};

/** Fase del reconocimiento, tal y como la ve la UI. */
export type SpeechRecognitionState =
  /** Ni escuchando ni procesando: en reposo (o tras terminar). */
  | 'idle'
  /** El micrófono está abierto y llegan transcripciones parciales. */
  | 'listening'
  /** Se pidió parar y se espera el resultado final del motor. */
  | 'processing'
  /** Algo falló (sin motor, sin permiso, error del motor): ver `error`. */
  | 'error';

/** API pública del hook. */
export type UseSpeechRecognitionResult = {
  /** Fase actual del reconocimiento. */
  state: SpeechRecognitionState;
  /**
   * Transcripción en vivo (parcial) durante `'listening'`, o la definitiva tras el resultado final.
   * Se vacía al llamar a `start()` y a `reset()`.
   */
  transcript: string;
  /** `true` si el dispositivo tiene motor de reconocimiento de voz utilizable. */
  isAvailable: boolean;
  /** Mensaje legible para el usuario cuando `state === 'error'`; `null` en cualquier otro caso. */
  error: string | null;
  /**
   * Empieza a escuchar (pidiendo permisos si hacen falta). Es idempotente: si ya hay una escucha en
   * curso, no hace nada. Deja `state` en `'listening'` o en `'error'`.
   */
  start: () => Promise<void>;
  /**
   * Deja de escuchar y espera el resultado final: pasa a `'processing'` y de ahí a `'idle` cuando
   * el motor emite el último resultado (o su evento `end`). No hace nada si no hay escucha activa.
   */
  stop: () => Promise<void>;
  /** Limpia `transcript` y `error` y vuelve a `'idle'` (p. ej. al pasar a la siguiente pregunta). */
  reset: () => void;
};

/**
 * Reconocimiento de voz listo para la UI de la entrevista: arranca y para la escucha, expone la
 * transcripción (parcial y final) y traduce los fallos a mensajes en español.
 *
 * Funciona igual en web y en Android porque `expo-speech-recognition` normaliza los eventos de las
 * dos plataformas; el único punto que se trata distinto es el permiso (en web lo gestiona el
 * navegador, ver `start`).
 *
 * @param options Ajustes opcionales del reconocimiento:
 *   - `lang`: idioma BCP-47 (por defecto `'en-US'`, el de la entrevista).
 *   - `interimResults`: `true` (por defecto) para ver la transcripción en vivo mientras se habla.
 * @returns Estado, transcripción, disponibilidad del motor, mensaje de error y acciones.
 */
export function useSpeechRecognition(options?: {
  /** Idioma BCP-47 del reconocimiento. Por defecto `'en-US'`. */
  lang?: string;
  /** Si es `true` (por defecto) llegan transcripciones parciales mientras el usuario habla. */
  interimResults?: boolean;
}): UseSpeechRecognitionResult {
  const lang = options?.lang ?? DEFAULT_LANG;
  const interimResults = options?.interimResults ?? true;

  const [state, setState] = useState<SpeechRecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  /**
   * `true` desde que se llama a `start()` hasta que el motor termina. Es la fuente de verdad de la
   * idempotencia: dos pulsaciones rápidas llegan antes de que React vuelva a renderizar, así que no
   * se puede decidir solo con `state`.
   */
  const isActiveRef = useRef(false);

  // `isRecognitionAvailable()` es SÍNCRONO, pero se consulta en un efecto: así no se toca el módulo
  // nativo durante el render (ni en el render de servidor de la versión web) y el estado refleja la
  // disponibilidad real en cuanto el componente está montado. En web mira si el navegador expone la
  // Web Speech API.
  useEffect(() => {
    setIsAvailable(ExpoSpeechRecognitionModule.isRecognitionAvailable());
  }, []);

  /** Da por cerrada la escucha activa y deja el estado indicado. */
  const finish = useCallback((nextState: SpeechRecognitionState) => {
    isActiveRef.current = false;
    setState(nextState);
  }, []);

  // Resultado parcial o final: la mejor alternativa siempre viene en `results[0]`.
  useSpeechRecognitionEvent('result', (event) => {
    const best = event.results[0]?.transcript ?? '';

    if (best.length > 0) {
      setTranscript(best);
    }

    // El motor puede dar la escucha por terminada sin que el usuario pulse "Parar" (silencio, o
    // `continuous: false`): el resultado final es la señal de que hay que volver a 'idle'.
    if (event.isFinal) {
      finish('idle');
    }
  });

  // Error del motor o del permiso: se traduce a español y se registra con el prefijo del repo.
  useSpeechRecognitionEvent('error', (event) => {
    const message = ERROR_MESSAGES[event.error] ?? event.message ?? GENERIC_ERROR_MESSAGE;

    console.warn('[speechRecognition] error del motor:', event.error, event.message, event.code);
    setError(message);
    finish('error');
  });

  // `end` es la red de seguridad del ciclo: llega tras `stop()` y también cuando el motor para por
  // su cuenta. Nunca pisa un 'error', porque ahí el mensaje debe seguir visible para el usuario.
  useSpeechRecognitionEvent('end', () => {
    isActiveRef.current = false;
    setState((current) => (current === 'error' ? current : 'idle'));
  });

  const start = useCallback(async () => {
    if (isActiveRef.current) {
      return;
    }

    setError(null);

    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      console.warn('[speechRecognition] no hay motor de reconocimiento disponible');
      setIsAvailable(false);
      setError(NOT_AVAILABLE_MESSAGE);
      setState('error');
      return;
    }

    setIsAvailable(true);

    // En web `requestPermissionsAsync()` no está soportado: la propia librería avisa por consola y
    // devuelve un permiso concedido. El navegador pide el micrófono al arrancar el reconocimiento,
    // así que aquí solo se pide en plataformas nativas.
    if (Platform.OS !== 'web') {
      try {
        const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

        if (!permission.granted) {
          console.warn('[speechRecognition] permiso denegado:', permission.status);
          setError(PERMISSION_DENIED_MESSAGE);
          setState('error');
          return;
        }
      } catch (cause) {
        console.warn('[speechRecognition] fallo al pedir permisos:', cause);
        setError(PERMISSION_DENIED_MESSAGE);
        setState('error');
        return;
      }
    }

    setTranscript('');
    isActiveRef.current = true;
    setState('listening');

    try {
      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults,
        // Una respuesta de entrevista la cierra el usuario (o el silencio): no queremos que el
        // motor siga escuchando indefinidamente.
        continuous: false,
      });
    } catch (cause) {
      console.warn('[speechRecognition] no se pudo iniciar la escucha:', cause);
      setError(GENERIC_ERROR_MESSAGE);
      finish('error');
    }
  }, [finish, interimResults, lang]);

  const stop = useCallback(async () => {
    if (!isActiveRef.current) {
      return;
    }

    setState('processing');

    try {
      // `stop()` (y no `abort()`) para que el motor entregue el resultado final de lo ya dicho.
      ExpoSpeechRecognitionModule.stop();
    } catch (cause) {
      console.warn('[speechRecognition] no se pudo detener la escucha:', cause);
      finish('idle');
    }
  }, [finish]);

  const reset = useCallback(() => {
    isActiveRef.current = false;
    setTranscript('');
    setError(null);
    setState('idle');
  }, []);

  // Al desmontar: cortar la escucha sin esperar resultado final (`abort` en vez de `stop`); ya no
  // hay nadie a quien contárselo. Las suscripciones a eventos las libera `useSpeechRecognitionEvent`.
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        isActiveRef.current = false;
        ExpoSpeechRecognitionModule.abort();
      }
    };
  }, []);

  return { state, transcript, isAvailable, error, start, stop, reset };
}

