// public/sw.js
// Propósito: service worker de la app. Hace dos cosas:
//   1. Permite instalarla como aplicación (Chrome lo exige para ofrecer la instalación).
//   2. Hace que cargue al instante al repetir visita y que funcione SIN CONEXIÓN.
//
// Estrategia (sencilla y sin plugins de build):
//   - Navegación: red primero, con la copia cacheada como respaldo. Así siempre se ve la última
//     versión y, si no hay conexión, se sirve el index.html guardado.
//   - `/assets/*`: caché primero. Los nombres llevan hash, así que su contenido nunca cambia.
//   - Resto del mismo origen (iconos, manifiesto): se sirve la copia y se actualiza por detrás.
//   - Otros orígenes: no se tocan. La app no carga nada de terceros.
//
// Al desplegar una versión nueva cambian los nombres de `/assets/*`, y el `index.html` se pide
// siempre a la red primero, así que no hace falta invalidar nada a mano.

const CACHE = 'ciudadania-v1';
const INDEX = '/index.html';

self.addEventListener('install', () => {
  // El service worker nuevo toma el control sin esperar a que se cierren las pestañas.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((nombre) => nombre !== CACHE).map((nombre) => caches.delete(nombre)));
      await self.clients.claim();
    })(),
  );
});

/** Red primero; si falla, la copia cacheada y, en último caso, el index.html. */
async function redPrimero(request) {
  const cache = await caches.open(CACHE);

  try {
    const respuesta = await fetch(request);

    if (respuesta.ok) {
      // Se guarda bajo `/index.html` para poder responder a cualquier ruta sin conexión.
      await cache.put(INDEX, respuesta.clone());
    }

    return respuesta;
  } catch {
    return (await cache.match(INDEX)) ?? (await cache.match(request)) ?? Response.error();
  }
}

/** Caché primero: solo para recursos con hash, que nunca cambian de contenido. */
async function cachePrimero(request) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(request);

  if (guardada !== undefined) {
    return guardada;
  }

  const respuesta = await fetch(request);

  if (respuesta.ok) {
    await cache.put(request, respuesta.clone());
  }

  return respuesta;
}

/** Se sirve la copia y se refresca por detrás. */
async function cacheYRed(request) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(request);

  const deRed = fetch(request)
    .then(async (respuesta) => {
      if (respuesta.ok) {
        await cache.put(request, respuesta.clone());
      }

      return respuesta;
    })
    .catch(() => guardada);

  return guardada ?? deRed;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Nada de terceros: se dejan pasar tal cual.
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(redPrimero(request));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cachePrimero(request));
    return;
  }

  event.respondWith(cacheYRed(request));
});
