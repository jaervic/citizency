// src/components/OfficialAnswerCard.test.tsx
// Pruebas de la tarjeta de respuestas dinámicas: las 4 nacionales y las 4 que dependen del estado
// del solicitante, con la localización inyectada (por eso se puede comprobar el camino "ya
// configurado", que con `renderToString` no se alcanzaría leyendo el store).
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import OfficialAnswerCard from '@/components/OfficialAnswerCard';
import { OFFICIAL_DATA, QUESTIONS } from '@/utils/content';
import { getStateEntry } from '@/utils/stateOfficials';
import type { Location } from '@/utils/stateOfficials';

const question = (id: string) => QUESTIONS.find((entry) => entry.id === id)!;

/** Renderiza la tarjeta con una localización concreta. */
function render(id: string, location?: Location): string {
  return renderToString(
    <MemoryRouter>
      <OfficialAnswerCard question={question(id)} location={location} />
    </MemoryRouter>,
  );
}

describe('OfficialAnswerCard', () => {
  it('muestra los datos de los 4 cargos nacionales', () => {
    expect(render('gov-038')).toContain(OFFICIAL_DATA.president);
    expect(render('gov-039')).toContain(OFFICIAL_DATA.vicePresident);
    expect(render('gov-030')).toContain(OFFICIAL_DATA.speakerOfHouse);
    expect(render('gov-057')).toContain(OFFICIAL_DATA.chiefJustice);
  });

  it('invita a configurar el estado cuando falta', () => {
    const html = render('gov-061', { state: null, district: null });

    expect(html).toContain('Configurar mi estado');
    expect(html).toContain('href="/state"');
  });

  it('pide el distrito cuando hay estado pero no distrito (representante)', () => {
    const html = render('gov-029', { state: 'CA', district: null });

    expect(html).toContain('Elegir mi distrito');
  });

  it('muestra la respuesta ya resuelta con estado y distrito', () => {
    const california = getStateEntry('CA')!;

    expect(render('gov-062', { state: 'CA', district: '11' })).toContain(california.capital);
    expect(render('gov-061', { state: 'CA', district: '11' })).toContain(california.governor);
    expect(render('gov-029', { state: 'CA', district: '11' })).toContain(
      california.representatives['11']!,
    );
    // Los dos senadores, porque la pregunta admite cualquiera de los dos.
    for (const senator of california.senators) {
      expect(render('gov-023', { state: 'CA', district: '11' })).toContain(senator);
    }
  });

  it('no renderiza nada en una pregunta estática', () => {
    expect(render('gov-001')).toBe('');
  });
});
