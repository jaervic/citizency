// scripts/e2e.mjs
// Propósito: comprobar la app en un navegador de verdad. Las pruebas de Vitest cubren la lógica y
// el render en servidor, pero hay fallos que solo se ven en el navegador: estilos que no se aplican
// (enlaces subrayados, tarjetas apiladas), glifos que se dibujan como una caja, o interacciones que
// no funcionan (desplegar el repaso, avanzar en el examen).
//
// Uso:
//   node scripts/e2e.mjs                        # contra el build local (npm run preview)
//   node scripts/e2e.mjs https://tu-dominio    # contra producción
//
// Necesita Playwright, que NO es dependencia del proyecto para no cargar el build (el paquete
// descarga navegadores al instalarse). Se instala una sola vez:
//   npm i -D playwright && npx playwright install chromium
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4173';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Preguntas de `questions.json`, para contrastar lo que pinta la app. */
const QUESTIONS = JSON.parse(readFileSync(path.join(ROOT, 'src/data/questions.json'), 'utf8')).questions;

let playwright;
try {
  playwright = await import('playwright');
} catch {
  console.error(
    '❌ Falta Playwright. Instálalo una sola vez con:\n' +
      '   npm i -D playwright && npx playwright install chromium',
  );
  process.exit(2);
}

const resultados = [];
function check(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok, detalle });
  console.log(`${ok ? '✅' : '❌'} ${nombre}${detalle === '' ? '' : ` → ${detalle}`}`);
}

/** Captura de pantalla opcional (útil para revisar el aspecto a ojo): E2E_SCREENSHOTS=1 */
const CON_CAPTURAS = process.env.E2E_SCREENSHOTS === '1';
const DIR_CAPTURAS = process.env.E2E_SCREENSHOTS_DIR ?? '/tmp/opencode';
const captura = async (nombre) => {
  if (CON_CAPTURAS) {
    // Se vuelve arriba antes de capturar: la cabecera es `sticky` y, si la página está desplazada,
    // aparece pintada en mitad de la captura a página completa.
    await page.evaluate(() => window.scrollTo(0, 0));
    const destino = path.join(DIR_CAPTURAS, `e2e-${nombre}.png`);
    await page.screenshot({ path: destino, fullPage: true });
    console.log(`   📷 ${destino}`);
  }
};

/** Comprobaciones de estilos que se rompieron una vez. */
const auditEstilos = () =>
  page.evaluate(() => {
    const subrayados = [];
    document.querySelectorAll('a').forEach((anchor) => {
      const style = getComputedStyle(anchor);
      // El único enlace que debe ir subrayado es el que está dentro de un texto.
      if (style.textDecorationLine.includes('underline') && !anchor.classList.contains('state-link')) {
        subrayados.push(anchor.className || anchor.textContent.trim().slice(0, 20));
      }
    });

    const titulosPegados = [];
    document.querySelectorAll('.home-card').forEach((card) => {
      const titulo = card.querySelector('.home-card__title');
      const subtitulo = card.querySelector('.home-card__subtitle');
      if (titulo !== null && subtitulo !== null) {
        const a = titulo.getBoundingClientRect();
        const b = subtitulo.getBoundingClientRect();
        if (b.top < a.bottom - 2) titulosPegados.push(card.getAttribute('href'));
      }
    });

    const titulo = document.querySelector('.home-card__title');

    return {
      subrayados,
      titulosPegados,
      colorTitulo: titulo === null ? null : getComputedStyle(titulo).color,
      iconos: document.querySelectorAll('svg.icon').length,
    };
  });

const browser = await playwright.chromium.launch();
const context = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await context.newPage();

/**
 * Texto (selector) y el mínimo de contraste WCAG AA exigido. 4.5 es el mínimo para texto normal:
 * el aviso legal daba 3.13 en tema claro antes de arreglar los tonos secundarios.
 */
const PARES_CONTRASTE = [
  ['.home-card__title', 4.5],
  ['.home-card__subtitle', 4.5],
  ['.app-header__title', 4.5],
  ['.screen-subtitle', 4.5],
  ['.home-stat', 4.5],
  ['.app-footer__legal', 4.5],
  ['.app-footer__link', 4.5],
  ['.btn--primary', 4.5],
  ['.hero__streak', 4.5],
  ['.hero__sub', 4.5],
];

/** Textos del progreso: los anillos y las etiquetas de categoría usan los colores por categoría. */
const PARES_CONTRASTE_PROGRESO = [
  ['.ring__value', 4.5],
  ['.progress-category__name', 4.5],
  ['.progress-category__total', 4.5],
  ['.progress-breakdown__label', 4.5],
];

/** Mide el contraste de cada par dentro de la página (se serializa y se ejecuta en el navegador). */
async function medirContraste(target, paresContraste = PARES_CONTRASTE) {
  return target.evaluate((pares) => {
    const toRgb = (value) => {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return match === null ? null : [Number(match[1]), Number(match[2]), Number(match[3])];
    };
    const linear = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (rgb) => 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);

    // Sube por los antecesores hasta encontrar un fondo opaco.
    const background = (element) => {
      let node = element;
      while (node !== null) {
        const style = getComputedStyle(node).backgroundColor;
        const rgb = toRgb(style);
        const alpha = Number((style.match(/rgba?\([^)]*?,\s*([\d.]+)\)/) ?? [])[1] ?? 1);
        if (rgb !== null && alpha > 0.9) {
          return rgb;
        }
        node = node.parentElement;
      }
      return [255, 255, 255];
    };

    return pares
      .map(([selector, minimo]) => {
        const element = document.querySelector(selector);
        if (element === null) {
          return null;
        }
        const foreground = toRgb(getComputedStyle(element).color);
        if (foreground === null) {
          return null;
        }
        const back = background(element);
        const l1 = luminance(foreground);
        const l2 = luminance(back);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        return { selector, ratio: Math.round(ratio * 100) / 100, minimo };
      })
      .filter((entry) => entry !== null);
  }, paresContraste);
}

const errores = [];
page.on('pageerror', (error) => errores.push(`[pageerror] ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errores.push(`[console] ${message.text()}`);
});

/** Dominios de los recursos pedidos: sirve para comprobar que la app no carga nada de terceros. */
const hostsVisitados = new Set();
page.on('request', (request) => {
  try {
    hostsVisitados.add(new URL(request.url()).host);
  } catch {
    hostsVisitados.add('');
  }
});

try {
  // ------------------------------------------------------------------ Inicio
  console.log('\n— Inicio');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

  const estilos = await auditEstilos();
  check('ningún enlace sale subrayado', estilos.subrayados.length === 0, estilos.subrayados.join(', '));
  check('título y subtítulo se apilan en cada tarjeta', estilos.titulosPegados.length === 0, estilos.titulosPegados.join(', '));
  check('el título usa el azul de marca', estilos.colorTitulo === 'rgb(26, 58, 107)', String(estilos.colorTitulo));
  check('los iconos son SVG', estilos.iconos >= 5, `${estilos.iconos} iconos`);
  await captura('inicio');

  // ------------------------------------------------------------- Mi estado
  console.log('\n— Mi estado');
  await page.locator('a[href="/state"]').first().click();
  await page.waitForURL('**/state');
  await page.selectOption('#state-select', 'CA');
  check('al elegir un estado con varios distritos pide el distrito', (await page.locator('#district-select').count()) === 1);
  await page.selectOption('#district-select', '11');

  const california = JSON.parse(readFileSync(path.join(ROOT, 'src/data/stateOfficials.json'), 'utf8')).states.find(
    (state) => state.code === 'CA',
  );
  const textoEstado = await page.locator('body').innerText();
  check('muestra la capital', textoEstado.includes(california.capital), california.capital);
  check('muestra el gobernador', textoEstado.includes(california.governor), california.governor);
  check('muestra los dos senadores', california.senators.every((s) => textoEstado.includes(s)));
  check('muestra el representante del distrito', textoEstado.includes(california.representatives['11']));
  check('sigue sin enlaces subrayados', (await auditEstilos()).subrayados.length === 0);
  await captura('mi-estado');

  // -------------------------------------------------------- Vuelta al inicio
  await page.locator('a.btn--secondary', { hasText: 'Volver al inicio' }).click();
  await page.waitForURL(`${BASE}/`);
  check('el inicio recuerda el estado elegido', (await page.locator('body').innerText()).includes('Mi estado: California'));

  // ------------------------------------------------------------ Flashcards
  console.log('\n— Estudiar');
  await page.locator('a.home-card[href="/flashcards"]').click();
  await page.waitForURL('**/flashcards');
  const contador1 = await page.locator('.topbar__counter').innerText();
  await page.getByRole('button', { name: 'Mostrar respuesta' }).click();
  check('al revelar aparece la respuesta', (await page.locator('.answer-list, .official-card').count()) > 0);
  await page.getByRole('button', { name: 'Ya lo sabía' }).click();
  const contador2 = await page.locator('.topbar__counter').innerText();
  check('avanza a la siguiente pregunta', contador1 !== contador2, `${contador1} → ${contador2}`);

  // ------------------------------------------------------------------ Quiz
  console.log('\n— Examen de práctica');
  await page.goto(`${BASE}/quiz`, { waitUntil: 'networkidle' });
  await page.locator('.quiz-option').first().click();
  check('se puede seleccionar una opción', (await page.locator('.quiz-option[aria-checked="true"]').count()) === 1);
  await page.getByRole('button', { name: 'Comprobar respuesta' }).click();
  check('aparece el feedback', (await page.locator('.feedback').count()) === 1);
  check('marca la opción correcta', (await page.locator('.quiz-option--correct').count()) === 1);

  // Se responde el examen entero para llegar al repaso final.
  for (let i = 0; i < 20; i += 1) {
    const opciones = page.locator('.quiz-option:not([disabled])');
    if ((await opciones.count()) > 0) {
      await opciones.first().click();
      await page.getByRole('button', { name: 'Comprobar respuesta' }).click();
    }
    await page.getByRole('button', { name: /Siguiente pregunta|Ver resultados/ }).click();
  }

  check('al terminar aparece el resultado', (await page.locator('.result-badge').count()) === 1);
  check('al terminar aparece el repaso', (await page.locator('.review').count()) === 1);
  await captura('resultado-examen');

  // Se despliega una pregunta fallada del repaso y se contrasta con questions.json.
  const falladas = page.locator('.review-item', { has: page.locator('.review-item__mark--wrong') });
  const hayFalladas = (await falladas.count()) > 0;
  check('hay preguntas falladas que repasar', hayFalladas);

  if (hayFalladas) {
    const item = falladas.first();
    await item.locator('.review-item__header').click();

    // El enunciado del repaso es `question_es`: se busca en questions.json cuántas respuestas
    // aceptadas tiene esa pregunta y se contrasta con lo que ha pintado la app.
    const enunciado = (await item.locator('.review-item__question').innerText()).trim();
    const pregunta = QUESTIONS.find((candidata) => candidata.question_es === enunciado);
    const esperadas = pregunta?.answers_en.length ?? 0;
    const pintadas = await item.locator('.review-item__correct').count();

    check('se reconoce la pregunta desplegada', esperadas > 0, enunciado.slice(0, 40));
    check(
      'al desplegar muestra TODAS las respuestas aceptadas',
      pintadas > 0 && pintadas === esperadas,
      `${pintadas} pintadas, ${esperadas} esperadas`,
    );
    check('con botón de audio por respuesta', (await item.locator('svg').count()) >= pintadas);
    await captura('repaso-desplegado');
  }

  // -------------------------------------------------------------- Progreso
  console.log('\n— Progreso');
  await page.goto(`${BASE}/progress`, { waitUntil: 'networkidle' });
  check('muestra las 7 categorías', (await page.locator('.progress-category__name').count()) === 7);
  check('muestra el desglose de 4 niveles', (await page.locator('.progress-breakdown__item').count()) >= 4);
  await captura('progreso');

  // ----------------------------------------------------------------- Rutas
  console.log('\n— Rutas');
  await page.goto(`${BASE}/ruta-inexistente`, { waitUntil: 'networkidle' });
  check('una ruta desconocida muestra el 404', (await page.locator('body').innerText()).includes('Pantalla no encontrada'));

  // ------------------------------------------------------ Instalar la app
  console.log('\n— Instalar la app');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check(
    'el inicio ofrece instalarla (no está instalada)',
    (await page.locator('a.home-card[href="/install"]').count()) === 1,
  );

  await page.locator('a.home-card[href="/install"]').click();
  await page.waitForURL('**/install');
  check(
    'la pantalla de instalación explica los pasos',
    (await page.locator('.install-steps__item').count()) >= 3,
  );

  const swRegistrado = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return 'sin soporte';
    }

    const registro = await navigator.serviceWorker.getRegistration();

    return registro === undefined || registro === null ? 'no registrado' : 'ok';
  });
  check('el service worker queda registrado', swRegistrado === 'ok', String(swRegistrado));

  // Sin conexión: la app debe seguir cargando desde la caché del service worker.
  await page.waitForTimeout(1000); // deja que el service worker termine de activarse
  await context.setOffline(true);
  let offlineOk = false;
  try {
    await page.reload({ waitUntil: 'load', timeout: 15000 });
    await page.locator('.app-footer__legal').first().waitFor({ state: 'visible', timeout: 8000 });
    offlineOk = true;
  } catch {
    offlineOk = false;
  } finally {
    await context.setOffline(false);
  }
  check('la app carga sin conexión (gracias al service worker)', offlineOk);

  // ----------------------------------------------------------- Pie de página
  console.log('\n— Pie de página');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });

  const credito = page.locator('.app-footer__link');
  const donacion = page.locator('.app-footer__donate');

  check(
    'acredita al autor',
    (await credito.innerText()).includes('Jaervic Guevara'),
    await credito.innerText(),
  );

  const github = {
    href: await credito.getAttribute('href'),
    target: await credito.getAttribute('target'),
    rel: await credito.getAttribute('rel'),
  };
  check('el crédito enlaza el perfil de GitHub', github.href === 'https://github.com/jaervic', String(github.href));
  check(
    'el crédito abre en otra pestaña y con rel seguro',
    github.target === '_blank' && (github.rel ?? '').includes('noopener') && (github.rel ?? '').includes('noreferrer'),
    `target=${github.target}, rel=${github.rel}`,
  );

  const koFi = {
    href: await donacion.getAttribute('href'),
    target: await donacion.getAttribute('target'),
    rel: await donacion.getAttribute('rel'),
  };
  check('la donación enlaza el Ko-fi del autor', koFi.href === 'https://ko-fi.com/jaervic', String(koFi.href));
  check(
    'la donación abre en otra pestaña y con rel seguro',
    koFi.target === '_blank' && (koFi.rel ?? '').includes('noopener'),
    `target=${koFi.target}, rel=${koFi.rel}`,
  );

  check(
    'el aviso legal está en el pie',
    (await page.locator('.app-footer__legal').innerText()).includes('No está afiliada ni respaldada por USCIS'),
  );

  // El pie debe verse en TODAS las pantallas, no solo en el inicio.
  const rutasSinPie = [];
  for (const ruta of ['/flashcards', '/quiz', '/interview', '/progress', '/state', '/settings']) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'load' });

    // Se espera a que React monte antes de contar: con `domcontentloaded` la comprobación era
    // intermitente porque el pie todavía no estaba en el DOM.
    try {
      await page.locator('.app-footer__legal').first().waitFor({ state: 'visible', timeout: 5000 });
    } catch {
      rutasSinPie.push(ruta);
    }
  }
  check('el pie aparece en todas las pantallas', rutasSinPie.length === 0, rutasSinPie.join(', '));

  // Nada de terceros: la app no debe pedir recursos a dominios externos (es la promesa de
  // privacidad; los enlaces solo se abren si la persona hace clic).
  const externos = [...hostsVisitados].filter((host) => host !== new URL(BASE).host && host !== '');
  check('ninguna petición a dominios externos', externos.length === 0, externos.join(', '));

  // ------------------------------------------------------------------ Temas
  console.log('\n— Modo claro y oscuro');
  for (const scheme of ['light', 'dark']) {
    const themed = await browser.newContext({
      viewport: { width: 420, height: 900 },
      colorScheme: scheme,
    });
    const themedPage = await themed.newPage();

    // Contexto nuevo = almacenamiento vacío, así que la preferencia es 'system' y el tema debe
    // resolverse a partir de `prefers-color-scheme`.
    await themedPage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    const aplicado = await themedPage.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    check(`[${scheme}] «Sistema» sigue al sistema operativo`, aplicado === scheme, String(aplicado));

    const medidas = await medirContraste(themedPage);
    const bajos = medidas.filter((medida) => medida.ratio < medida.minimo);
    check(
      `[${scheme}] contraste AA en ${medidas.length} textos del inicio`,
      bajos.length === 0,
      bajos.map((medida) => `${medida.selector}: ${medida.ratio}`).join(', '),
    );

    // Progreso: aquí viven los anillos y las etiquetas con los colores por categoría.
    await themedPage.goto(`${BASE}/progress`, { waitUntil: 'networkidle' });
    const medidasProgreso = await medirContraste(themedPage, PARES_CONTRASTE_PROGRESO);
    const bajosProgreso = medidasProgreso.filter((medida) => medida.ratio < medida.minimo);
    check(
      `[${scheme}] contraste AA en ${medidasProgreso.length} textos del progreso`,
      bajosProgreso.length === 0,
      bajosProgreso.map((medida) => `${medida.selector}: ${medida.ratio}`).join(', '),
    );

    // El interruptor de Ajustes debe poder forzar el tema contrario al del sistema.
    await themedPage.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    const contrario = scheme === 'light' ? 'Oscuro' : 'Claro';
    await themedPage.getByRole('button', { name: contrario }).click();

    const forzado = await themedPage.evaluate(() => ({
      tema: document.documentElement.getAttribute('data-theme'),
      meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
    }));
    const esperado = scheme === 'light' ? 'dark' : 'light';
    check(
      `[${scheme}] Ajustes fuerza el tema «${contrario}»`,
      forzado.tema === esperado && forzado.colorScheme === esperado,
      `data-theme=${forzado.tema}, color-scheme=${forzado.colorScheme}, theme-color=${forzado.meta}`,
    );
    check(
      `[${scheme}] la barra del navegador cambia con el tema`,
      forzado.meta === (esperado === 'dark' ? '#16233c' : '#1a3a6b'),
      String(forzado.meta),
    );

    await themed.close();
  }

  console.log('\n— Consola');
  check('sin errores de ejecución', errores.length === 0, errores.join(' | '));
} finally {
  await browser.close();
}

const fallos = resultados.filter((resultado) => !resultado.ok);

if (fallos.length > 0) {
  console.log('\nFallos:');
  for (const fallo of fallos) {
    console.log(`  ❌ ${fallo.nombre}${fallo.detalle === '' ? '' : ` → ${fallo.detalle}`}`);
  }
}

console.log(`\n${fallos.length === 0 ? '🎉' : '⚠️'}  ${resultados.length - fallos.length}/${resultados.length} comprobaciones OK`);

process.exit(fallos.length === 0 ? 0 : 1);
