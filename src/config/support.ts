// src/config/support.ts
// Propósito: los enlaces externos de la app en un solo sitio: el crédito del autor, el repositorio
// y las donaciones. Aquí es donde se cambia o se añade una plataforma de donación (una línea), sin
// tocar componentes.
//
// Reglas (ver `AGENTS.md`): solo enlaces salientes, con `https`, abiertos en otra pestaña con
// `rel="noopener noreferrer"`. Nada de embeber widgets ni scripts de terceros: la app promete no
// cargar nada de fuera hasta que la persona hace clic.

/** Autor de la app. */
export const AUTHOR = {
  name: 'Jaervic Guevara',
  /** Perfil de GitHub (no el repositorio: lo pedido fue enlazar el perfil). */
  githubUrl: 'https://github.com/jaervic',
} as const;

/** Enlace de donación (Ko-fi). El importe se elige en la propia página de Ko-fi. */
export const DONATION_URL = 'https://ko-fi.com/jaervic';

/** Texto del enlace de donación. */
export const DONATION_LABEL = 'Invítame a un café';

/** Aviso legal que se muestra al pie de TODAS las pantallas. */
export const LEGAL_NOTICE =
  'App de estudio independiente basada en las 128 preguntas oficiales del examen de naturalización de USCIS (versión 2025). No está afiliada ni respaldada por USCIS y no constituye asesoría legal. Verifica siempre la información con las fuentes oficiales.';

/** Todos los enlaces externos, para poder comprobarlos en las pruebas. */
export const EXTERNAL_LINKS = [AUTHOR.githubUrl, DONATION_URL] as const;
