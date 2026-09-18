// app/progress.tsx
// Propósito: panel de progreso por categoría (Gobierno, Historia, Cívica).
// Placeholder: aquí irá el desglose de aciertos/fallos por categoría y el
// estado de repetición espaciada de cada pregunta.
import { StyleSheet, Text, View } from 'react-native';

export default function ProgressScreen() {
  return (
    <View style={styles.container}>
      <Text>Progreso por categoría (pendiente de implementar)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
