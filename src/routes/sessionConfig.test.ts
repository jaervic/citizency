// src/routes/sessionConfig.test.ts
// Pruebas de la configuración de cada modo de práctica. Aquí viven las reglas del examen real
// (10 preguntas y se aprueba con 6), así que conviene que estén comprobadas y no repartidas por la
// interfaz.
import { describe, expect, it } from 'vitest';

import { readSessionConfig } from '@/routes/FlashcardsScreen';
import { readQuizConfig } from '@/routes/QuizScreen';
import { readInterviewSize } from '@/routes/InterviewScreen';

describe('readSessionConfig (estudiar)', () => {
  it('sin parámetros es la sesión normal', () => {
    const config = readSessionConfig(new URLSearchParams());

    expect(config.mode).toBe('Sesión de estudio');
    expect(config.only65_20).toBeUndefined();
    expect(config.onlyPending).toBeUndefined();
    expect(config.category).toBeUndefined();
  });

  it('activa la exención 65/20', () => {
    expect(readSessionConfig(new URLSearchParams('only65=1')).only65_20).toBe(true);
  });

  it('activa el repaso de falladas', () => {
    expect(readSessionConfig(new URLSearchParams('onlyFailed=1')).onlyPending).toBe(true);
  });

  it('filtra por categoría', () => {
    const config = readSessionConfig(new URLSearchParams('category=Sistema+de+gobierno'));

    expect(config.category).toBe('Sistema de gobierno');
    expect(config.mode).toBe('Sistema de gobierno');
  });

  it('una categoría inventada no rompe nada', () => {
    expect(readSessionConfig(new URLSearchParams('category=Inventada')).category).toBeUndefined();
  });
});

describe('readQuizConfig (examen)', () => {
  it('por defecto: 20 preguntas, se aprueba con 12 y corrección inmediata', () => {
    const config = readQuizConfig(new URLSearchParams());

    expect(config.count).toBe(20);
    expect(config.passThreshold).toBe(12);
    expect(config.feedback).toBe('instant');
    expect(config.mode).toBe('Examen de práctica');
  });

  it('el simulacro real son 10 preguntas y se aprueba con 6', () => {
    const config = readQuizConfig(new URLSearchParams('count=10&feedback=final'));

    expect(config.count).toBe(10);
    expect(config.passThreshold).toBe(6);
    expect(config.feedback).toBe('final');
    expect(config.mode).toBe('Simulacro real');
  });

  it('el umbral es siempre el 60 %: 6 de 10, 12 de 20', () => {
    expect(readQuizConfig(new URLSearchParams('count=5')).passThreshold).toBe(3);
    expect(readQuizConfig(new URLSearchParams('count=10')).passThreshold).toBe(6);
    expect(readQuizConfig(new URLSearchParams('count=20')).passThreshold).toBe(12);
  });

  it('ignora un número de preguntas inválido y acota los exagerados', () => {
    expect(readQuizConfig(new URLSearchParams('count=patata')).count).toBe(20);
    expect(readQuizConfig(new URLSearchParams('count=-3')).count).toBe(20);
    expect(readQuizConfig(new URLSearchParams('count=9999')).count).toBe(128);
  });

  it('puede limitarse a las preguntas del 65/20', () => {
    expect(readQuizConfig(new URLSearchParams('only65=1')).only65_20).toBe(true);
  });
});

describe('readInterviewSize (entrevista)', () => {
  it('por defecto son 5 preguntas', () => {
    expect(readInterviewSize(new URLSearchParams())).toBe(5);
  });

  it('se puede pedir más (práctica de escritura)', () => {
    expect(readInterviewSize(new URLSearchParams('size=10'))).toBe(10);
  });

  it('ignora valores inválidos', () => {
    expect(readInterviewSize(new URLSearchParams('size=0'))).toBe(5);
    expect(readInterviewSize(new URLSearchParams('size=-2'))).toBe(5);
    expect(readInterviewSize(new URLSearchParams('size=abc'))).toBe(5);
    expect(readInterviewSize(new URLSearchParams('size=9999'))).toBe(128);
  });
});
