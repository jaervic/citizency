// src/store/useStore.ts
// Propósito: estado global de la app con Zustand. Contiene todo el `UserProgress`
// (XP, racha, último día de estudio y estadísticas por pregunta) y lo persiste
// automáticamente en AsyncStorage bajo la clave 'userProgress'.
// El store no implementa reglas de negocio: delega en las funciones puras de
// `src/utils/spacedRepetition.ts` y `src/utils/streak.ts`.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UserProgress } from '@/types';
import { recordAnswer as applyRecordAnswer } from '@/utils/spacedRepetition';
import { computeNextStreak, getLocalDateString } from '@/utils/streak';

/** Clave con la que se guarda el progreso en AsyncStorage. */
const PERSIST_KEY = 'userProgress';
/** Versión del formato guardado (para migraciones futuras del estado persistido). */
const PERSIST_VERSION = 1;
/** XP que otorga un acierto. */
const XP_PER_CORRECT = 10;
/** XP que otorga un fallo (0: fallar no resta). */
const XP_PER_INCORRECT = 0;

/** Progreso inicial de un usuario nuevo (objeto nuevo en cada llamada). */
function createInitialProgress(): UserProgress {
  return { xp: 0, streak: 0, lastStudyDate: null, answeredQuestions: {} };
}

/**
 * Estado global: los datos de `UserProgress` más las acciones del store.
 */
export type StoreState = UserProgress & {
  /**
   * Registra el resultado de un intento: actualiza `answeredQuestions` con la
   * función pura `recordAnswer` de `spacedRepetition`, suma la XP del intento y
   * actualiza la racha del día con `computeNextStreak` (idempotente dentro del día,
   * con reset automático si el último estudio fue anterior a ayer).
   */
  recordAnswer: (questionId: string, wasCorrect: boolean) => void;
  /** Suma XP al total acumulado. */
  addXp: (amount: number) => void;
  /** Reinicia todo el progreso del usuario a sus valores por defecto. */
  reset: () => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...createInitialProgress(),
      addXp: (amount) => set((state) => ({ xp: state.xp + amount })),
      recordAnswer: (questionId, wasCorrect) => {
        const { xp, streak, lastStudyDate, answeredQuestions } = get();

        const updated = applyRecordAnswer(
          { xp, streak, lastStudyDate, answeredQuestions },
          questionId,
          wasCorrect,
        );

        // Cualquier respuesta registrada (flashcards, quiz o pantallas futuras) marca hoy
        // como día estudiado: la racha sube una sola vez al día y se reinicia si el último
        // estudio fue anterior a ayer.
        const today = getLocalDateString();
        const nextStreak = computeNextStreak(lastStudyDate, today, streak);

        set({
          answeredQuestions: updated.answeredQuestions,
          xp: xp + (wasCorrect ? XP_PER_CORRECT : XP_PER_INCORRECT),
          streak: nextStreak.streak,
          lastStudyDate: nextStreak.lastStudyDate,
        });
      },
      reset: () => set(createInitialProgress()),
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      // Solo se persisten los datos; las acciones se reconstruyen en cada arranque.
      partialize: (state) => ({
        xp: state.xp,
        streak: state.streak,
        lastStudyDate: state.lastStudyDate,
        answeredQuestions: state.answeredQuestions,
      }),
    },
  ),
);
