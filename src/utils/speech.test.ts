// src/utils/speech.test.ts
// Pruebas de la elección de voz. Es lo que decide cómo suena la app: si esta lógica se rompe, vuelve
// a leer con la primera voz de la lista, que es la robótica.
import { describe, expect, it } from 'vitest';

import {
  describeVoice,
  englishVoices,
  findVoiceByName,
  isNetworkVoice,
  pickBestVoice,
  rankVoices,
  resolveVoice,
  scoreVoice,
} from '@/utils/speech';

/** Constructor de voces de prueba (solo los campos que usa la app). */
function voice(
  name: string,
  lang: string,
  { local = true, isDefault = false }: { local?: boolean; isDefault?: boolean } = {},
): SpeechSynthesisVoice {
  return { name, lang, localService: local, default: isDefault } as SpeechSynthesisVoice;
}

describe('isNetworkVoice', () => {
  it('detecta las voces que necesitan internet', () => {
    expect(isNetworkVoice(voice('Google US English', 'en-US', { local: false }))).toBe(true);
    expect(isNetworkVoice(voice('Samantha', 'en-US'))).toBe(false);
  });
});

describe('rankVoices', () => {
  it('prefiere las voces que necesitan internet', () => {
    const voces = [voice('Samantha', 'en-US'), voice('Google US English', 'en-US', { local: false })];

    expect(rankVoices(voces)[0]?.name).toBe('Google US English');
  });

  it('entre las de red, prefiere las naturales', () => {
    const voces = [
      voice('Microsoft David Desktop', 'en-US'),
      voice('Microsoft Aria Online (Natural)', 'en-US', { local: false }),
      voice('Google US English', 'en-US', { local: false }),
    ];

    expect(rankVoices(voces)[0]?.name).toBe('Microsoft Aria Online (Natural)');
  });

  it('prefiere inglés de Estados Unidos', () => {
    const voces = [voice('Google UK English Female', 'en-GB', { local: false }), voice('Google US English', 'en-US', { local: false })];

    expect(rankVoices(voces)[0]?.name).toBe('Google US English');
  });

  it('penaliza las voces sintéticas antiguas', () => {
    expect(scoreVoice(voice('eSpeak English', 'en-US'))).toBeLessThan(scoreVoice(voice('Samantha', 'en-US')));
  });

  it('descarta idiomas que no son inglés', () => {
    const voces = [voice('Monica', 'es-ES'), voice('Samantha', 'en-US')];

    expect(rankVoices(voces).map((v) => v.name)).toEqual(['Samantha']);
  });

  it('descarta entradas rotas (fallo conocido de Edge con campos vacíos)', () => {
    const voces = [voice('', '', {}), { name: undefined } as unknown as SpeechSynthesisVoice, voice('Ava', 'en-US')];

    expect(rankVoices(voces).map((v) => v.name)).toEqual(['Ava']);
    expect(englishVoices(voces)).toHaveLength(1);
  });

  it('es determinista con puntuaciones empatadas', () => {
    const voces = [voice('Zoe', 'en-US'), voice('Ava', 'en-US')];

    expect(rankVoices(voces).map((v) => v.name)).toEqual(['Ava', 'Zoe']);
  });
});

describe('pickBestVoice', () => {
  it('sin voces en inglés devuelve null', () => {
    expect(pickBestVoice([voice('Monica', 'es-ES')])).toBeNull();
    expect(pickBestVoice([])).toBeNull();
  });
});

describe('resolveVoice', () => {
  const voces = [voice('Samantha', 'en-US'), voice('Google US English', 'en-US', { local: false })];

  it('respeta la voz elegida a mano', () => {
    expect(resolveVoice(voces, 'Samantha')?.name).toBe('Samantha');
  });

  it('si la voz elegida ya no existe, cae a la mejor disponible', () => {
    expect(resolveVoice(voces, 'Voz Que Ya No Está')?.name).toBe('Google US English');
  });

  it('sin preferencia usa la mejor', () => {
    expect(resolveVoice(voces, null)?.name).toBe('Google US English');
  });

  it('encuentra por nombre exacto', () => {
    expect(findVoiceByName(voces, 'Samantha')?.lang).toBe('en-US');
    expect(findVoiceByName(voces, 'samantha')).toBeNull();
  });
});

describe('describeVoice', () => {
  it('avisa cuando la voz necesita internet', () => {
    expect(describeVoice(voice('Google US English', 'en-US', { local: false }))).toContain('en línea');
  });

  it('no lo dice cuando es del dispositivo', () => {
    expect(describeVoice(voice('Samantha', 'en-US'))).not.toContain('en línea');
  });
});
