// app/index.tsx
// Propósito: pantalla de inicio. Muestra la racha y el XP del usuario, los tres
// accesos principales (estudiar, quiz y progreso) y el reinicio de progreso.
import { Link } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useStore } from '@/store/useStore';
import { colors } from '@/theme';

type MenuItem = {
  href: '/flashcards' | '/quiz' | '/progress';
  title: string;
  subtitle: string;
};

const MENU: MenuItem[] = [
  {
    href: '/flashcards',
    title: '📚 Estudiar Flashcards',
    subtitle: 'Recuerdo activo, pregunta a pregunta',
  },
  { href: '/quiz', title: '📝 Hacer un Quiz', subtitle: 'Examen de práctica de 20 preguntas' },
  {
    href: '/progress',
    title: '📊 Ver mi progreso',
    subtitle: 'Avance por categoría y por pregunta',
  },
];

export default function HomeScreen() {
  const xp = useStore((state) => state.xp);
  const streak = useStore((state) => state.streak);
  const reset = useStore((state) => state.reset);

  const handleReset = () => {
    Alert.alert('Reiniciar progreso', 'Se pondrán a cero tu XP y tu racha. ¿Quieres continuar?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reiniciar', style: 'destructive', onPress: reset },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* El nombre de la app ya lo pinta el header del Stack (app/_layout.tsx). */}
      <Text style={styles.subtitle}>Prepárate para tu examen de ciudadanía</Text>

      <View style={styles.statsCard}>
        <Text style={styles.stat}>🔥 Racha: {streak} días</Text>
        <Text style={styles.stat}>⭐ XP: {xp}</Text>
      </View>

      {MENU.map((item) => (
        <Link key={item.href} href={item.href} asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </Pressable>
        </Link>
      ))}

      <Pressable accessibilityRole="button" onPress={handleReset} style={styles.resetButton}>
        <Text style={styles.resetText}>Reiniciar progreso</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 14 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },
  statsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    marginBottom: 4,
  },
  stat: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 18,
    gap: 4,
  },
  // `borderColor` queda hardcoded: no hay token para un borde azul medio y no aporta
  // un valor reutilizable (solo lo usa este estado pressed).
  cardPressed: { backgroundColor: colors.pressed, borderColor: '#9BB7E8' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: colors.primary },
  cardSubtitle: { fontSize: 14, color: colors.textSecondary },
  resetButton: { alignSelf: 'center', marginTop: 8, paddingVertical: 8, paddingHorizontal: 14 },
  resetText: { fontSize: 14, fontWeight: '600', color: colors.error },
});
