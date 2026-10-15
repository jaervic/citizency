// src/components/OfficialAnswerCard.tsx
// Propósito: mostrar la respuesta vigente de las 8 preguntas dinámicas: las 4 nacionales
// (presidente, vicepresidente, speaker, chief justice) y las 4 que dependen del estado del
// solicitante (senadores, representante, gobernador, capital). Si el usuario todavía no ha
// configurado su estado o su distrito, se le invita a hacerlo en vez de inventar una respuesta.
import { Link, useLocation } from 'react-router-dom';

import SpeakerButton from '@/components/SpeakerButton';
import { useStore } from '@/store/useStore';
import { OFFICIAL_DATA, OFFICIAL_FIELD_LABEL, getOfficialValues } from '@/utils/content';
import { STATE_OFFICIALS_LAST_UPDATED, isStateField } from '@/utils/stateOfficials';
import type { Location } from '@/utils/stateOfficials';
import type { Question } from '@/types';

/** Fecha ISO (YYYY-MM-DD) en formato legible dd/mm/aaaa. */
function formatUpdated(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');

  if (year === undefined || month === undefined || day === undefined) {
    return isoDate;
  }

  return `${day}/${month}/${year}`;
}

export type OfficialAnswerCardProps = {
  question: Question;
  /**
   * Localización a usar. Si no se pasa, se lee del store (es el caso normal en la app). Se puede
   * inyectar para las pruebas: con `renderToString` React usa el estado inicial del store, así que
   * sin esto no se podría comprobar la respuesta ya resuelta.
   */
  location?: Location;
};

export default function OfficialAnswerCard({ question, location }: OfficialAnswerCardProps) {
  const homeState = useStore((state) => state.homeState);
  const homeDistrict = useStore((state) => state.homeDistrict);
  const { pathname } = useLocation();

  const field = question.officialField;

  if (field === null) {
    return null;
  }

  const activeLocation = location ?? { state: homeState, district: homeDistrict };
  const values = getOfficialValues(question, OFFICIAL_DATA, activeLocation);

  const label = OFFICIAL_FIELD_LABEL[field];
  const isStateQuestion = isStateField(field);
  // El usuario ya está en la pantalla de configuración: no se le repite el atajo.
  const showSetupLink = isStateQuestion && values.length === 0 && pathname !== '/state';
  const needsDistrict =
    field === 'representative' &&
    activeLocation.state !== null &&
    activeLocation.district === null;

  return (
    <div className="official-card">
      <span className="official-card__label">{label}</span>

      {values.length > 0 ? (
        <ul className="official-card__values">
          {values.map((value) => (
            <li key={value} className="official-card__value-row">
              <span className="official-card__value">{value}</span>
              <SpeakerButton text={value} compact label={`Escuchar: ${value}`} />
            </li>
          ))}
        </ul>
      ) : showSetupLink ? (
        <>
          <span className="dynamic-note">
            {needsDistrict
              ? 'Elige tu distrito congresional para ver quién es tu representante.'
              : 'Configura tu estado para ver la respuesta actualizada.'}
          </span>
          <Link to="/state" className="official-card__setup">
            {needsDistrict ? 'Elegir mi distrito' : 'Configurar mi estado'}
          </Link>
        </>
      ) : (
        <span className="dynamic-note">Dato pendiente de actualizar.</span>
      )}

      {values.length > 0 && isStateQuestion && (
        <Link to="/state" className="official-card__setup">
          Cambiar mi estado o distrito
        </Link>
      )}

      <span className="official-card__date">
        {isStateQuestion
          ? `Datos estatales verificados el ${formatUpdated(STATE_OFFICIALS_LAST_UPDATED)}`
          : `Datos verificados el ${formatUpdated(OFFICIAL_DATA.lastUpdated)}`}
      </span>
    </div>
  );
}
