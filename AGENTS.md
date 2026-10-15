# AGENTS.md — Guía para agentes de código

## Qué es este repositorio

Webapp **estática** (SPA) para estudiar el examen de ciudadanía de los Estados Unidos
(USCIS, versión 2025, 128 preguntas). Público objetivo: hispanohablantes. La interfaz está en
español; las preguntas y respuestas del examen, en inglés.

- **Stack**: React 19 + TypeScript + Vite 8 (rolldown), React Router 7, Zustand 5 (persistido en
  `localStorage`), CSS plano. Sin backend, sin claves de API.
- **Despliegue**: Vercel. `npm run build` genera `dist/` y `vercel.json` hace el *fallback* de la
  SPA a `index.html`.
- **Voz**: Web Speech API del navegador (`speechSynthesis` para leer, `SpeechRecognition` para
  dictar). Requiere HTTPS o `localhost`.
- **Antes había una app nativa (Expo/React Native)**: se eliminó del árbol de trabajo; sigue en el
  historial de git si hiciera falta.

## Documentación de las dependencias

Antes de escribir código, consulta la documentación de la versión instalada, no la de memoria:

- Expo **ya no se usa** aquí.
- Vite: https://vite.dev/guide/
- React: https://react.dev/
- React Router: https://reactrouter.com/
- Zustand: https://zustand.docs.pmnd.rs/
- Web Speech API: https://developer.mozilla.org/docs/Web/API/Web_Speech_API

## Comandos

```bash
npm install        # dependencias
npm run dev        # servidor de desarrollo
npm run build      # tsc -b && vite build (debe pasar antes de dar algo por terminado)
npm test           # pruebas con Vitest (utils + render de todas las pantallas)
npm run preview    # sirve dist/ para comprobar el build de producción
npm run merge      # regenera src/data/questions.json a partir de en.json + es.json
npm run update-officials  # regenera src/data/stateOfficials.json (senadores, representantes, gobernadores)
```

## Estructura

- `src/data/` — contenido: `questions.json` (generado), `en.json`, `es.json`, `officialData.json`
  (cargos nacionales), `stateOfficials.json` (los 50 estados), y `quizDistractors.json` (banco
  curado de distractores de las preguntas estáticas).
- `src/utils/` — lógica pura y probada: `spacedRepetition.ts`, `streak.ts`, `fuzzyMatch.ts`,
  `quizOptions.ts`, `content.ts`, `stateOfficials.ts`.
- `src/store/useStore.ts` — estado global (Zustand) con el progreso del usuario.
- `src/components/` — UI reutilizable (Layout, SpeakerButton, ProgressBar, SessionReview,
  AnswerFeedback, ConfirmDialog, OfficialAnswerCard).
- `src/routes/` — una pantalla por ruta: Home, Flashcards, Quiz, Interview, Progress, NotFound.
- `src/styles/global.css` — estilos y tokens de color (clases prefijadas, mobile-first).

## Reglas del proyecto

1. **No toques la lógica pura sin actualizar sus pruebas.** `npm test` y `npm run build` deben
   pasar.
2. **Mobile-first**: la mayoría del uso es en teléfono. Objetivos táctiles ≥ 44 px, sin hover como
   única señal, `env(safe-area-inset-*)` en cabecera y pie.
3. **Decisiones de producto que no se cambian** (ver `NOTES.md`): los 4 niveles de dominio en
   Progreso, la respuesta correcta del quiz es `answers_en[0]`, y los distractores son
   plausibles pero inequívocamente incorrectos.
4. **Sin claves ni servicios externos.** Si algo necesita un servidor, se replantea.
5. **Nuevos datos del examen**: actualiza `en.json`/`es.json`, corre `npm run merge` y revisa que
   el banco de distractores siga cubriendo todas las preguntas estáticas del quiz (`npm test` lo
   verifica).
6. **Datos oficiales nacionales**: actualiza `src/data/officialData.json` y su `lastUpdated` cuando
   cambie el gobierno.
7. **Datos estatales**: no se editan a mano. Cambia `scripts/updateOfficials.mjs` (o espera a la
   tarea mensual de GitHub Actions) y ejecuta `npm run update-officials`.
8. **Distractores de las preguntas dinámicas**: se derivan de datos vigentes (los otros tres cargos
   nacionales, u otros estados para senadores/representante/gobernador/capital). No los escribas a
   mano: se quedarían obsoletos y romperían el requisito de que un distractor sea plausible pero
   inequívocamente incorrecto.
