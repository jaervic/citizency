// src/store/useStore.ts
// Propósito: estado global de la app con Zustand. Contiene todo el `UserProgress`
// (XP, racha, último día de estudio y estadísticas por pregunta) y lo persiste
// automáticamente en AsyncStorage bajo la clave 'userProgress'.
// El store no implementa reglas de negocio: delega en las funciones puras de
// `src/utils/spacedRepetition.ts`.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UserProgress } from '@/types';
import { recordAnswer as applyRecordAnswer } from '@/utils/spacedRepetition';

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
 * Fecha ISO (YYYY-MM-DD) del día LOCAL de un instante. Se usa el día local y no
 * el UTC para que la racha cambie cuando le cambia el día al usuario.
 */
function toLocalIsoDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Estado global: los datos de `UserProgress` más las acciones del store. */
export type StoreState = UserProgress & {
  /**
   * Registra el resultado de un intento: actualiza `answeredQuestions` con la
   * función pura `recordAnswer` de `spacedRepetition` y suma la XP del intento.
   */
  recordAnswer: (questionId: string, wasCorrect: boolean) => void;
  /**
   * Suma un día a la racha si hoy todavía no se había estudiado. Si
   * `lastStudyDate` ya es hoy, no hace nada.
   */
  incrementStreak: () => void;
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
      incrementStreak: () => {
        const today = toLocalIsoDate(new Date());

        if (get().lastStudyDate === today) {
          return;
        }

        set((state) => ({ streak: state.streak + 1, lastStudyDate: today }));
      },
      recordAnswer: (questionId, wasCorrect) => {
        const { xp, streak, lastStudyDate, answeredQuestions } = get();

        const updated = applyRecordAnswer(
          { xp, streak, lastStudyDate, answeredQuestions },
          questionId,
          wasCorrect,
        );

        set({
          answeredQuestions: updated.answeredQuestions,
          xp: xp + (wasCorrect ? XP_PER_CORRECT : XP_PER_INCORRECT),
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
