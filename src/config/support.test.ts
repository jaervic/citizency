// src/config/support.test.ts
// Pruebas de la configuración de enlaces externos. Son las que evitan que se cuele un enlace roto,
// un `http` sin cifrar o un dominio de donación equivocado.
import { describe, expect, it } from 'vitest';

import { AUTHOR, DONATION_LABEL, DONATION_URL, EXTERNAL_LINKS, LEGAL_NOTICE } from '@/config/support';

describe('enlaces externos', () => {
  it('todos van por https', () => {
    for (const url of EXTERNAL_LINKS) {
      expect(url.startsWith('https://'), `${url} no usa https`).toBe(true);
    }
  });

  it('son URLs válidas y con dominio', () => {
    for (const url of EXTERNAL_LINKS) {
      const parsed = new URL(url);

      expect(parsed.hostname.length).toBeGreaterThan(3);
      expect(parsed.pathname.length).toBeGreaterThan(1);
    }
  });

  it('el crédito apunta al perfil de GitHub, no a un repositorio concreto', () => {
    const parsed = new URL(AUTHOR.githubUrl);

    expect(parsed.hostname).toBe('github.com');
    expect(parsed.pathname.split('/').filter(Boolean)).toHaveLength(1);
  });

  it('la donación apunta al Ko-fi del autor', () => {
    const parsed = new URL(DONATION_URL);

    expect(parsed.hostname).toBe('ko-fi.com');
    expect(parsed.pathname).toBe('/jaervic');
    expect(DONATION_LABEL.length).toBeGreaterThan(0);
  });

  it('el autor tiene nombre', () => {
    expect(AUTHOR.name.trim().length).toBeGreaterThan(0);
  });
});

describe('aviso legal', () => {
  it('deja claro que no hay relación con USCIS', () => {
    expect(LEGAL_NOTICE).toContain('USCIS');
    expect(LEGAL_NOTICE).toMatch(/no está afiliada/i);
  });

  it('no promete asesoría legal', () => {
    expect(LEGAL_NOTICE).toMatch(/no constituye asesoría legal/i);
  });
});
