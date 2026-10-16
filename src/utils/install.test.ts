// src/utils/install.test.ts
// Pruebas de la detección de plataforma y de las instrucciones de instalación. Son funciones puras,
// así que se prueban sin navegador; lo que se protege es que a un iPhone no se le den las
// instrucciones de Android (que es el fallo clásico).
import { describe, expect, it } from 'vitest';

import { INSTALL_NOTES, INSTALL_STEPS, detectPlatform, isStandalone } from '@/utils/install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const IPAD_MODERNO =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

describe('detectPlatform', () => {
  it('reconoce el iPhone', () => {
    expect(detectPlatform(IPHONE)).toBe('ios');
  });

  it('reconoce el iPad aunque se anuncie como Mac', () => {
    // iPadOS 13+ se identifica como "Macintosh"; se distingue por los puntos táctiles.
    expect(detectPlatform(IPAD_MODERNO, 5)).toBe('ios');
    expect(detectPlatform(IPAD_MODERNO, 0)).toBe('desktop');
  });

  it('reconoce Android', () => {
    expect(detectPlatform(ANDROID, 5)).toBe('android');
  });

  it('cualquier otra cosa es escritorio', () => {
    expect(detectPlatform(WINDOWS)).toBe('desktop');
    expect(detectPlatform('', 0)).toBe('desktop');
  });
});

describe('instrucciones de instalación', () => {
  it('cada plataforma tiene pasos y una nota', () => {
    for (const platform of ['ios', 'android', 'desktop'] as const) {
      expect(INSTALL_STEPS[platform].length, `${platform} sin pasos`).toBeGreaterThan(2);
      expect(INSTALL_NOTES[platform].length).toBeGreaterThan(20);
    }
  });

  it('en iOS se explica que hay que usar Safari (en Chrome no funciona)', () => {
    const pasos = INSTALL_STEPS.ios.join(' ').toLowerCase();

    expect(pasos).toContain('safari');
    expect(pasos).toContain('añadir a pantalla de inicio');
  });

  it('en Android se explica dónde está el menú', () => {
    expect(INSTALL_STEPS.android.join(' ').toLowerCase()).toContain('menú');
  });

  it('en escritorio se avisa de que Firefox no puede instalarla', () => {
    expect(INSTALL_NOTES.desktop.toLowerCase()).toContain('firefox');
  });
});

describe('isStandalone', () => {
  it('sin window (entorno de pruebas) devuelve false sin reventar', () => {
    expect(isStandalone()).toBe(false);
  });
});
