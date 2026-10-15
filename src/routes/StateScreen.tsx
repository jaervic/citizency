// src/routes/StateScreen.tsx
// Propósito: que el usuario diga en qué estado vive (y en qué distrito congresional) para poder
// resolver las 4 preguntas del examen que dependen de dónde vive: senadores (gov-023),
// representante (gov-029), gobernador (gov-061) y capital (gov-062).
//
// La elección se guarda en el store (y por tanto en `localStorage`), así que solo hay que
// hacerla una vez. Los datos salen de `src/data/stateOfficials.json`, que se regenera con
// `npm run update-officials`.
import { Link } from 'react-router-dom';

import SpeakerButton from '@/components/SpeakerButton';
import { useStore } from '@/store/useStore';
import {
  STATE_LIST,
  STATE_OFFICIALS_LAST_UPDATED,
  districtLabel,
  getStateEntry,
} from '@/utils/stateOfficials';

/** Fecha ISO (YYYY-MM-DD) en formato legible dd/mm/aaaa. */
function formatUpdated(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');

  return year !== undefined && month !== undefined && day !== undefined
    ? `${day}/${month}/${year}`
    : isoDate;
}

export default function StateScreen() {
  const homeState = useStore((state) => state.homeState);
  const homeDistrict = useStore((state) => state.homeDistrict);
  const setLocation = useStore((state) => state.setLocation);

  const stateEntry = getStateEntry(homeState);
  const districts = stateEntry === null ? [] : Object.keys(stateEntry.representatives);
  // En los estados con un único escaño (at-large) no tiene sentido preguntar el distrito:
  // se elige solo.
  const isAtLargeOnly = districts.length === 1 && districts[0] === 'at-large';

  const handleStateChange = (code: string) => {
    if (code === '') {
      setLocation(null, null);
      return;
    }

    const entry = getStateEntry(code);
    const availableDistricts = entry === null ? [] : Object.keys(entry.representatives);
    const autoDistrict =
      availableDistricts.length === 1 && availableDistricts[0] === 'at-large'
        ? 'at-large'
        : null;

    setLocation(code, autoDistrict);
  };

  return (
    <div className="page">
      <p className="screen-subtitle">
        El examen incluye 4 preguntas que dependen de dónde vives. Elige tu estado (y tu distrito)
        y la app te dará las respuestas actualizadas.
      </p>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="field-label" htmlFor="state-select">
          Estado de residencia
        </label>
        <select
          id="state-select"
          className="field-select"
          value={homeState ?? ''}
          onChange={(event) => handleStateChange(event.target.value)}
        >
          <option value="">— Elige tu estado —</option>
          {STATE_LIST.map((state) => (
            <option key={state.code} value={state.code}>
              {state.nameEs} ({state.code})
            </option>
          ))}
        </select>

        {stateEntry !== null && !isAtLargeOnly && (
          <>
            <label className="field-label" htmlFor="district-select">
              Distrito congresional
            </label>
            <select
              id="district-select"
              className="field-select"
              value={homeDistrict ?? ''}
              onChange={(event) =>
                setLocation(homeState, event.target.value === '' ? null : event.target.value)
              }
            >
              <option value="">— Elige tu distrito —</option>
              {districts.map((district) => (
                <option key={district} value={district}>
                  {districtLabel(district)}
                </option>
              ))}
            </select>
            <p className="state-note">
              No sabes cuál es tu distrito: puedes averiguarlo con tu código postal en{' '}
              <a
                className="state-link"
                href="https://www.house.gov/representatives/find-your-representative"
                target="_blank"
                rel="noreferrer"
              >
                house.gov
              </a>
              .
            </p>
          </>
        )}
      </section>

      {stateEntry !== null && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="progress-card__title">Tus respuestas actualizadas</h2>

          <div className="state-answer">
            <span className="official-card__label">Capital de tu estado</span>
            <div className="official-card__value-row">
              <span className="official-card__value">{stateEntry.capital}</span>
              <SpeakerButton text={stateEntry.capital} compact label={`Escuchar: ${stateEntry.capital}`} />
            </div>
          </div>

          <div className="state-answer">
            <span className="official-card__label">Gobernador de tu estado</span>
            <div className="official-card__value-row">
              <span className="official-card__value">{stateEntry.governor}</span>
              <SpeakerButton
                text={stateEntry.governor}
                compact
                label={`Escuchar: ${stateEntry.governor}`}
              />
            </div>
          </div>

          <div className="state-answer">
            <span className="official-card__label">Senadores de tu estado</span>
            <ul className="official-card__values">
              {stateEntry.senators.map((senator) => (
                <li key={senator} className="official-card__value-row">
                  <span className="official-card__value">{senator}</span>
                  <SpeakerButton text={senator} compact label={`Escuchar: ${senator}`} />
                </li>
              ))}
            </ul>
          </div>

          <div className="state-answer">
            <span className="official-card__label">Representante de tu distrito</span>
            {homeDistrict !== null && stateEntry.representatives[homeDistrict] !== undefined ? (
              <div className="official-card__value-row">
                <span className="official-card__value">
                  {stateEntry.representatives[homeDistrict]}
                </span>
                <SpeakerButton
                  text={stateEntry.representatives[homeDistrict]}
                  compact
                  label={`Escuchar: ${stateEntry.representatives[homeDistrict]}`}
                />
              </div>
            ) : (
              <span className="dynamic-note">Elige tu distrito arriba para verlo.</span>
            )}
          </div>

          <p className="state-note">
            Datos verificados el {formatUpdated(STATE_OFFICIALS_LAST_UPDATED)}. Si tu estado o
            distrito cambia (por una elección o un nuevo mapa de distritos), puedes volver a
            elegirlo aquí.
          </p>
        </section>
      )}

      {homeState !== null && (
        <button type="button" className="home-reset" onClick={() => setLocation(null, null)}>
          Quitar mi estado
        </button>
      )}

      <p className="state-note">
        Esta opción es solo para las preguntas que dependen de dónde vives. Si ya configuraste tu
        estado, no hace falta volver a esta pantalla.
      </p>

      <Link to="/" className="btn btn--secondary">
        Volver al inicio
      </Link>
    </div>
  );
}
