// src/utils/backup.test.ts
// Pruebas de la copia de seguridad. Es la red que evita que alguien pierda meses de estudio, así que
// se prueban el viaje de ida y vuelta, la validación de datos rotos y la combinación.
import { describe, expect, it } from 'vitest';

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFileName,
  createBackup,
  decodeBackup,
  encodeBackup,
  mergeProgress,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  toRestorable,
} from '@/utils/backup';
import type { ExportableState } from '@/utils/backup';
import type { UserProgress } from '@/types';

const DIA = '2026-10-15T10:00:00.000Z';

function estado(parcial: Partial<ExportableState> = {}): ExportableState {
  return {
    xp: 120,
    streak: 4,
    lastStudyDate: '2026-10-15',
    answeredQuestions: {
      'gov-001': { correct: 3, incorrect: 0, lastSeen: DIA },
      'gov-002': { correct: 1, incorrect: 2, lastSeen: DIA },
    },
    homeState: 'CA',
    homeDistrict: '11',
    theme: 'dark',
    voiceName: 'Google US English',
    ...parcial,
  };
}

const progreso = (parcial: Partial<UserProgress> = {}): UserProgress => ({
  xp: 0,
  streak: 0,
  lastStudyDate: null,
  answeredQuestions: {},
  ...parcial,
});

describe('crear y serializar', () => {
  it('marca el formato y la versión', () => {
    const backup = createBackup(estado());

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('guarda progreso, ubicación y preferencias', () => {
    const backup = createBackup(estado());

    expect(backup.progress.xp).toBe(120);
    expect(backup.location).toEqual({ state: 'CA', district: '11' });
    expect(backup.preferences).toEqual({ theme: 'dark', voiceName: 'Google US English' });
  });

  it('el nombre del fichero lleva la fecha', () => {
    expect(backupFileName(new Date('2026-10-15T10:00:00Z'))).toBe('ciudadania-progreso-2026-10-15.json');
  });

  it('el JSON se puede volver a leer', () => {
    const resultado = parseBackup(serializeBackup(createBackup(estado())));

    expect(resultado.ok).toBe(true);
  });
});

describe('código de texto', () => {
  it('ida y vuelta con compresión', async () => {
    const original = createBackup(estado());
    const codigo = await encodeBackup(original);

    expect(codigo.startsWith('USCIS1Z:')).toBe(true);

    const resultado = await decodeBackup(codigo);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.backup.progress).toEqual(original.progress);
      expect(resultado.backup.location).toEqual(original.location);
    }
  });

  it('el código comprimido es mucho más corto que el JSON', async () => {
    // Con 128 preguntas el JSON es largo; el código debe poder pegarse en un mensaje.
    const grande = estado({
      answeredQuestions: Object.fromEntries(
        Array.from({ length: 128 }, (_, indice) => [
          `gov-${String(indice).padStart(3, '0')}`,
          { correct: 2, incorrect: 1, lastSeen: DIA },
        ]),
      ),
    });

    const json = JSON.stringify(createBackup(grande));
    const codigo = await encodeBackup(createBackup(grande));

    expect(codigo.length).toBeLessThan(json.length / 2);
  });

  it('rechaza un texto que no es una copia', async () => {
    const resultado = await decodeBackup('hola, esto no es una copia');

    expect(resultado.ok).toBe(false);
  });

  it('rechaza un código dañado', async () => {
    const codigo = await encodeBackup(createBackup(estado()));
    const resultado = await decodeBackup(`${codigo.slice(0, codigo.length - 12)}XXXX`);

    expect(resultado.ok).toBe(false);
  });
});

describe('validación', () => {
  it('rechaza JSON inválido', () => {
    const resultado = parseBackup('{no soy json}');

    expect(resultado.ok).toBe(false);
  });

  it('rechaza copias de otra app', () => {
    const resultado = parseBackup(JSON.stringify({ format: 'otra-cosa', version: 1 }));

    expect(resultado.ok).toBe(false);
  });

  it('rechaza versiones distintas', () => {
    const resultado = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99 }));

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toContain('versión');
    }
  });

  it('descarta estadísticas con datos basura pero conserva las buenas', () => {
    const resultado = parseBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        progress: {
          xp: -5,
          streak: 'muchos',
          lastStudyDate: 42,
          answeredQuestions: {
            'gov-001': { correct: 2, incorrect: 1, lastSeen: DIA },
            'gov-002': { correct: 'dos', incorrect: 1 },
            'gov-003': 'no soy un objeto',
          },
        },
      }),
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.backup.progress.xp).toBe(0);
      expect(resultado.backup.progress.streak).toBe(0);
      expect(resultado.backup.progress.lastStudyDate).toBeNull();
      expect(Object.keys(resultado.backup.progress.answeredQuestions)).toEqual(['gov-001']);
    }
  });

  it('rellena los campos que falten en lugar de fallar', () => {
    const resultado = parseBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, progress: {} }),
    );

    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.backup.location).toEqual({ state: null, district: null });
      expect(resultado.backup.preferences.theme).toBe('system');
    }
  });
});

describe('resumen', () => {
  it('cuenta dominadas (3 aciertos seguidos) y preguntas con historial', () => {
    const resumen = summarizeBackup(createBackup(estado()));

    expect(resumen.xp).toBe(120);
    expect(resumen.answered).toBe(2);
    expect(resumen.mastered).toBe(1);
  });
});

describe('reemplazar y combinar', () => {
  it('reemplazar devuelve tal cual lo que traía la copia', () => {
    const backup = createBackup(estado());

    expect(toRestorable(backup)).toEqual({
      xp: 120,
      streak: 4,
      lastStudyDate: '2026-10-15',
      answeredQuestions: backup.progress.answeredQuestions,
      homeState: 'CA',
      homeDistrict: '11',
      theme: 'dark',
      voiceName: 'Google US English',
    });
  });

  it('combinar se queda con el registro MÁS RECIENTE de cada pregunta', () => {
    const actual = estado({
      answeredQuestions: {
        'gov-001': { correct: 5, incorrect: 0, lastSeen: '2026-10-01T10:00:00.000Z' },
        'gov-050': { correct: 1, incorrect: 0, lastSeen: DIA },
      },
    });
    const entrante = createBackup(
      estado({
        answeredQuestions: {
          'gov-001': { correct: 2, incorrect: 3, lastSeen: '2026-10-14T10:00:00.000Z' },
          'gov-099': { correct: 1, incorrect: 0, lastSeen: DIA },
        },
      }),
    );

    const combinado = mergeProgress(actual, entrante);

    // gov-001: el de la copia es más reciente, así que gana (aunque tenga menos aciertos).
    expect(combinado.answeredQuestions['gov-001']).toEqual({
      correct: 2,
      incorrect: 3,
      lastSeen: '2026-10-14T10:00:00.000Z',
    });
    // Y no se pierde nada del progreso actual.
    expect(combinado.answeredQuestions['gov-050']).toBeDefined();
    expect(combinado.answeredQuestions['gov-099']).toBeDefined();
  });

  it('combinar no resta XP ni racha, y toma la fecha de estudio más reciente', () => {
    const actual = estado({ xp: 300, streak: 9, lastStudyDate: '2026-09-01' });
    const entrante = createBackup(estado({ xp: 50, streak: 2, lastStudyDate: '2026-10-15' }));

    const combinado = mergeProgress(actual, entrante);

    expect(combinado.xp).toBe(300);
    expect(combinado.streak).toBe(9);
    expect(combinado.lastStudyDate).toBe('2026-10-15');
  });

  it('combinar respeta las preferencias actuales (tema y voz)', () => {
    const actual = estado({ theme: 'light', voiceName: 'Samantha' });
    const entrante = createBackup(estado({ theme: 'dark', voiceName: 'Otra voz' }));

    const combinado = mergeProgress(actual, entrante);

    expect(combinado.theme).toBe('light');
    expect(combinado.voiceName).toBe('Samantha');
  });

  it('combinar rellena el estado del solicitante si no lo tenía', () => {
    const sinUbicacion = estado({ homeState: null, homeDistrict: null });
    const combinado = mergeProgress(sinUbicacion, createBackup(estado()));

    expect(combinado.homeState).toBe('CA');
    expect(combinado.homeDistrict).toBe('11');
  });

  it('combinar no pierde el progreso cuando la copia está vacía', () => {
    const actual = estado();
    const vacia = createBackup({ ...estado(), ...progreso() });

    const combinado = mergeProgress(actual, vacia);

    expect(combinado.answeredQuestions['gov-001']).toBeDefined();
    expect(combinado.xp).toBe(120);
  });
});
