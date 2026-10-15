// src/store/useStore.ts
// Propósito: estado global de la webapp con Zustand. Contiene todo el `UserProgress`
// (XP, racha, último día de estudio y estadísticas por pregunta) y lo persiste
// automáticamente en `localStorage` bajo la clave 'userProgress'.
// El store no implementa reglas de negocio: delega en las funciones puras de
// `src/utils/spacedRepetition.ts` y `src/utils/streak.ts`.
//
// Nota web: `localStorage` es síncrono, así que `persist` rehidrata el estado en el
// mismo instante en que se crea el store (a diferencia de AsyncStorage en la versión
// nativa, que obligaba a esperar a un evento de hidratación en cada pantalla).
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UserProgress } from '@/types';
import { recordAnswer as applyRecordAnswer } from '@/utils/spacedRepetition';
import { computeNextStreak, getLocalDateString } from '@/utils/streak';
import type { Location } from '@/utils/stateOfficials';

/** Clave con la que se guarda el progreso en `localStorage`. */
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

/** Estado inicial completo (progreso + datos del estado del solicitante). */
function createInitialState(): UserProgress & Pick<StoreState, 'homeState' | 'homeDistrict'> {
  return { ...createInitialProgress(), homeState: null, homeDistrict: null };
}

/**
 * Estado global: los datos de `UserProgress`, el estado/distrito del solicitante (para las
 * preguntas que dependen del estado) y las acciones del store.
 */
export type StoreState = UserProgress & {
  /**
   * Código del estado de residencia ("CA", "TX"…) elegido por el usuario, o `null` si todavía no
   * lo ha configurado. Resuelve las preguntas gov-023, gov-061 y gov-062.
   */
  homeState: string | null;
  /**
   * Distrito congresional del usuario ("11", "at-large"…) o `null`. Resuelve gov-029
   * (su representante).
   */
  homeDistrict: string | null;
  /**
   * Registra el resultado de un intento: actualiza `answeredQuestions` con la
   * función pura `recordAnswer` de `spacedRepetition`, suma la XP del intento y
   * actualiza la racha del día con `computeNextStreak` (idempotente dentro del día,
   * con reset automático si el último estudio fue anterior a ayer).
   */
  recordAnswer: (questionId: string, wasCorrect: boolean) => void;
  /** Suma XP al total acumulado. */
  addXp: (amount: number) => void;
  /** Guarda el estado y el distrito del solicitante (usa `null` para borrarlos). */
  setLocation: (state: string | null, district: string | null) => void;
  /** Reinicia TODO el progreso del usuario a sus valores por defecto. */
  reset: () => void;
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      addXp: (amount) => set((state) => ({ xp: state.xp + amount })),
      setLocation: (homeState, homeDistrict) => set({ homeState, homeDistrict }),
      recordAnswer: (questionId, wasCorrect) => {
        const { xp, streak, lastStudyDate, answeredQuestions } = get();

        const updated = applyRecordAnswer(
          { xp, streak, lastStudyDate, answeredQuestions },
          questionId,
          wasCorrect,
        );

        // Cualquier respuesta registrada (flashcards, quiz o entrevista) marca hoy
        // como día estudiado: la racha sube una sola vez al día y se reinicia si el
        // último estudio fue anterior a ayer.
        const today = getLocalDateString();
        const nextStreak = computeNextStreak(lastStudyDate, today, streak);

        set({
          answeredQuestions: updated.answeredQuestions,
          xp: xp + (wasCorrect ? XP_PER_CORRECT : XP_PER_INCORRECT),
          streak: nextStreak.streak,
          lastStudyDate: nextStreak.lastStudyDate,
        });
      },
      reset: () => set(createInitialState()),
    }),
    {
      name: PERSIST_KEY,
      version: PERSIST_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Solo se persisten los datos; las acciones se reconstruyen en cada arranque.
      partialize: (state) => ({
        xp: state.xp,
        streak: state.streak,
        lastStudyDate: state.lastStudyDate,
        answeredQuestions: state.answeredQuestions,
        homeState: state.homeState,
        homeDistrict: state.homeDistrict,
      }),
    },
  ),
);

/**
 * Extrae solo los datos de `UserProgress` del estado del store, que es lo que necesitan las
 * funciones puras de `spacedRepetition` y `streak`.
 *
 * OJO: devuelve un objeto NUEVO en cada llamada, así que NO debe pasarse a `useStore(selector)`
 * (Zustand v5 compara con `Object.is` y entraría en un bucle de render). Está pensado para
 * `useStore.getState()` o para componerlo a partir de selectores de primitivos.
 */
export function selectUserProgress(state: StoreState): UserProgress {
  return {
    xp: state.xp,
    streak: state.streak,
    lastStudyDate: state.lastStudyDate,
    answeredQuestions: state.answeredQuestions,
  };
}

/**
 * Extrae el estado y el distrito del solicitante. Misma advertencia que `selectUserProgress`:
 * es un objeto nuevo, así que úsalo con `useStore.getState()`, no como selector de hook.
 */
export function selectLocation(state: StoreState): Location {
  return { state: state.homeState, district: state.homeDistrict };
}
