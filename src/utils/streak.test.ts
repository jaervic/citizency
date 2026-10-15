// src/utils/streak.test.ts
// Pruebas de la racha diaria: primer día, idempotencia dentro del mismo día, continuación
// desde ayer y reset tras un hueco de más de un día.
import { describe, expect, it } from 'vitest';

import { computeNextStreak, getLocalDateString } from '@/utils/streak';

describe('getLocalDateString', () => {
  it('formatea con ceros a la izquierda', () => {
    expect(getLocalDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('computeNextStreak', () => {
  it('empieza en 1 el primer día', () => {
    expect(computeNextStreak(null, '2026-03-10', 0)).toEqual({ streak: 1, lastStudyDate: '2026-03-10' });
  });

  it('no suma dos veces el mismo día', () => {
    expect(computeNextStreak('2026-03-10', '2026-03-10', 5)).toEqual({
      streak: 5,
      lastStudyDate: '2026-03-10',
    });
  });

  it('continúa la racha si se estudió ayer', () => {
    expect(computeNextStreak('2026-03-09', '2026-03-10', 5)).toEqual({
      streak: 6,
      lastStudyDate: '2026-03-10',
    });
  });

  it('reinicia la racha si hubo un hueco mayor de un día', () => {
    expect(computeNextStreak('2026-03-01', '2026-03-10', 9)).toEqual({
      streak: 1,
      lastStudyDate: '2026-03-10',
    });
  });

  it('aguanta el cambio de mes', () => {
    expect(computeNextStreak('2026-02-28', '2026-03-01', 3)).toEqual({
      streak: 4,
      lastStudyDate: '2026-03-01',
    });
  });
});
