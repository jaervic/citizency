// scripts/updateOfficials.mjs
// Propósito: regenerar `src/data/stateOfficials.json`, el dataset con los datos que cambian de
// las 4 preguntas del examen que dependen del estado del solicitante:
//
//   gov-023  Who is one of your state's U.S. senators now?   -> senators
//   gov-029  Name your U.S. representative.                  -> representatives[district]
//   gov-061  Who is the governor of your state now?          -> governor
//   gov-062  What is the capital of your state?              -> capital
//
// Fuentes (públicas y sin clave de API):
//   1. Senadores y representantes:
//      https://unitedstates.github.io/congress-legislators/legislators-current.json
//      (proyecto unitedstates/congress-legislators, dominio público; se actualiza solo).
//   2. Gobernadores:
//      https://github.com/openstates/people  (un YAML por cargo en data/<estado>/executive/).
//   3. Capitales de estado: constante de este script (no cambian nunca; es la única parte que
//      no tiene sentido consultar por red).
//
// Uso:
//   node scripts/updateOfficials.mjs
//   GITHUB_TOKEN=... node scripts/updateOfficials.mjs   # opcional: sube el límite del API de GitHub
//
// Se ejecuta también desde .github/workflows/update-officials.yml una vez al mes, para que los
// datos no se queden viejos sin que nadie se acuerde.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { load as parseYaml } from 'js-yaml';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(HERE, '..', 'src', 'data', 'stateOfficials.json');

const CONGRESS_URL =
  'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const OPENSTATES_TREE_URL =
  'https://api.github.com/repos/openstates/people/git/trees/main?recursive=1';
const OPENSTATES_RAW_BASE = 'https://raw.githubusercontent.com/openstates/people/main/';

/** Capital de cada estado (constante: no cambian). */
const CAPITALS = {
  AL: 'Montgomery',
  AK: 'Juneau',
  AZ: 'Phoenix',
  AR: 'Little Rock',
  CA: 'Sacramento',
  CO: 'Denver',
  CT: 'Hartford',
  DE: 'Dover',
  FL: 'Tallahassee',
  GA: 'Atlanta',
  HI: 'Honolulu',
  ID: 'Boise',
  IL: 'Springfield',
  IN: 'Indianapolis',
  IA: 'Des Moines',
  KS: 'Topeka',
  KY: 'Frankfort',
  LA: 'Baton Rouge',
  ME: 'Augusta',
  MD: 'Annapolis',
  MA: 'Boston',
  MI: 'Lansing',
  MN: 'Saint Paul',
  MS: 'Jackson',
  MO: 'Jefferson City',
  MT: 'Helena',
  NE: 'Lincoln',
  NV: 'Carson City',
  NH: 'Concord',
  NJ: 'Trenton',
  NM: 'Santa Fe',
  NY: 'Albany',
  NC: 'Raleigh',
  ND: 'Bismarck',
  OH: 'Columbus',
  OK: 'Oklahoma City',
  OR: 'Salem',
  PA: 'Harrisburg',
  RI: 'Providence',
  SC: 'Columbia',
  SD: 'Pierre',
  TN: 'Nashville',
  TX: 'Austin',
  UT: 'Salt Lake City',
  VT: 'Montpelier',
  VA: 'Richmond',
  WA: 'Olympia',
  WV: 'Charleston',
  WI: 'Madison',
  WY: 'Cheyenne',
};

/** Nombre oficial (inglés) y nombre en español de cada estado (la UI está en español). */
const STATE_NAMES = {
  AL: ['Alabama', 'Alabama'],
  AK: ['Alaska', 'Alaska'],
  AZ: ['Arizona', 'Arizona'],
  AR: ['Arkansas', 'Arkansas'],
  CA: ['California', 'California'],
  CO: ['Colorado', 'Colorado'],
  CT: ['Connecticut', 'Connecticut'],
  DE: ['Delaware', 'Delaware'],
  FL: ['Florida', 'Florida'],
  GA: ['Georgia', 'Georgia'],
  HI: ['Hawaii', 'Hawái'],
  ID: ['Idaho', 'Idaho'],
  IL: ['Illinois', 'Illinois'],
  IN: ['Indiana', 'Indiana'],
  IA: ['Iowa', 'Iowa'],
  KS: ['Kansas', 'Kansas'],
  KY: ['Kentucky', 'Kentucky'],
  LA: ['Louisiana', 'Luisiana'],
  ME: ['Maine', 'Maine'],
  MD: ['Maryland', 'Maryland'],
  MA: ['Massachusetts', 'Massachusetts'],
  MI: ['Michigan', 'Míchigan'],
  MN: ['Minnesota', 'Minnesota'],
  MS: ['Mississippi', 'Misisipi'],
  MO: ['Missouri', 'Misuri'],
  MT: ['Montana', 'Montana'],
  NE: ['Nebraska', 'Nebraska'],
  NV: ['Nevada', 'Nevada'],
  NH: ['New Hampshire', 'Nuevo Hampshire'],
  NJ: ['New Jersey', 'Nueva Jersey'],
  NM: ['New Mexico', 'Nuevo México'],
  NY: ['New York', 'Nueva York'],
  NC: ['North Carolina', 'Carolina del Norte'],
  ND: ['North Dakota', 'Dakota del Norte'],
  OH: ['Ohio', 'Ohio'],
  OK: ['Oklahoma', 'Oklahoma'],
  OR: ['Oregon', 'Oregón'],
  PA: ['Pennsylvania', 'Pensilvania'],
  RI: ['Rhode Island', 'Rhode Island'],
  SC: ['South Carolina', 'Carolina del Sur'],
  SD: ['South Dakota', 'Dakota del Sur'],
  TN: ['Tennessee', 'Tennessee'],
  TX: ['Texas', 'Texas'],
  UT: ['Utah', 'Utah'],
  VT: ['Vermont', 'Vermont'],
  VA: ['Virginia', 'Virginia'],
  WA: ['Washington', 'Washington'],
  WV: ['West Virginia', 'Virginia Occidental'],
  WI: ['Wisconsin', 'Wisconsin'],
  WY: ['Wyoming', 'Wyoming'],
};

/** Descarga un texto con reintentos y un tiempo límite. */
async function fetchText(url, { attempts = 3, timeoutMs = 60_000 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: 'application/json, text/plain, */*',
          'user-agent': 'ciudadania-app-update-officials',
        },
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;

      if (attempt < attempts) {
        // Retroceso simple: 1s, 2s…
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  throw new Error(`No se pudo descargar ${url}: ${lastError?.message ?? lastError}`);
}

/**
 * Nombre con el que se conoce a la persona (es lo que el usuario debe decir en la entrevista):
 * se prefiere el apodo ("Chuck Schumer", "Bobby Scott") y, si no lo hay, el nombre de pila sin
 * la inicial del segundo nombre ("Adam Schiff", no "Adam B. Schiff"). Cuando `first` es solo una
 * inicial ("H." Griffith), el nombre real se toma de `official_full` ("H. Morgan Griffith").
 */
function fullName(person) {
  const { first, last, nickname, official_full: officialFull, suffix } = person.name ?? {};
  const suffixText = suffix ? `, ${suffix}` : '';

  if (nickname) {
    return `${nickname} ${last}${suffixText}`;
  }

  const given =
    first && /^[A-Z]\.?$/.test(first)
      ? (officialFull ?? '')
          .split(/\s+/)
          .find((token) => /^[A-Za-z][A-Za-z'’-]+$/.test(token))
      : first;

  return `${given ?? first ?? ''} ${last ?? ''}${suffixText}`.replace(/\s+/g, ' ').trim();
}

/** Último cargo de la persona (el término más reciente). */
function currentTerm(person) {
  return person.terms?.[person.terms.length - 1];
}

/** Clave de distrito: número como texto, o 'at-large' cuando el distrito es 0. */
function districtKey(district) {
  return district === undefined || district === null || district === 0 || district === '0'
    ? 'at-large'
    : String(district);
}

/** Descarga y resume senadores y representantes por estado. */
async function buildCongress() {
  console.log('· Descargando el Congreso actual (unitedstates/congress-legislators)…');
  const raw = await fetchText(CONGRESS_URL);
  const people = JSON.parse(raw);

  const byState = new Map();

  for (const person of people) {
    const term = currentTerm(person);
    const code = term?.state;

    if (!code || !STATE_NAMES[code]) {
      continue; // Territorios y datos incompletos: solo interesan los 50 estados.
    }

    const bucket = byState.get(code) ?? { senators: [], representatives: {} };
    const name = fullName(person);

    if (term.type === 'sen') {
      bucket.senators.push(name);
    } else if (term.type === 'rep') {
      bucket.representatives[districtKey(term.district)] = name;
    }

    byState.set(code, bucket);
  }

  return byState;
}

/**
 * Elige el gobernador vigente de un estado: de todos los cargos `type: governor` que aparecen
 * en sus YAML, se queda con el que termina más tarde (un gobernador saliente conserva su cargo
 * histórico, así que el nombre no basta).
 */
function pickGovernor(documents) {
  let best = null;

  for (const document of documents) {
    for (const role of document.roles ?? []) {
      if (role.type !== 'governor') {
        continue;
      }

      // Sin end_date se considera vigente (indefinido) y gana a cualquier fecha pasada.
      const end = role.end_date ? String(role.end_date) : '9999-12-31';

      if (best === null || end > best.endDate || (end === best.endDate && role.start_date > best.startDate)) {
        best = { name: document.name, endDate: end, startDate: String(role.start_date ?? '') };
      }
    }
  }

  return best?.name ?? null;
}

/** Descarga los gobernadores vigentes desde openstates/people. */
async function buildGovernors() {
  console.log('· Listando gobernadores (openstates/people)…');

  const token = process.env.GITHUB_TOKEN;
  const headers = token ? { authorization: `Bearer ${token}` } : {};

  const response = await fetch(OPENSTATES_TREE_URL, {
    signal: AbortSignal.timeout(60_000),
    headers: { ...headers, accept: 'application/vnd.github+json', 'user-agent': 'ciudadania-app' },
  });

  if (!response.ok) {
    throw new Error(`El API de GitHub respondió ${response.status}. ¿Falta GITHUB_TOKEN?`);
  }

  const tree = await response.json();
  const targets = tree.tree
    .map((entry) => entry.path)
    .filter((filePath) => /^data\/[a-z]{2}\/executive\/[^/]+\.yml$/.test(filePath))
    .filter((filePath) => STATE_NAMES[filePath.split('/')[1].toUpperCase()] !== undefined);

  console.log(`  ${targets.length} fichas de cargos ejecutivos estatales. Descargando…`);

  // Descarga en tandas para no abrir 200 conexiones a la vez.
  const documentsByState = new Map();
  const BATCH = 12;

  for (let index = 0; index < targets.length; index += BATCH) {
    const batch = targets.slice(index, index + BATCH);

    await Promise.all(
      batch.map(async (filePath) => {
        const code = filePath.split('/')[1].toUpperCase();
        const text = await fetchText(`${OPENSTATES_RAW_BASE}${filePath}`);
        const document = parseYaml(text);

        if (document === null || typeof document !== 'object') {
          return;
        }

        const list = documentsByState.get(code) ?? [];
        list.push(document);
        documentsByState.set(code, list);
      }),
    );
  }

  const governors = new Map();

  for (const [code, documents] of documentsByState) {
    const name = pickGovernor(documents);

    if (name) {
      governors.set(code, name);
    }
  }

  return governors;
}

/** Ejecuta el script. */
async function main() {
  const congress = await buildCongress();
  const governors = await buildGovernors();

  const states = [];
  const problems = [];

  for (const code of Object.keys(STATE_NAMES)) {
    const [name, nameEs] = STATE_NAMES[code];
    const bucket = congress.get(code) ?? { senators: [], representatives: {} };
    const governor = governors.get(code) ?? null;

    if (bucket.senators.length !== 2) {
      problems.push(`${code}: ${bucket.senators.length} senadores (se esperaban 2)`);
    }
    if (!governor) {
      problems.push(`${code}: sin gobernador`);
    }
    if (!CAPITALS[code]) {
      // Si falta la capital en el mapa de arriba, `JSON.stringify` la omitiría en silencio.
      problems.push(`${code}: sin capital (falta en el mapa CAPITALS)`);
    }
    if (Object.keys(bucket.representatives).length === 0) {
      problems.push(`${code}: sin representantes`);
    }

    // Distritos ordenados: numéricos primero y 'at-large' al final.
    const representatives = Object.fromEntries(
      Object.entries(bucket.representatives).sort(([a], [b]) => {
        if (a === 'at-large') return 1;
        if (b === 'at-large') return -1;
        return Number(a) - Number(b);
      }),
    );

    states.push({
      code,
      name,
      nameEs,
      capital: CAPITALS[code],
      governor,
      senators: [...bucket.senators].sort(),
      representatives,
    });
  }

  const totalDistricts = states.reduce(
    (sum, state) => sum + Object.keys(state.representatives).length,
    0,
  );

  const output = {
    lastUpdated: new Date().toISOString().slice(0, 10),
    sources: {
      congress: CONGRESS_URL,
      governors: 'https://github.com/openstates/people',
    },
    states,
  };

  // Se valida ANTES de escribir: es mejor fallar y no tocar el fichero que publicar un estado
  // sin capital (que JSON.stringify omitiría en silencio) o sin senadores.
  if (problems.length > 0) {
    console.log(`\n❌ Datos incompletos (${problems.length}):`);
    for (const problem of problems) {
      console.log(`   - ${problem}`);
    }
    console.log('\nNo se ha escrito src/data/stateOfficials.json.');
    process.exit(1);
  }

  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log(`\n✅ src/data/stateOfficials.json → ${states.length} estados`);
  console.log(`   senadores: ${states.reduce((n, s) => n + s.senators.length, 0)}`);
  console.log(`   gobernadores: ${states.filter((s) => s.governor).length}`);
  console.log(`   distritos con representante: ${totalDistricts}`);
}

main().catch((error) => {
  console.error('❌', error.message);
  process.exit(1);
});
