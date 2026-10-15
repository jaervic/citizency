// src/utils/stateOfficials.test.ts
// Pruebas del dataset de los 50 estados (`src/data/stateOfficials.json`) y de su resolución.
// Protegen contra el escenario que más duele: publicar datos incompletos o desactualizados de las
// preguntas que dependen del estado del solicitante.
import { describe, expect, it } from 'vitest';

import {
  STATE_LIST,
  STATE_OFFICIALS_LAST_UPDATED,
  districtLabel,
  getStateEntry,
  isStateField,
  otherStateValues,
  resolveStateValues,
} from '@/utils/stateOfficials';

describe('dataset de estados', () => {
  it('cubre los 50 estados', () => {
    expect(STATE_LIST).toHaveLength(50);
  });

  it('la fecha de actualización tiene formato ISO', () => {
    expect(STATE_OFFICIALS_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('todos los estados tienen capital, gobernador, 2 senadores y representantes', () => {
    for (const state of STATE_LIST) {
      expect(state.capital.length, `${state.code} sin capital`).toBeGreaterThan(0);
      expect(state.governor.length, `${state.code} sin gobernador`).toBeGreaterThan(0);
      expect(state.senators.length, `${state.code} sin 2 senadores`).toBe(2);
      expect(
        Object.keys(state.representatives).length,
        `${state.code} sin representantes`,
      ).toBeGreaterThan(0);
    }
  });

  it('no repite la misma persona en dos escaños del mismo estado', () => {
    for (const state of STATE_LIST) {
      const people = [...state.senators, ...Object.values(state.representatives)];
      expect(new Set(people).size, `${state.code} tiene nombres repetidos`).toBe(people.length);
    }
  });

  it('los códigos de estado son únicos y de dos letras', () => {
    const codes = STATE_LIST.map((state) => state.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });
});

describe('resolveStateValues', () => {
  it('no inventa respuestas si el usuario no ha configurado su estado', () => {
    expect(resolveStateValues('governor', { state: null, district: null })).toEqual([]);
    expect(resolveStateValues('capital', { state: null, district: null })).toEqual([]);
  });

  it('no inventa respuestas si el código de estado no existe', () => {
    expect(resolveStateValues('governor', { state: 'ZZ', district: null })).toEqual([]);
  });

  it('resuelve capital, gobernador y senadores con solo el estado', () => {
    const california = getStateEntry('CA')!;

    expect(resolveStateValues('capital', { state: 'CA', district: null })).toEqual([
      california.capital,
    ]);
    expect(resolveStateValues('governor', { state: 'CA', district: null })).toEqual([
      california.governor,
    ]);
    expect(resolveStateValues('senators', { state: 'CA', district: null })).toEqual(
      california.senators,
    );
  });

  it('para el representante hace falta el distrito', () => {
    expect(resolveStateValues('representative', { state: 'CA', district: null })).toEqual([]);
    expect(resolveStateValues('representative', { state: 'CA', district: '11' })).toEqual([
      getStateEntry('CA')!.representatives['11'],
    ]);
  });

  it('en un estado de escaño único funciona la clave at-large', () => {
    expect(resolveStateValues('representative', { state: 'AK', district: 'at-large' })).toEqual([
      getStateEntry('AK')!.representatives['at-large'],
    ]);
  });
});

describe('otherStateValues', () => {
  it('nunca incluye un valor del propio estado (si no, el distractor sería correcto)', () => {
    for (const state of STATE_LIST) {
      const location = { state: state.code, district: 'at-large' };
      const own = new Set([
        ...state.senators,
        state.governor,
        state.capital,
        ...Object.values(state.representatives),
      ]);

      for (const value of otherStateValues('governor', location)) {
        expect(own.has(value), `${state.code}: ${value} es del propio estado`).toBe(false);
      }
    }
  });

  it('devuelve candidatos variados para cada campo', () => {
    const location = { state: 'CA', district: '11' };

    expect(otherStateValues('governor', location).length).toBeGreaterThan(40);
    expect(otherStateValues('capital', location).length).toBeGreaterThan(40);
    expect(otherStateValues('senators', location).length).toBeGreaterThan(80);
    expect(otherStateValues('representative', location).length).toBeGreaterThan(300);
  });
});

describe('utilidades', () => {
  it('reconoce los campos estatales', () => {
    expect(isStateField('senators')).toBe(true);
    expect(isStateField('governor')).toBe(true);
    expect(isStateField('president')).toBe(false);
    expect(isStateField(null)).toBe(false);
  });

  it('etiqueta los distritos', () => {
    expect(districtLabel('11')).toBe('Distrito 11');
    expect(districtLabel('at-large')).toContain('at-large');
  });
});
