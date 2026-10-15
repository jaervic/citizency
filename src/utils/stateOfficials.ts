// src/utils/stateOfficials.ts
// Propósito: resolver las 4 preguntas del examen que dependen del estado del solicitante
// (senadores, representante, gobernador y capital) a partir de `src/data/stateOfficials.json`.
//
// Ese JSON lo genera `scripts/updateOfficials.mjs` con fuentes públicas y sin clave de API
// (Congress.gov de unitedstates/congress-legislators + openstates/people). Aquí solo se lee.
//
// El usuario elige su estado (y su distrito, para el representante) en la pantalla "Mi estado";
// esos dos valores se guardan en el store y se pasan a estas funciones puras.
import stateOfficialsJson from '@/data/stateOfficials.json';

/** Campos del examen que dependen del estado del solicitante. */
export type StateField = 'senators' | 'representative' | 'governor' | 'capital';

/** Datos vigentes de un estado. */
export type StateEntry = {
  /** Código de dos letras (p. ej. "CA"). */
  code: string;
  /** Nombre oficial en inglés. */
  name: string;
  /** Nombre en español (la interfaz está en español). */
  nameEs: string;
  /** Capital del estado (respuesta de gov-062). */
  capital: string;
  /** Gobernador vigente (respuesta de gov-061). */
  governor: string;
  /** Los dos senadores vigentes (respuesta de gov-023). */
  senators: string[];
  /** Representante por distrito: clave "1"…"52", o "at-large" (respuesta de gov-029). */
  representatives: Record<string, string>;
};

/** Estado y distrito elegidos por el usuario (`null` mientras no los configure). */
export type Location = {
  state: string | null;
  district: string | null;
};

/** Localización por defecto: sin configurar. */
export const EMPTY_LOCATION: Location = { state: null, district: null };

type StateOfficialsFile = {
  lastUpdated: string;
  sources: Record<string, string>;
  states: StateEntry[];
};

const FILE = stateOfficialsJson as unknown as StateOfficialsFile;

/** Fecha (ISO) de la última actualización del dataset. */
export const STATE_OFFICIALS_LAST_UPDATED: string = FILE.lastUpdated;

/** Los estados indexados por código. */
const BY_CODE: Record<string, StateEntry> = Object.fromEntries(
  FILE.states.map((state) => [state.code, state]),
);

/** Los 50 estados ordenados por su nombre en español (para el selector). */
export const STATE_LIST: StateEntry[] = [...FILE.states].sort((a, b) =>
  a.nameEs.localeCompare(b.nameEs, 'es'),
);

/** Datos de un estado por su código, o `null` si el código no existe. */
export function getStateEntry(code: string | null): StateEntry | null {
  if (code === null) {
    return null;
  }

  return BY_CODE[code] ?? null;
}

/** `true` si el campo del examen depende del estado del solicitante. */
export function isStateField(field: string | null): field is StateField {
  return (
    field === 'senators' || field === 'representative' || field === 'governor' || field === 'capital'
  );
}

/** Etiqueta del distrito para la interfaz ("Distrito 11" o "Circunscripción única"). */
export function districtLabel(district: string): string {
  return district === 'at-large' ? 'Circunscripción única (at-large)' : `Distrito ${district}`;
}

/**
 * Respuestas oficiales de un campo estatal según la localización del usuario. Devuelve un array
 * vacío si el usuario todavía no ha configurado su estado (o su distrito, para el representante):
 * en ese caso la app muestra el aviso genérico en vez de una respuesta inventada.
 *
 * Para los senadores devuelve LOS DOS: la pregunta (gov-023) pide "uno de los senadores", así que
 * cualquiera de los dos vale y el usuario debe conocer ambos.
 */
export function resolveStateValues(field: StateField, location: Location): string[] {
  const state = getStateEntry(location.state);

  if (state === null) {
    return [];
  }

  switch (field) {
    case 'senators':
      return state.senators;
    case 'governor':
      return [state.governor];
    case 'capital':
      return [state.capital];
    case 'representative': {
      if (location.district === null) {
        return [];
      }

      const representative = state.representatives[location.district];

      return representative === undefined ? [] : [representative];
    }
  }
}

/**
 * Valores de OTROS estados para el mismo campo. Se usan como distractores del examen de
 * práctica: un gobernador de otro estado, una capital de otro estado, etc. son plausibles pero
 * inequívocamente incorrectos (y del mismo tipo que la respuesta correcta).
 */
export function otherStateValues(field: StateField, location: Location): string[] {
  const state = getStateEntry(location.state);
  const values = new Set<string>();

  for (const entry of FILE.states) {
    if (entry.code === state?.code) {
      continue;
    }

    switch (field) {
      case 'senators':
        for (const senator of entry.senators) {
          values.add(senator);
        }
        break;
      case 'governor':
        values.add(entry.governor);
        break;
      case 'capital':
        values.add(entry.capital);
        break;
      case 'representative':
        for (const representative of Object.values(entry.representatives)) {
          values.add(representative);
        }
        break;
    }
  }

  return [...values];
}
