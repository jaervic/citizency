// src/utils/backup.ts
// Propósito: que el progreso del usuario no se pierda. Todo vive en `localStorage`, así que se
// pierde al borrar los datos del navegador, en modo privado o al cambiar de dispositivo. Aquí está
// la lógica (pura y comprobable) para exportarlo y volver a importarlo:
//
//   - Fichero `.json`: cómodo en computadora y en móvil (se guarda en Archivos/Descargas).
//   - Código de texto: un texto corto que se puede pegar en Notas o enviarse por mensaje. Va
//     comprimido (deflate) y en base64url, con un prefijo que indica el formato.
//
// El fichero lleva versión, para poder migrarlo en el futuro sin adivinar el formato.
import type { ThemePreference } from '@/utils/theme';
import type { Location } from '@/utils/stateOfficials';
import type { UserProgress } from '@/types';

/** Marca del formato, para no aceptar cualquier JSON. */
export const BACKUP_FORMAT = 'uscis-ciudadania';

/** Versión del formato de copia. */
export const BACKUP_VERSION = 1;

/** Prefijo de los códigos comprimidos. */
const CODE_PREFIX_COMPRESSED = 'USCIS1Z:';

/** Prefijo de los códigos sin comprimir (navegadores sin `CompressionStream`). */
const CODE_PREFIX_PLAIN = 'USCIS1:';

/** Contenido de una copia de seguridad. */
export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** Fecha ISO en que se exportó. */
  exportedAt: string;
  progress: UserProgress;
  location: Location;
  preferences: {
    theme: ThemePreference;
    voiceName: string | null;
  };
};

/** Resultado de leer un código o un fichero. */
export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string };

/** Resumen legible de una copia, para enseñarlo antes de aplicarla. */
export type BackupSummary = {
  xp: number;
  streak: number;
  /** Preguntas con historial. */
  answered: number;
  /** Preguntas dominadas (3 aciertos seguidos). */
  mastered: number;
  exportedAt: string;
};

/** Datos que se exportan y se restauran: exactamente lo que se persiste en el store. */
export type ExportableState = UserProgress & {
  homeState: string | null;
  homeDistrict: string | null;
  theme: ThemePreference;
  voiceName: string | null;
};

/** Crea la copia a partir del estado actual. */
export function createBackup(state: ExportableState, now: Date = new Date()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    progress: {
      xp: state.xp,
      streak: state.streak,
      lastStudyDate: state.lastStudyDate,
      answeredQuestions: state.answeredQuestions,
    },
    location: { state: state.homeState, district: state.homeDistrict },
    preferences: { theme: state.theme, voiceName: state.voiceName },
  };
}

/** Nombre del fichero de copia, con la fecha. */
export function backupFileName(now: Date = new Date()): string {
  return `ciudadania-progreso-${now.toISOString().slice(0, 10)}.json`;
}

/** JSON de la copia, listo para descargar. */
export function serializeBackup(backup: Backup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/* ------------------------------------------------------------- base64url */

function toBase64Url(bytes: Uint8Array): string {
  let binario = '';

  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }

  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(texto: string): Uint8Array {
  const normalizado = texto.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = '='.repeat((4 - (normalizado.length % 4)) % 4);
  const binario = atob(normalizado + relleno);

  return Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0));
}

/* ------------------------------------------------------------- compresión */

function soportaCompresion(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

async function comprimir(texto: string): Promise<Uint8Array> {
  const flujo = new Blob([texto]).stream().pipeThrough(new CompressionStream('deflate-raw'));

  return new Uint8Array(await new Response(flujo).arrayBuffer());
}

async function descomprimir(bytes: Uint8Array): Promise<string> {
  // Copia con su propio ArrayBuffer: así el Blob recibe exactamente esos bytes (y TypeScript no se
  // queja del tipo de `buffer`, que admite SharedArrayBuffer).
  const copia = new Uint8Array(bytes);
  const flujo = new Blob([copia.buffer as ArrayBuffer]).stream().pipeThrough(new DecompressionStream('deflate-raw'));

  return new Response(flujo).text();
}

/* ------------------------------------------------------- código de texto */

/**
 * Convierte la copia en un código de texto para pegar. Se comprime si el navegador sabe; si no, se
 * guarda el JSON tal cual (el prefijo deja claro qué formato es).
 */
export async function encodeBackup(backup: Backup): Promise<string> {
  const json = JSON.stringify(backup);

  if (!soportaCompresion()) {
    return `${CODE_PREFIX_PLAIN}${toBase64Url(new TextEncoder().encode(json))}`;
  }

  return `${CODE_PREFIX_COMPRESSED}${toBase64Url(await comprimir(json))}`;
}

/** Lee un código de texto. */
export async function decodeBackup(code: string): Promise<ParseResult> {
  const limpio = code.trim();

  if (limpio.startsWith(CODE_PREFIX_COMPRESSED)) {
    if (!soportaCompresion()) {
      return { ok: false, error: 'Este navegador no puede leer el código comprimido. Sube el fichero .json.' };
    }

    try {
      const json = await descomprimir(fromBase64Url(limpio.slice(CODE_PREFIX_COMPRESSED.length)));

      return parseBackup(json);
    } catch {
      return { ok: false, error: 'El código está incompleto o dañado. Cópialo entero y vuelve a intentarlo.' };
    }
  }

  if (limpio.startsWith(CODE_PREFIX_PLAIN)) {
    try {
      const json = new TextDecoder().decode(fromBase64Url(limpio.slice(CODE_PREFIX_PLAIN.length)));

      return parseBackup(json);
    } catch {
      return { ok: false, error: 'El código está incompleto o dañado. Cópialo entero y vuelve a intentarlo.' };
    }
  }

  return { ok: false, error: 'Ese texto no parece una copia de esta app.' };
}

/* ------------------------------------------------------------ validación */

function esNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/** Estadísticas válidas: números no negativos y fecha en texto. */
function limpiarEstadisticas(valor: unknown): UserProgress['answeredQuestions'] {
  if (valor === null || typeof valor !== 'object') {
    return {};
  }

  const resultado: UserProgress['answeredQuestions'] = {};

  for (const [id, estadistica] of Object.entries(valor as Record<string, unknown>)) {
    if (estadistica === null || typeof estadistica !== 'object') {
      continue;
    }

    const { correct, incorrect, lastSeen } = estadistica as Record<string, unknown>;

    if (!esNumero(correct) || !esNumero(incorrect)) {
      continue;
    }

    resultado[id] = {
      correct: Math.max(0, Math.floor(correct)),
      incorrect: Math.max(0, Math.floor(incorrect)),
      lastSeen: typeof lastSeen === 'string' ? lastSeen : new Date(0).toISOString(),
    };
  }

  return resultado;
}

/** Lee y valida una copia desde su JSON. Nunca lanza: devuelve el error como texto. */
export function parseBackup(texto: string): ParseResult {
  let datos: unknown;

  try {
    datos = JSON.parse(texto);
  } catch {
    return { ok: false, error: 'El fichero no es un JSON válido.' };
  }

  if (datos === null || typeof datos !== 'object') {
    return { ok: false, error: 'El contenido de la copia no es válido.' };
  }

  const candidato = datos as Partial<Backup>;

  if (candidato.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'Esta copia no es de esta app.' };
  }

  if (candidato.version !== BACKUP_VERSION) {
    return { ok: false, error: `La copia es de una versión distinta (${String(candidato.version)}).` };
  }

  const progreso = candidato.progress;

  if (progreso === null || typeof progreso !== 'object') {
    return { ok: false, error: 'La copia no trae el progreso.' };
  }

  const ubicacion = candidato.location ?? { state: null, district: null };
  const preferencias = candidato.preferences ?? { theme: 'system', voiceName: null };

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: typeof candidato.exportedAt === 'string' ? candidato.exportedAt : new Date(0).toISOString(),
      progress: {
        xp: esNumero(progreso.xp) ? Math.max(0, Math.floor(progreso.xp)) : 0,
        streak: esNumero(progreso.streak) ? Math.max(0, Math.floor(progreso.streak)) : 0,
        lastStudyDate: typeof progreso.lastStudyDate === 'string' ? progreso.lastStudyDate : null,
        answeredQuestions: limpiarEstadisticas(progreso.answeredQuestions),
      },
      location: {
        state: typeof ubicacion.state === 'string' ? ubicacion.state : null,
        district: typeof ubicacion.district === 'string' ? ubicacion.district : null,
      },
      preferences: {
        theme:
          preferencias.theme === 'light' || preferencias.theme === 'dark' ? preferencias.theme : 'system',
        voiceName: typeof preferencias.voiceName === 'string' ? preferencias.voiceName : null,
      },
    },
  };
}

/* -------------------------------------------------------------- resumen */

/** Resumen para enseñar antes de restaurar. `mastered` se calcula aquí mismo para no depender
 *  del progreso actual del usuario. */
export function summarizeBackup(backup: Backup): BackupSummary {
  const estadisticas = Object.values(backup.progress.answeredQuestions);

  return {
    xp: backup.progress.xp,
    streak: backup.progress.streak,
    answered: estadisticas.length,
    mastered: estadisticas.filter((item) => item.correct >= 3 && item.incorrect === 0).length,
    exportedAt: backup.exportedAt,
  };
}

/* ---------------------------------------------------------------- unir */

/**
 * Combina dos progresos sin perder nada: por pregunta se queda el registro más reciente, la XP y la
 * racha son el máximo, y la ubicación se toma de la copia solo si el usuario no tenía ninguna. Las
 * preferencias actuales (tema y voz) se respetan.
 */
export function mergeProgress(actual: ExportableState, entrante: Backup): ExportableState {
  const preguntas = { ...actual.answeredQuestions };

  for (const [id, estadistica] of Object.entries(entrante.progress.answeredQuestions)) {
    const existente = preguntas[id];

    if (existente === undefined || Date.parse(estadistica.lastSeen) >= Date.parse(existente.lastSeen)) {
      preguntas[id] = estadistica;
    }
  }

  const fechas = [actual.lastStudyDate, entrante.progress.lastStudyDate].filter(
    (fecha): fecha is string => typeof fecha === 'string',
  );
  const lastStudyDate = fechas.length === 0 ? null : fechas.sort()[fechas.length - 1]!;

  return {
    xp: Math.max(actual.xp, entrante.progress.xp),
    streak: Math.max(actual.streak, entrante.progress.streak),
    lastStudyDate,
    answeredQuestions: preguntas,
    homeState: actual.homeState ?? entrante.location.state,
    homeDistrict: actual.homeDistrict ?? entrante.location.district,
    // Las preferencias actuales se respetan: la copia no debería cambiar el tema ni la voz.
    theme: actual.theme,
    voiceName: actual.voiceName,
  };
}

/** Convierte una copia en el estado completo que se aplica al store (modo «reemplazar»). */
export function toRestorable(backup: Backup): ExportableState {
  return {
    ...backup.progress,
    homeState: backup.location.state,
    homeDistrict: backup.location.district,
    theme: backup.preferences.theme,
    voiceName: backup.preferences.voiceName,
  };
}
