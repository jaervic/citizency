// app/progress.tsx
// Propósito: panel de progreso del usuario. Muestra un resumen general (racha, XP y preguntas
// respondidas sobre las 128) y el avance por las 7 categorías oficiales, con barra de progreso,
// % dominado y desglose de niveles (nuevas / en progreso / repasando / dominadas). Todo el cálculo
// sale de `getCategoryProgress()` y `getMasteryLevel()` de src/utils/spacedRepetition.ts: la
// pantalla no implementa reglas de dominio, solo las consume y las pinta. Espera a que Zustand
// hidrate AsyncStorage antes de mostrar datos, igual que flashcards y quiz.
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProgressBar from '@/components/ProgressBar';
import questionsJson from '@/data/questions.json';
import { useStore } from '@/store/useStore';
import type { Category, Question, QuestionsFile, UserProgress } from '@/types';
import { getCategoryProgress, getMasteryLevel } from '@/utils/spacedRepetition';

/** Las 128 preguntas oficiales (el import de JSON ensancha los tipos: se afirma). */
const QUESTIONS: Question[] = (questionsJson as QuestionsFile).questions;

/** Desglose de los niveles de dominio de una categoría. */
type CategoryBreakdown = {
  new: number;
  learning: number;
  reviewing: number;
  mastered: number;
};

/**
 * Cuenta los niveles de dominio de cada categoría.
 *
 * `getCategoryProgress` agrupa `learning` y `reviewing` en un único campo (`learning`), así que
 * para mostrar los cuatro números por separado se pregunta pregunta a pregunta con
 * `getMasteryLevel`. La regla de dominio sigue viviendo en spacedRepetition: aquí solo se cuenta.
 * Se cumple siempre que `learning + reviewing === getCategoryProgress(...)[categoría].learning`.
 */
function countMasteryLevels(progress: UserProgress): Record<Category, CategoryBreakdown> {
  const counts: Partial<Record<Category, CategoryBreakdown>> = {};

  for (const question of QUESTIONS) {
    const bucket = counts[question.category] ?? { new: 0, learning: 0, reviewing: 0, mastered: 0 };

    // `MasteryLevel` ('new' | 'learning' | 'reviewing' | 'mastered') son justo las claves del tipo.
    bucket[getMasteryLevel(progress, question.id)] += 1;
    counts[question.category] = bucket;
  }

  // Las 7 categorías están siempre presentes porque QUESTIONS cubre las 7.
  return counts as Record<Category, CategoryBreakdown>;
}

export default function ProgressScreen() {
  const router = useRouter();

  // El progreso vive en AsyncStorage y Zustand lo hidrata de forma asíncrona (mismo patrón que
  // flashcards y quiz).
  const [hydrated, setHydrated] = useState(false);

  // Selectores primitivos/referenciales: devolver un objeto nuevo desde el selector rompería
  // Zustand v5 (snapshot distinto en cada render).
  const xp = useStore((state) => state.xp);
  const streak = useStore((state) => state.streak);
  const lastStudyDate = useStore((state) => state.lastStudyDate);
  const answeredQuestions = useStore((state) => state.answeredQuestions);

  useEffect(() => {
    const markHydrated = () => setHydrated(true);

    if (useStore.persist.hasHydrated()) {
      markHydrated();
      return;
    }

    // `onFinishHydration` devuelve su propia función de cancelación (cleanup del efecto).
    return useStore.persist.onFinishHydration(markHydrated);
  }, []);

  /** Vuelve a la pantalla de inicio. */
  const handleHome = useCallback(() => {
    router.push('/');
  }, [router]);

  // Snapshot del progreso con la forma exacta de `UserProgress`, para las utilidades.
  const userProgress: UserProgress = { xp, streak, lastStudyDate, answeredQuestions };

  // `getCategoryProgress` es la fuente de verdad de los totales por categoría; el orden de las
  // claves es el oficial (lo fija la propia utilidad).
  const categoryProgress = getCategoryProgress(QUESTIONS, userProgress);
  const categories = Object.keys(categoryProgress) as Category[];
  const masteryCounts = countMasteryLevels(userProgress);

  const totalQuestions = QUESTIONS.length;
  // Una pregunta es `new` solo si nunca se ha respondido: respondidas = total - nuevas.
  const newTotal = categories.reduce((sum, category) => sum + categoryProgress[category].new, 0);
  const answeredTotal = totalQuestions - newTotal;
  const streakLabel = streak === 1 ? 'día' : 'días';

  if (!hydrated) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#1a3a6b" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 1. Resumen general */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Resumen general</Text>

          <View style={styles.statsRow}>
            <Text style={styles.stat}>
              🔥 Racha: {streak} {streakLabel}
            </Text>
            <Text style={styles.stat}>⭐ XP: {xp}</Text>
          </View>

          <View style={styles.progressHeader}>
            <Text style={styles.stat}>Preguntas respondidas</Text>
            <Text style={styles.progressValue}>
              {answeredTotal} de {totalQuestions}
            </Text>
          </View>

          <ProgressBar progress={answeredTotal / totalQuestions} />
        </View>

        {/* 2. Avance por categoría */}
        {categories.map((category) => {
          const categoryStats = categoryProgress[category];
          const breakdown = masteryCounts[category];
          const masteredPercent =
            categoryStats.total > 0
              ? Math.round((categoryStats.mastered / categoryStats.total) * 100)
              : 0;
          // Sin ninguna pregunta respondida en la categoría: barra vacía y etiqueta "Sin empezar".
          const hasStarted = categoryStats.new < categoryStats.total;

          return (
            <View key={category} style={styles.card}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>{category}</Text>
                {hasStarted ? (
                  <Text style={styles.masteredPercent}>{masteredPercent}% dominado</Text>
                ) : (
                  <Text style={styles.notStarted}>Sin empezar</Text>
                )}
              </View>

              <ProgressBar progress={categoryStats.mastered / categoryStats.total} />

              <View style={styles.breakdownRow}>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, styles.levelNew]}>{breakdown.new}</Text>
                  <Text style={styles.breakdownLabel}>Nuevas</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, styles.levelLearning]}>
                    {breakdown.learning}
                  </Text>
                  <Text style={styles.breakdownLabel}>En progreso</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, styles.levelReviewing]}>
                    {breakdown.reviewing}
                  </Text>
                  <Text style={styles.breakdownLabel}>Repasando</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, styles.levelMastered]}>
                    {breakdown.mastered}
                  </Text>
                  <Text style={styles.breakdownLabel}>Dominadas</Text>
                </View>
              </View>

              <Text style={styles.categoryTotal}>
                {categoryStats.mastered} de {categoryStats.total} dominadas
              </Text>
            </View>
          );
        })}

        {/* 3. Ir al inicio */}
        <Pressable accessibilityRole="button" onPress={handleHome} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Ir al inicio</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0f4f9',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: '#f0f4f9',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  // Tarjeta: mismo aspecto que las de la Home (blanco sobre #f0f4f9, borde suave, radio 14).
  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stat: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  progressValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a3a6b',
  },
  masteredPercent: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  notStarted: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#888888',
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 8,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  breakdownValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#888888',
    textAlign: 'center',
  },
  levelNew: {
    color: '#888888',
  },
  levelLearning: {
    color: '#c62828',
  },
  levelReviewing: {
    color: '#7a5c00',
  },
  levelMastered: {
    color: '#2e7d32',
  },
  categoryTotal: {
    fontSize: 13,
    color: '#666666',
  },
  primaryButton: {
    backgroundColor: '#1a3a6b',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});
