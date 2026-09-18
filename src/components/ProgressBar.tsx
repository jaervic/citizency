// src/components/ProgressBar.tsx
// Propósito: barra de progreso reutilizable (0-1) para mostrar el avance del examen y el
// progreso por categoría.
import { StyleSheet, View } from 'react-native';

type ProgressBarProps = {
  /** Progreso entre 0 y 1; los valores fuera de rango se recortan. */
  progress: number;
  /** Altura en píxeles (por defecto 8, como las barras actuales). */
  height?: number;
};

export default function ProgressBar({ progress, height = 8 }: ProgressBarProps) {
  const clamped = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <View style={[styles.fill, { width: `${clamped * 100}%`, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: '#e4eaf2', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#1a3a6b' },
});
