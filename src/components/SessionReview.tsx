// src/components/SessionReview.tsx
// Propósito: vista de revisión post-sesión reutilizable (flashcards y quiz). Lista en orden
// cronológico todos los intentos de la sesión con su acierto (✓) o fallo (✗), y permite expandir
// cada uno para ver la respuesta correcta, la explicación en español y el vocabulario de apoyo.
// Es un componente CONTROLADO: el filtro ('all' | 'incorrect') lo guarda la pantalla que lo usa,
// como el resto del estado del proyecto. Reutiliza `SpeakerButton` para la pronunciación y no
// implementa lógica de sesión ni de dominio: solo filtra y pinta.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import SpeakerButton from '@/components/SpeakerButton';
import type { Question } from '@/types';

/** Una pregunta respondida en la sesión, con el resultado de ese intento. */
export type SessionReviewItem = {
  /** Pregunta oficial (bilingüe) que se respondió. */
  question: Question;
  /** `true` si el usuario acertó. */
  wasCorrect: boolean;
  /** Texto en inglés de la opción que eligió el usuario (solo quiz). */
  userChoice?: string;
};

/** Filtro de la lista: todas las preguntas de la sesión o solo las falladas. */
export type SessionReviewFilter = 'all' | 'incorrect';

type SessionReviewProps = {
  /** Intentos de la sesión en orden cronológico (1 → N). */
  items: SessionReviewItem[];
  /** Filtro activo. */
  filter: SessionReviewFilter;
  /** Notifica el cambio de filtro. */
  onFilterChange: (filter: SessionReviewFilter) => void;
  /** Muestra el conmutador "Solo falladas" / "Todas"; por defecto `true`. */
  showFilter?: boolean;
};

/**
 * Aviso para las preguntas sin respuesta estática (las 8 dinámicas de `questions.json`): su
 * respuesta depende del gobierno o del estado del solicitante y no se puede listar aquí.
 */
const DYNAMIC_ANSWER_HINT =
  'Esta pregunta depende del gobierno actual. Consulta la información vigente.';

export default function SessionReview({
  items,
  filter,
  onFilterChange,
  showFilter = true,
}: SessionReviewProps) {
  // Índice dentro de `items` del intento expandido; `null` = todos plegados (acordeón).
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  /** Abre el detalle de un intento y pliega el que estuviera abierto. */
  const toggleExpanded = useCallback((index: number) => {
    setExpandedIndex((current) => (current === index ? null : index));
  }, []);

  /**
   * Se conserva el índice original de cada intento para que la numeración sea la de la sesión
   * completa (1 → N) aunque el filtro deje parte de la lista fuera de la vista.
   */
  const visibleItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => filter === 'all' || !item.wasCorrect);

  return (
    <View style={styles.screen}>
      {showFilter && (
        <View style={styles.filterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'incorrect' }}
            onPress={() => onFilterChange('incorrect')}
            style={[styles.filterButton, filter === 'incorrect' && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === 'incorrect' && styles.filterTextActive]}>
              Solo falladas
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === 'all' }}
            onPress={() => onFilterChange('all')}
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              Todas
            </Text>
          </Pressable>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        {visibleItems.length === 0 ? (
          <Text style={styles.empty}>No hay preguntas en esta vista</Text>
        ) : (
          visibleItems.map(({ item, index }) => {
            const isExpanded = expandedIndex === index;
            // Las 8 preguntas dinámicas no tienen respuestas estáticas (`answers_en` vacío).
            const correctAnswer: string | undefined = item.question.answers_en[0];
            const showsUserChoice =
              !item.wasCorrect &&
              item.userChoice !== undefined &&
              item.userChoice !== correctAnswer;

            return (
              <View key={`${item.question.id}-${index}`} style={styles.item}>
                <View style={styles.itemRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Pregunta ${index + 1}: ${item.question.question_en}`}
                    accessibilityState={{ expanded: isExpanded }}
                    onPress={() => toggleExpanded(index)}
                    style={({ pressed }) => [styles.itemHeader, pressed && styles.itemHeaderPressed]}
                  >
                    <Text style={styles.itemNumber}>{index + 1}</Text>
                    <Text style={styles.itemQuestion}>{item.question.question_en}</Text>
                    <Text style={styles.chevron}>{isExpanded ? '▴' : '▾'}</Text>
                    <Text style={item.wasCorrect ? styles.markCorrect : styles.markWrong}>
                      {item.wasCorrect ? '✓' : '✗'}
                    </Text>
                  </Pressable>

                  <SpeakerButton text={item.question.question_en} size="small" />
                </View>

                {isExpanded && (
                  <View style={styles.details}>
                    {showsUserChoice && (
                      <Text style={styles.userChoice}>Tu respuesta: {item.userChoice}</Text>
                    )}

                    {correctAnswer === undefined ? (
                      <Text style={styles.dynamicHint}>{DYNAMIC_ANSWER_HINT}</Text>
                    ) : (
                      <>
                        <Text style={styles.detailLabel}>Respuesta correcta:</Text>
                        <View style={styles.answerRow}>
                          <Text style={styles.correctAnswer}>{correctAnswer}</Text>
                          <SpeakerButton text={correctAnswer} size="small" />
                        </View>
                      </>
                    )}

                    {item.question.explanation_es !== '' && (
                      <Text style={styles.explanation}>{item.question.explanation_es}</Text>
                    )}

                    {item.question.vocabulary.length > 0 && (
                      <View style={styles.vocabulary}>
                        <Text style={styles.detailLabel}>Vocabulario:</Text>
                        {item.question.vocabulary.map((entry) => (
                          <View key={entry.word} style={styles.vocabularyRow}>
                            <Text style={styles.vocabularyWord}>{entry.word}</Text>
                            <SpeakerButton text={entry.word} size="small" />
                            <Text style={styles.vocabularyTranslation}>{entry.translation}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  // Conmutador de filtro: píldoras con el mismo azul de la app.
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1a3a6b',
    backgroundColor: '#ffffff',
  },
  filterButtonActive: {
    backgroundColor: '#1a3a6b',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a3a6b',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 10,
  },
  empty: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginTop: 24,
  },
  item: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 12,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  itemHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  itemHeaderPressed: {
    backgroundColor: '#f0f4f9',
  },
  itemNumber: {
    minWidth: 22,
    fontSize: 13,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  itemQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  chevron: {
    fontSize: 12,
    color: '#888888',
  },
  markCorrect: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2e7d32',
  },
  markWrong: {
    fontSize: 18,
    fontWeight: '700',
    color: '#c62828',
  },
  details: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 8,
  },
  userChoice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c62828',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  correctAnswer: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1a3a6b',
  },
  dynamicHint: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#7a5c00',
    lineHeight: 20,
  },
  explanation: {
    backgroundColor: '#f0f4f9',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },
  vocabulary: {
    gap: 6,
  },
  vocabularyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vocabularyWord: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  vocabularyTranslation: {
    flexShrink: 1,
    fontSize: 14,
    color: '#555555',
  },
});
