// src/store/useStore.test.ts
// Pruebas del estado global: progreso, racha, localización del solicitante y persistencia. Cubren
// la parte que el render en servidor no puede comprobar (React usa el estado inicial del store y
// los cambios en runtime no se ven con `renderToString`).
import { beforeEach, describe, expect, it } from 'vitest';

import { selectLocation, selectUserProgress, useStore } from '@/store/useStore';

beforeEach(() => {
  useStore.getState().reset();
  localStorage.clear();
});

describe('localización del solicitante', () => {
  it('empieza sin configurar', () => {
    expect(selectLocation(useStore.getState())).toEqual({ state: null, district: null });
  });

  it('guarda el estado y el distrito', () => {
    useStore.getState().setLocation('CA', '11');
    expect(selectLocation(useStore.getState())).toEqual({ state: 'CA', district: '11' });
  });

  it('se puede quitar (vuelve a null)', () => {
    useStore.getState().setLocation('CA', '11');
    useStore.getState().setLocation(null, null);
    expect(selectLocation(useStore.getState())).toEqual({ state: null, district: null });
  });

  it('el reinicio borra también la localización', () => {
    useStore.getState().setLocation('TX', '35');
    useStore.getState().reset();
    expect(selectLocation(useStore.getState())).toEqual({ state: null, district: null });
  });
});

describe('registro de respuestas', () => {
  it('suma XP, arranca la racha y guarda las estadísticas', () => {
    useStore.getState().recordAnswer('gov-001', true);

    const progress = selectUserProgress(useStore.getState());

    expect(progress.answeredQuestions['gov-001']).toMatchObject({ correct: 1, incorrect: 0 });
    expect(useStore.getState().xp).toBe(10);
    expect(useStore.getState().streak).toBe(1);
    expect(useStore.getState().lastStudyDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('no suma XP al fallar, pero sí actualiza las estadísticas', () => {
    useStore.getState().recordAnswer('gov-001', false);

    expect(useStore.getState().xp).toBe(0);
    expect(selectUserProgress(useStore.getState()).answeredQuestions['gov-001']).toMatchObject({
      correct: 0,
      incorrect: 1,
    });
  });
});

describe('persistencia', () => {
  it('guarda el progreso y la localización en localStorage', () => {
    useStore.getState().setLocation('CA', '11');
    useStore.getState().recordAnswer('gov-001', true);

    const raw = localStorage.getItem('userProgress');

    expect(raw).not.toBeNull();
    expect(raw).toContain('"homeState":"CA"');
    expect(raw).toContain('"homeDistrict":"11"');
    expect(raw).toContain('gov-001');
  });
});
