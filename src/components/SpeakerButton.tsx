// src/components/SpeakerButton.tsx
// Propósito: botón reutilizable de pronunciación para los textos en inglés de la app
// (enunciados, respuestas y vocabulario). Usa `expo-speech`, que es gratuito, funciona sin
// conexión y no necesita claves de API. Al pulsarlo corta el audio en curso y lee el texto
// indicado con voz en inglés (limpiando antes paréntesis y corchetes, ver `sanitizeForSpeech`);
// mientras habla, el ícono cambia para dar feedback visual.
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

/** Tamaños admitidos: el botón crece junto al texto que acompaña. */
export type SpeakerSize = 'small' | 'medium' | 'large';

type SpeakerButtonProps = {
  /** Texto en inglés que se pronuncia al pulsar (enunciado, respuesta o palabra). */
  text: string;
  /** Tamaño del botón; por defecto `'medium'`. */
  size?: SpeakerSize;
};

/** Idioma de la pronunciación. */
const SPEECH_LANGUAGE = 'en-US';
/** Velocidad de la voz: algo más lenta que la normal (1.0) para entenderla mejor. */
const SPEECH_RATE = 0.9;
/** Tono normal de la voz. */
const SPEECH_PITCH = 1.0;
/**
 * Estimación de milisegundos por carácter para mantener el ícono "hablando". `expo-speech`
 * no informa de la duración de la frase, así que se aproxima por su longitud.
 */
const FEEDBACK_MS_PER_CHARACTER = 80;
/** Duración mínima del feedback visual (ms), para textos muy cortos. */
const MIN_FEEDBACK_MS = 800;

/** Tamaño de letra del ícono según el tamaño del botón. */
const SIZE_FONT_SIZE: Record<SpeakerSize, number> = {
  small: 14,
  medium: 18,
  large: 22,
};

/** Espaciado interior del botón según su tamaño. */
const SIZE_PADDING: Record<SpeakerSize, { paddingHorizontal: number; paddingVertical: number }> = {
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  medium: { paddingHorizontal: 8, paddingVertical: 4 },
  large: { paddingHorizontal: 10, paddingVertical: 6 },
};

/**
 * Limpia el texto que se manda al sintetizador de voz.
 *
 * El TTS duplica el contenido de los paréntesis en algunas plataformas (p. ej. "Twenty-seven
 * (27)" suena como "twenty seven, twenty seven"). Esta limpieza solo afecta al audio; el texto
 * en pantalla se mantiene intacto.
 *
 * Función pura: mismo texto de entrada, mismo texto de salida (no toca estado ni el DOM).
 */
function sanitizeForSpeech(text: string): string {
  return (
    text
      // Elimina paréntesis y todo su contenido: "Twenty-seven (27)" → "Twenty-seven"
      .replace(/\s*\([^)]*\)/g, '')
      // Elimina corchetes y su contenido, por si acaso
      .replace(/\s*\[[^\]]*\]/g, '')
      // Colapsa espacios múltiples
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export default function SpeakerButton({ text, size = 'medium' }: SpeakerButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Id del timeout del feedback visual, en un ref para poder cancelarlo desde el cleanup.
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Apaga el ícono "hablando" y cancela el timeout pendiente, si lo hay. */
  const stopFeedback = useCallback(() => {
    if (feedbackTimer.current !== null) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Al desmontar el botón se cancela el timeout para no actualizar estado ya desechado.
  useEffect(() => stopFeedback, [stopFeedback]);

  const handlePress = useCallback(() => {
    // El audio se sintetiza a partir del texto limpio (sin paréntesis); en pantalla y en el
    // lector de pantalla se sigue usando el texto original.
    const cleanText = sanitizeForSpeech(text);

    // Si al limpiar no queda nada pronunciable (p. ej. el texto era solo "(27)"), no se lee nada.
    if (cleanText === '') {
      return;
    }

    // 1) Se corta la pronunciación en curso (de este u otro botón) para que no se solapen:
    //    al pulsar de nuevo se descarta el audio anterior en lugar de encolarlo.
    // 2) Se lee el texto en inglés. Se espera a que `stop` termine para que Android no
    //    descarte la lectura nueva al vaciar la cola de reproducción.
    Speech.stop()
      .catch(() => {
        // Si no había nada sonando, `stop` puede rechazar: se ignora y se lee igualmente.
      })
      .finally(() => {
        Speech.speak(cleanText, {
          language: SPEECH_LANGUAGE,
          rate: SPEECH_RATE,
          pitch: SPEECH_PITCH,
          // El fin real de la lectura (normalmente antes de la estimación) también apaga
          // el ícono, igual que un error de síntesis.
          onDone: stopFeedback,
          onError: stopFeedback,
        });
      });

    // Feedback visual estimado sobre lo que se va a oír: `cleanText.length * 80 ms`, con un
    // mínimo de 800 ms.
    if (feedbackTimer.current !== null) {
      clearTimeout(feedbackTimer.current);
    }
    setIsSpeaking(true);
    feedbackTimer.current = setTimeout(
      stopFeedback,
      Math.max(cleanText.length * FEEDBACK_MS_PER_CHARACTER, MIN_FEEDBACK_MS),
    );
  }, [stopFeedback, text]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Escuchar: ${text}`}
      accessibilityHint="Reproduce la pronunciación en inglés"
      onPress={handlePress}
      style={({ pressed }) => [styles.button, SIZE_PADDING[size], pressed && styles.buttonPressed]}
    >
      <Text style={[styles.icon, { fontSize: SIZE_FONT_SIZE[size] }]}>
        {isSpeaking ? '🔉' : '🔊'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    backgroundColor: '#f0f4f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    // Se oscurece al pulsar: deja claro que es interactivo incluso sin leer el ícono.
    backgroundColor: '#dbe5f1',
  },
  icon: {
    color: '#1a3a6b',
    textAlign: 'center',
  },
});
