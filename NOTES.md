# NOTES.md — Decisiones de producto, monetización y legal

Este archivo NO es código. Es la fuente de verdad para decisiones que no deben perderse entre
sesiones de chat. Cada vez que tomemos una decisión importante de producto, monetización o legal,
se documenta acá.

Última actualización: 2026-10-15 (**migración a webapp**).

---

## 0. Migración a webapp (2026-10-15)

La app dejó de ser una app nativa de Expo/React Native y ahora es una **webapp estática**
(React + Vite) desplegada en Vercel. Motivo: el uso real es mayoritariamente en el navegador del
teléfono, y una web evita las tiendas de apps, las builds nativas y EAS.

**Qué cambió**

- Framework: Expo/React Native → **React 19 + Vite 8**; navegación con **React Router**.
- Estado: Zustand con **`localStorage`** (antes AsyncStorage). Como `localStorage` es síncrono, ya
  no hacen falta las esperas de hidratación que había por pantalla.
- Voz: **Web Speech API** del navegador (`speechSynthesis` y `SpeechRecognition`) en lugar de
  `expo-speech` / `expo-speech-recognition`. Sigue sin claves ni proxy.
- Estilos: `src/theme.ts` (nativo) → tokens de CSS en `src/styles/global.css`. Paleta intacta
  (azul principal `#1a3a6b`).
- El código nativo (`app/`, `App.tsx`, `index.ts`, `eas.json`, `app.json`, `assets/`) se eliminó
  del árbol de trabajo; sigue disponible en el historial de git.

**Deuda técnica que se saldó de paso**

- **Banco curado de distractores del quiz**: `src/data/quizDistractors.json` con 3 distractores
  por pregunta para las 120 que entran al examen de práctica. Antes se generaban con una
  heurística y salían opciones incoherentes (distractores de otro tema o de otra longitud). La
  heurística queda solo como respaldo si algún día falta una entrada nueva.
- **Cola de estudio**: `buildStudyQueue` ahora baraja las preguntas que empatan en prioridad. Con
  el sort estable, un usuario nuevo recibía SIEMPRE las mismas 20 preguntas.
- **El examen de práctica elige 20 preguntas al azar**, no las 20 de mayor prioridad (que serían
  casi siempre las mismas).
- **Pruebas reales**: `npm test` (Vitest) cubre la lógica pura y **renderiza todas las pantallas**
  en el servidor, así que un fallo de render se detecta sin abrir el navegador.
- **ProgressBar** se migró a componente reutilizable en las tres pantallas de sesión.
- Se corrigió el `recordAnswer` de la entrevista, que podía romper la pantalla si el guardado
  fallaba (ahora va envuelto en `try/catch`).
- La pantalla de repaso muestra **todas las respuestas aceptadas**, no solo la primera.
- **Datos que dependen del estado del solicitante** (2026-10-15): las 4 preguntas que dependen de
  dónde vive el usuario (gov-023 senadores, gov-029 representante, gov-061 gobernador, gov-062
  capital) ya tienen respuesta real. Se añadió la pantalla **Mi estado** (estado + distrito) y el
  dataset `src/data/stateOfficials.json` con los 50 estados, generado por
  `scripts/updateOfficials.mjs`. Ver la sección 5-bis para las fuentes y por qué se empaqueta en
  vez de llamar a una API en caliente.
- También entran en el examen de práctica las 8 preguntas dinámicas (antes se quedaban fuera las
  8): las 4 nacionales siempre, y las 4 estatales cuando el usuario configura su estado y distrito.
  Sus distractores se derivan de datos vigentes (los otros tres cargos nacionales u otros estados),
  así que siguen siendo plausibles y claramente incorrectos sin quedar obsoletos.
- **Repaso visual en navegador real (2026-10-15)**: la app se probó con Chromium (Playwright)
  contra el despliegue y aparecieron TRES fallos que las pruebas de unidad no podían ver, porque
  son de CSS y de fuentes:
  1. Los `<a>` heredaban el estilo por defecto del navegador, así que las tarjetas del inicio, el
     botón "Volver al inicio" y la flecha de volver salían **azules y subrayados**.
  2. El título y el subtítulo de las tarjetas del inicio son `<span>` (elementos **en línea**) y se
     pegaban en la misma línea ("Configurar mi estadoElige tu estado…").
  3. Los **emoji** (📍📚📝🎙️📊🎤) y los glifos ✓ ✗ ▲ ▼ se dibujaban como una **caja vacía (▯)** en
     cualquier sistema sin fuente de emoji, y la interfaz parecía rota. Se sustituyeron todos por
     iconos SVG (`src/components/Icon.tsx`), que no dependen de ninguna fuente.

  Para que no vuelvan: `src/test/glyphs.ts` detecta glifos problemáticos en el render de todas las
  pantallas, `src/styles/global.test.ts` fija el contrato del CSS (enlaces sin subrayado, tarjetas
  apiladas) y `npm run test:e2e` recorre la app en un navegador real (26 comprobaciones).

---

## 0-bis. Diseño, ajustes y modos de práctica (2026-10-15, misma sesión)

Segunda tanda del día, ya con la app en Vercel. Todo verificado en Chromium (claro y oscuro).

**Fundamento visual y modo nocturno**
- Tokens de color en dos capas: escalas + **roles semánticos** con valor claro y oscuro. Se separa
  `--brand` (superficie de marca) de `--accent` (texto e iconos): con un único token no se puede,
  porque un azul marino sirve de fondo pero no se lee como texto.
- **Fuera del bloque de tokens no queda ni un color literal.** Lo comprueba una prueba, junto con
  que todos los tokens del claro existan en el oscuro y que ninguno se defina a sí mismo.
- El tema lo aplica un script en línea de `index.html` **antes del primer pintado** (sin destello) y
  `useThemeEffect` lo mantiene al día siguiendo a `prefers-color-scheme`.
- Se corrigió el contraste del texto atenuado en claro (daba 3.13; ahora 4.95). **El contraste se
  mide en el navegador**, no a ojo.

**Rediseño**
- Cada categoría tiene color e insignia propios, usados en examen, tarjetas, repaso y progreso.
- `ProgressRing` (SVG, sin librerías) en el inicio y por categoría.
- Inicio con bloque de racha y botón "Seguir estudiando"; examen con fichas A/B/C/D y resultado en
  anillo.

**Pie, donaciones e instalación**
- Pie en todas las pantallas con el crédito (GitHub), el enlace de Ko-fi y el aviso legal, que
  antes solo estaba en el inicio.
- **Service worker**: la app es instalable (Chrome lo exige), arranca al instante y **funciona sin
  conexión** (probado cortando la red en el E2E).
- Guía de instalación por plataforma, con la detección de iPadOS (que se anuncia como Mac) resuelta
  por puntos táctiles.

**Audio**
- El sonido robótico era la elección de voz, no la API: se cogía la PRIMERA en inglés. Ahora se
  puntúan y se prefieren **las que necesitan internet** (`localService === false`): las "Google…" de
  Chrome y las "… Online (Natural)" de Edge. Filtro defensivo del fallo de Edge 150 y reintento con
  voz local si se cae la conexión. Selector de voz en Ajustes.
- Descartado a propósito: modelos neuronales locales (20-160 MB) y TTS con clave.

**Copia de seguridad** (decisión de producto importante)
- Fichero `.json` + **código de texto comprimido** (~550 caracteres con las 128 preguntas) para el
  móvil. Restaurar con resumen previo y elección entre reemplazar o combinar.
- **Aviso honesto**: sincronizar entre dispositivos sigue necesitando backend; esto no lo resuelve.

**Modos de práctica** (por URL, sin duplicar pantallas)
- 65/20, solo las falladas, por categoría, escribir las respuestas y **simulacro real (10 preguntas,
  se aprueba con 6, se corta cuando el resultado ya no puede cambiar)**.

**Estado del tooling**
- 212 pruebas de unidad y 65 comprobaciones E2E (que incluyen contraste AA en dos temas, la app sin
  conexión y el viaje completo de la copia de seguridad).

**Pendiente y detectado**
- `officialData.json` sigue con fecha **2025-01-20**: los 4 cargos nacionales (presidente,
  vicepresidente, speaker, chief justice) hay que revisarlos a mano. El pie ahora muestra esa fecha,
  así que la antigüedad se ve.

---

## 1. Modelo de monetización

**Modelo elegido**: Freemium con **pago único** (NO suscripción).

**Justificación**:
- Público objetivo: inmigrantes hispanohablantes con presupuesto ajustado.
- La suscripción mensual genera rechazo psicológico en este segmento.
- El pago único "para prepararte hasta tu examen" encaja mejor: el usuario sabe cuándo termina su
  necesidad.

**Precio tentativo**: $4.99 – $7.99 USD (definir en pruebas con usuarios).

### Qué queda GRATIS

- Flashcards completas (128 preguntas, inglés + español).
- Quiz sin cronómetro (20 preguntas aleatorias, corrección automática).
- Progreso básico (racha, XP, categorías).
- Audio 🔊 en todo el contenido (Web Speech API).
- Datos oficiales actualizados (presidente, VP, speaker, chief justice).

### Qué queda PREMIUM (pago único)

- Simulacro de entrevista con voz ilimitado (en web ya está construido; falta el muro de pago).
- Modo "examen cronometrado" con límite de tiempo real.
- Estadísticas avanzadas por categoría.

### Qué NO vamos a hacer (por ahora)

- **Suscripciones mensuales**: rechazado por UX y por el segmento.
- **In-App Purchases fragmentados**: un solo desbloqueo premium es suficiente.
- **Backend/Supabase en v1**: no se necesita. Todo el estado vive local (`localStorage`).
  Tendría sentido solo para sincronizar progreso entre dispositivos.
- **Analytics invasivos**: cero. Si hicieran falta métricas, usar Plausible o Umami (privacy-first).

---

## 2. Estrategia de publicación

**Orden**:
1. Publicar la web **gratis, sin paywall**, por 2–4 semanas (Vercel + difusión directa).
2. Objetivo: juntar reseñas/feedback y datos de uso reales.
3. Después: activar el paywall premium.

**Nota web**: al no haber tienda de apps, la "prueba social" (reseñas) se sustituye por: dominio
propio, compartir en grupos de la comunidad y un manifiesto instalable (PWA) para que el usuario
la tenga en su pantalla de inicio.

**Pago en web**: evaluar Stripe (pago único con Checkout) o Gumroad/Lemon Squeezy antes que Play
Billing, que ya no aplica.

---

## 3. Privacidad y datos

**Principio rector**: minimizar recolección de datos personales sensibles.

- Todo el progreso vive local en el dispositivo (`localStorage`).
- No hay login, no hay cuenta, no hay email obligatorio.
- No hay analytics de terceros.
- **Voz**: `speechSynthesis` es 100% local en la mayoría de navegadores. En `SpeechRecognition`
  (dictado), **Chrome envía el audio a los servidores de Google** para transcribir; Safari puede
  transcribir on-device. La app no almacena ni retransmite el audio por su cuenta y avisa al
  usuario de que el dictado es opcional (siempre puede escribir).

**Documentar en política de privacidad**:
- Qué datos se guardan (progreso local, nada más).
- Qué NO se guarda (audio, ubicación, contactos, etc.).
- Cómo eliminar los datos (botón "Reiniciar progreso" en la pantalla de inicio).

---

## 4. Legal y disclaimers

### Texto del disclaimer (pantalla de inicio, ya presente)

> App de estudio independiente basada en las 128 preguntas oficiales del examen de naturalización
> de USCIS (versión 2025). No está afiliada a USCIS. Verifica siempre la información con las
> fuentes oficiales.

### Dónde debe aparecer

- [x] Pantalla de inicio (texto breve).
- [ ] Página "Acerca de" con el texto legal completo.
- [ ] Política de privacidad enlazada desde el pie.

---

## 5. Contenido y actualización

- El contenido se basa en el temario oficial del USCIS versión 2025 (128 preguntas).
- `src/data/officialData.json` guarda los datos que cambian con el tiempo (presidente, VP,
  speaker, chief justice) con fecha de actualización visible.
- **Revisión periódica**: cada cambio de administración o de figuras clave, actualizar
  `officialData.json`. Al menos 1 vez al año.

## 5-bis. Las 4 preguntas que dependen del estado del solicitante (2026-10-15)

Son gov-023 (senadores), gov-029 (representante), gov-061 (gobernador) y gov-062 (capital). El
examen las pregunta a TODOS los solicitantes y no tienen respuesta fija: dependen de dónde vive la
persona.

**Decisión: empaquetar los datos, no llamar a una API en caliente.** Motivo: la app es estática y
sin backend, y el principio del proyecto es no depender de claves ni de servicios externos (si el
servicio cae o cambia de condiciones, la pregunta se queda sin respuesta). El día que haya backend,
esto se puede sustituir por una consulta en vivo sin cambiar la UI.

**Fuentes elegidas** (públicas, sin clave, verificadas el 2026-10-15):

| Dato | Fuente | Notas |
| --- | --- | --- |
| Senadores y representantes | `unitedstates/congress-legislators` (JSON, vía `unitedstates.github.io`) | Proyecto de dominio público, se actualiza solo. Nota: el endpoint `theunitedstates.io` devuelve 403/404; el que funciona es el de GitHub Pages. |
| Gobernadores | `openstates/people` (YAML por cargo) | Se actualiza a diario. Se elige el cargo `type: governor` con la fecha de fin más lejana (un gobernador saliente conserva su cargo histórico). |
| Capitales | Constante del script | No cambian nunca. |

**APIs descartadas** y por qué: `api.congress.gov` y `api.data.gov` requieren clave; la
*Google Civic Information API* también y su endpoint de representantes está muy recortado desde
2020; *Open States API v3* requiere clave (se usa su repositorio de datos, que es público);
*LegiScan* requiere registro; los datasets de gobernadores en GitHub que se encontraron estaban sin
mantener desde 2020.

**Mantenimiento**: `npm run update-officials` regenera el fichero, y el workflow
`.github/workflows/update-officials.yml` lo ejecuta el día 1 de cada mes y hace commit si algo
cambió. El script valida antes de escribir (50 estados, 2 senadores por estado, capital y gobernador
presentes) y falla sin tocar el fichero si algo falta: un fallo ruidoso es mejor que publicar una
respuesta vacía. De hecho, la primera ejecución con pruebas descubrió que faltaba Oregón en el mapa
de capitales, y `JSON.stringify` lo habría omitido en silencio.

**Cómo lo ve el usuario**: pantalla **Mi estado**, donde elige estado y (si procede) distrito
congresional. Se guarda en `localStorage`; los datos se le muestran como respuesta oficial, con
botón de audio, y el repaso final los incluye. Si no ha configurado su estado, la app se lo pide en
vez de inventar una respuesta.

---

## 6. Roadmap y fases

- [x] Fase 1–4: contenido, algoritmo de repetición espaciada, flashcards, datos oficiales.
- [x] **Fase 5**: quiz, progreso y modo revisión (`SessionReview`).
- [x] **Fase 6**: entrevista. En web con Web Speech API (dictado del navegador) + `fuzzyMatch` +
  `AnswerFeedback`. Degrada a escribir cuando el navegador no soporta voz.
- [x] **Fase 7 (parcial)**: migración a webapp Vite + despliegue en Vercel, banco curado de
  distractores, tests, datos estatales al día, pantalla "Mi estado", modo nocturno, rediseño, pie
  con donaciones, instalable como app (service worker), Ajustes, copia de seguridad y modos de
  práctica. Queda: paywall, página "Acerca de" formal, política de privacidad y publicar el enlace.
- [ ] Fase 8: examen de lectura/escritura, práctica N-400, sincronización opcional entre
  dispositivos, estructura 501(c)(3).

**Regla**: no tocar monetización hasta que el producto premium esté construido.

---

## 7. Decisiones pendientes (para revisar en su momento)

- [ ] Precio final del desbloqueo premium y proveedor de pago en web (Stripe vs Gumroad).
- [ ] ¿El simulacro de entrevista tiene límite de intentos en la versión gratis?
- [x] Modo oscuro (2026-10-15): hecho, con tokens por rol, script en línea para no destellar y
      selector Sistema/Claro/Oscuro en Ajustes.
- [ ] ¿Idioma inglés para la UI además de español?
- [x] Pantalla "Mi estado" (2026-10-15): el usuario elige su estado y su distrito para resolver
      senadores, representante, gobernador y capital (gov-023, gov-029, gov-061, gov-062). Ver la
      sección 5-bis.
- [x] Modo Práctica vs Modo Examen (2026-10-15): el examen de práctica corrige al momento y el
      "Simulacro real" (`/quiz?count=10&feedback=final`) usa el formato de la entrevista (10
      preguntas, se aprueba con 6, sin corrección hasta el final y se corta cuando el resultado ya
      no puede cambiar). Falta, si se quiere, el **cronómetro**; no encontrado como necesario.
- [ ] Sincronizar el progreso ENTRE dispositivos: la copia de seguridad (fichero o código) no lo
      resuelve, es manual. Requiere backend + cuentas + política de privacidad, así que es una
      decisión aparte (hoy está aparcado).
- [ ] Años > 100 en `answers_en`: 7 respuestas tienen números > 100 (435, 1776, 1812, 1870, 1920,
      1929, 1956) que hoy quedan en dígitos al comparar. Decir "seventeen seventy six" contra
      "1776" no matchea. Evaluar si duele en pruebas reales antes de implementar una regla de
      lectura de años.
- [ ] Revisar `officialData.json` (última fecha: 2025-01-20): los 4 cargos nacionales se actualizan a
      mano y el pie de página ya muestra la fecha, así que su antigüedad queda a la vista.

---

## 8. Decisiones que NO deben perderse (porque no se leen del código)

- Los **4 niveles de dominio** en Progreso (`new` / `learning` / `reviewing` / `mastered`) son
  intencionales. NO simplificar a 3.
- La respuesta correcta del quiz es SIEMPRE **`answers_en[0]`**: en `questions.json` las respuestas
  más comunes van primero.
- Los distractores del quiz salen del **banco curado** (`quizDistractors.json`), no de respuestas
  de preguntas hermanas. El antiguo `USE_SIBLING_ANSWERS_AS_DISTRACTORS = false` ya no existe: la
  decisión pedagógica que representaba (nada de distractores absurdos) se cumple ahora con el
  banco curado.
- El criterio para aceptar/rechazar propuestas de herramientas de IA: aceptar lo que prepare para
  algo que ya sabemos que necesitaremos; rechazar lo que complique sin beneficio claro.
- Los **datos de los 50 estados** (`stateOfficials.json`) se empaquetan en el repositorio y se
  regeneran con `npm run update-officials` (y una tarea mensual en GitHub Actions). NO se llama a
  una API en caliente: la app es estática y sin claves, y la pregunta no puede quedarse sin
  respuesta porque un servicio externo falle. Ver la sección 5-bis.

---

## 9. Recordatorios de contexto

- **Voz en web**: requiere HTTPS o `localhost`. Chrome/Edge/Safari la soportan; Firefox no. Si el
  micrófono falla con `not-allowed` en Chrome, revisar EN ESTE ORDEN: (1) que haya un micrófono
  conectado y detectado por el sistema (Chrome devuelve `not-allowed` también sin dispositivo de
  entrada válido); (2) permisos de micrófono del sitio; (3) extensiones (probar en incógnito);
  (4) usar otra red, porque algunos navegadores fallan si el servicio de voz no es alcanzable.
- **Branding**: nombre definitivo, ícono y tipografía aún sin decidir. El favicon y el manifiesto
  actuales son provisionales.
- **Pruebas**: viven en `src/**/*.test.ts(x)` y se ejecutan con `npm test`. Las de render usan
  `renderToString` con un stub de `localStorage` (`src/test/setup.ts`).
- **Subvenciones USCIS**: considerar estructura 501(c)(3) cuando haya tracción real. Programa
  CINAS. Es recordatorio personal, no tarea.

## 10. Traspaso entre chats (protocolo)

Cada vez que se migra a un chat nuevo, el traspaso debe incluir:
1. `NOTES.md` completo (este archivo).
2. Resumen de la última sesión: qué se cerró, qué quedó pendiente.
3. Estado actual de Fase.
4. Pendientes inmediatos (1-3 tareas concretas).
