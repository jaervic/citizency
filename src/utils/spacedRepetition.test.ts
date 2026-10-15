// src/utils/spacedRepetition.test.ts
// Pruebas de la lógica de prioridad/cola de estudio y de los niveles de dominio.
import { describe, expect, it } from 'vitest';

import type { UserProgress } from '@/types';
import { QUESTIONS } from '@/utils/content';
import { buildStudyQueue, getMasteryLevel, recordAnswer } from '@/utils/spacedRepetition';

const EMPTY_PROGRESS: UserProgress = { xp: 0, streak: 0, lastStudyDate: null, answeredQuestions: {} };

describe('buildStudyQueue', () => {
  it('devuelve la cola de 20 preguntas', () => {
    const queue = buildStudyQueue(QUESTIONS, EMPTY_PROGRESS, { random: () => 0.5 });
    expect(queue).toHaveLength(20);
  });

  it('baraja los empates: un usuario nuevo no recibe siempre el mismo orden', () => {
    const first = buildStudyQueue(QUESTIONS, EMPTY_PROGRESS, { random: () => 0.999 }).map((question) => question.id);
    const second = buildStudyQueue(QUESTIONS, EMPTY_PROGRESS, { random: () => 0 }).map((question) => question.id);
    expect(first).not.toEqual(second);
  });

  it('prioriza una pregunta fallada por encima de las ya acertadas', () => {
    // Todas vistas y acertadas (prioridad -5), salvo gov-001, que se falla (prioridad 10).
    const seen: UserProgress = {
      ...EMPTY_PROGRESS,
      answeredQuestions: Object.fromEntries(
        QUESTIONS.map((question) => [
          question.id,
          { correct: 1, incorrect: 0, lastSeen: new Date().toISOString() },
        ]),
      ),
    };

    const failed = recordAnswer(seen, 'gov-001', false);
    const queue = buildStudyQueue(QUESTIONS, failed, { limit: 5, random: () => 0.5 });

    expect(queue[0]?.id).toBe('gov-001');
  });

  it('deja las preguntas nuevas por delante de las vistas, para que el usuario las vea todas', () => {
    const failed = recordAnswer(EMPTY_PROGRESS, 'gov-001', false);
    const queue = buildStudyQueue(QUESTIONS, failed, { limit: 5, random: () => 0.5 });

    // gov-001 ya se vio (prioridad 10); las 5 de la cola siguen siendo nuevas (prioridad 100).
    expect(queue.every((question) => question.id !== 'gov-001')).toBe(true);
  });
});

describe('getMasteryLevel', () => {
  it('sube a dominada tras 3 aciertos seguidos y vuelve a en estudio con un fallo', () => {
    let progress = EMPTY_PROGRESS;

    expect(getMasteryLevel(progress, 'gov-001')).toBe('new');

    progress = recordAnswer(progress, 'gov-001', true);
    expect(getMasteryLevel(progress, 'gov-001')).toBe('reviewing');

    progress = recordAnswer(progress, 'gov-001', true);
    progress = recordAnswer(progress, 'gov-001', true);
    expect(getMasteryLevel(progress, 'gov-001')).toBe('mastered');

    progress = recordAnswer(progress, 'gov-001', false);
    expect(getMasteryLevel(progress, 'gov-001')).toBe('learning');
  });
});
