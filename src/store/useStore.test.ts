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

describe('tema', () => {
  it('empieza siguiendo al sistema', () => {
    expect(useStore.getState().theme).toBe('system');
  });

  it('guarda la preferencia elegida', () => {
    useStore.getState().setTheme('dark');
    expect(useStore.getState().theme).toBe('dark');
  });

  it('el reinicio vuelve a «sistema»', () => {
    useStore.getState().setTheme('light');
    useStore.getState().reset();
    expect(useStore.getState().theme).toBe('system');
  });

  it('se persiste en localStorage', () => {
    useStore.getState().setTheme('dark');
    expect(localStorage.getItem('userProgress')).toContain('"theme":"dark"');
  });
});

describe('restaurar una copia', () => {
  it('aplica progreso, ubicación y preferencias de golpe', () => {
    useStore.getState().restore({
      xp: 250,
      streak: 7,
      lastStudyDate: '2026-10-15',
      answeredQuestions: { 'gov-001': { correct: 3, incorrect: 0, lastSeen: '2026-10-15T10:00:00.000Z' } },
      homeState: 'TX',
      homeDistrict: '35',
      theme: 'dark',
      voiceName: 'Google US English',
    });

    const estado = useStore.getState();

    expect(estado.xp).toBe(250);
    expect(estado.streak).toBe(7);
    expect(estado.homeState).toBe('TX');
    expect(estado.homeDistrict).toBe('35');
    expect(estado.theme).toBe('dark');
    expect(estado.voiceName).toBe('Google US English');
    expect(estado.answeredQuestions['gov-001']).toBeDefined();
  });

  it('una copia con progreso vacío borra el historial (modo reemplazar)', () => {
    useStore.getState().recordAnswer('gov-001', true);
    useStore.getState().restore({
      xp: 0,
      streak: 0,
      lastStudyDate: null,
      answeredQuestions: {},
      homeState: null,
      homeDistrict: null,
      theme: 'system',
      voiceName: null,
    });

    expect(useStore.getState().answeredQuestions).toEqual({});
    expect(useStore.getState().xp).toBe(0);
  });

  it('se persiste en localStorage', () => {
    useStore.getState().restore({
      xp: 999,
      streak: 3,
      lastStudyDate: '2026-10-15',
      answeredQuestions: {},
      homeState: 'CA',
      homeDistrict: '11',
      theme: 'light',
      voiceName: null,
    });

    expect(localStorage.getItem('userProgress')).toContain('999');
    expect(localStorage.getItem('userProgress')).toContain('"homeState":"CA"');
  });
});

describe('persistencia', () => {  it('guarda el progreso y la localización en localStorage', () => {
    useStore.getState().setLocation('CA', '11');
    useStore.getState().recordAnswer('gov-001', true);

    const raw = localStorage.getItem('userProgress');

    expect(raw).not.toBeNull();
    expect(raw).toContain('"homeState":"CA"');
    expect(raw).toContain('"homeDistrict":"11"');
    expect(raw).toContain('gov-001');
  });
});
