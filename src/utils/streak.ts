// src/utils/streak.ts
// Propósito: lógica pura de la racha diaria. Antes vivía dentro del store como una acción
// `incrementStreak()` que SOLO llamaba flashcards al terminar la sesión: completar un quiz de
// 20 preguntas no sumaba racha y, peor, la racha nunca se reiniciaba si el usuario dejaba de
// estudiar (volvía tres meses después con la racha intacta). Ahora el store llama a
// `computeNextStreak` desde `recordAnswer`, así que cualquier respuesta registrada en cualquier
// pantalla marca el día como estudiado y el reset por gap ocurre solo.
//
// Formato de fecha: 'YYYY-MM-DD' en hora LOCAL, construido a mano. No se usa Intl ni
// `toLocaleDateString` (comportamiento irregular en Hermes según el dispositivo) ni restas de
// 86 400 000 ms (un día local puede tener 23 o 25 horas por el cambio de horario): el día
// anterior se calcula con `Date` + `setDate(getDate() - 1)`, que respeta el calendario local.
//
// Sin dependencias ni React: son funciones puras, verificadas por `.expo/selftest/streak-check.js`.

/**
 * Devuelve la fecha local en formato 'YYYY-MM-DD' (sin Intl: Hermes tiene comportamiento
 * irregular con `toLocaleDateString` en algunos dispositivos). Acepta una Date opcional para
 * testeo; por defecto usa `new Date()`.
 *
 * @param date Instante a formatear (por defecto, el momento actual).
 * @returns La fecha local de ese instante, con ceros a la izquierda (`2026-01-05`).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Fecha local del día ANTERIOR a `dateString` ('YYYY-MM-DD'). Se parte de la medianoche local
 * de ese día y se resta un día con `setDate`, que respeta el calendario y los cambios de
 * horario. No se exporta: es un detalle interno de `computeNextStreak`.
 */
function getPreviousDateString(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);

  date.setDate(date.getDate() - 1);

  return getLocalDateString(date);
}

/**
 * Calcula la racha y la nueva `lastStudyDate` al estudiar hoy.
 *
 * Reglas:
 *   - `lastStudyDate === null`             → `streak = 1` (primer día).
 *   - `lastStudyDate === today`            → no-op: mismo streak, misma fecha. Es lo que hace
 *     idempotente el día: las 20 respuestas de un quiz (o los re-encolados de flashcards) no
 *     suman 20 días de racha.
 *   - `lastStudyDate === ayer`             → `streak = currentStreak + 1`.
 *   - `lastStudyDate` anterior a ayer      → `streak = 1` (reset: hubo un gap de más de un día).
 *   - `lastStudyDate` futura (reloj movido) → `streak = 1`, para no arrastrar una racha falsa.
 *
 * @param lastStudyDate Último día estudiado ('YYYY-MM-DD' local), o `null` si nunca.
 * @param today Día de hoy ('YYYY-MM-DD' local), calculado por quien llama.
 * @param currentStreak Racha actual antes de este intento.
 * @returns La racha ya calculada y la fecha a guardar (`lastStudyDate` siempre es `today`).
 */
export function computeNextStreak(
  lastStudyDate: string | null,
  today: string,
  currentStreak: number,
): { streak: number; lastStudyDate: string } {
  if (lastStudyDate === null) {
    return { streak: 1, lastStudyDate: today };
  }

  // Ya se estudió hoy: no-op. Sin esta rama, cada respuesta sumaría un día de racha.
  if (lastStudyDate === today) {
    return { streak: currentStreak, lastStudyDate: today };
  }

  // Se estudió ayer: la racha continúa. El cálculo con `setDate` es lo que aguanta los cambios
  // de horario: con una resta de 86 400 000 ms, el día del cambio daría una fecha equivocada.
  if (lastStudyDate === getPreviousDateString(today)) {
    return { streak: currentStreak + 1, lastStudyDate: today };
  }

  // Gap de más de un día (o fecha futura): la racha se rompe y vuelve a empezar hoy.
  return { streak: 1, lastStudyDate: today };
}
