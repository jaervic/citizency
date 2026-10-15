# USCIS Ciudadanía

Webapp para estudiar el **examen de ciudadanía de los Estados Unidos** (USCIS, versión 2025, 128
preguntas). Interfaz en español; preguntas y respuestas del examen en inglés.

Funciona entera en el navegador: no hay servidor, no hay cuentas y **no hace falta ninguna clave
de API**. Tu progreso se guarda en el propio dispositivo.

## Qué incluye

- **Estudiar (flashcards)**: sesiones de 20 preguntas priorizadas por un sistema de repetición
  espaciada. Revelas la respuesta, te autoevalúas y las que fallas se repasan en la misma sesión.
- **Examen de práctica**: 20 preguntas tipo test con 4 opciones. Se aprueba con 12 de 20, igual
  que en el examen real. Los distractores son plausibles pero claramente incorrectos.
- **Entrevista**: 5 preguntas al azar. Puedes responder en voz alta (Web Speech API) o escribiendo;
  la corrección es tolerante a errores de reconocimiento.
- **Mi estado**: eliges tu estado (y tu distrito) y la app resuelve las 4 preguntas del examen que
  dependen de dónde vives: senadores, representante, gobernador y capital, con datos actualizados.
- **Progreso**: XP, racha de días y dominio por categoría con 4 niveles (nueva, en estudio, en
  repaso, dominada).
- **Audio**: cualquier pregunta o respuesta se puede escuchar en inglés.

## Requisitos

- Node.js 20.19+ o 22.12+ (probado con Node 22).
- Un navegador moderno. El dictado por voz necesita **Chrome, Edge o Safari** y una conexión HTTPS
  (o `localhost`); en Firefox la entrevista funciona escribiendo.

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # pruebas de la lógica pura y del render de las pantallas
npm run build     # compila a dist/ (ejecuta también el chequeo de tipos)
npm run preview   # sirve dist/ como en producción
```

## Despliegue en Vercel

1. Importa el repositorio en Vercel.
2. Vercel detecta Vite automáticamente. Si no:
   - **Build command**: `npm run build`
   - **Output directory**: `dist`
3. `vercel.json` ya incluye la reescritura de todas las rutas a `index.html`, necesaria para que
   las rutas de la SPA (`/quiz`, `/progress`…) funcionen al recargar.

HTTPS lo pone Vercel, así que el micrófono de la entrevista funcionará sin configuración extra.

## Contenido

- `src/data/questions.json` — las 128 preguntas bilingües. Se genera con `npm run merge` a partir
  de `src/data/en.json` y `src/data/es.json`.
- `src/data/quizDistractors.json` — banco curado con 3 distractores por cada una de las 120
  preguntas estáticas (las demás se distraen con datos oficiales vigentes).
- `src/data/officialData.json` — datos que cambian con el tiempo (presidente, vicepresidente,
  speaker, chief justice) con su fecha de revisión. Actualízalo cuando cambie el gobierno.
- `src/data/stateOfficials.json` — los 50 estados con su capital, gobernador, dos senadores y los
  representantes por distrito.

### Datos que dependen del estado del solicitante

El examen incluye 4 preguntas que dependen de dónde vive el solicitante (gov-023 senadores, gov-029
representante, gov-061 gobernador y gov-062 capital). No se pueden responder con un dato fijo, así
que la app pide al usuario su estado y su distrito en **Mi estado** y los resuelve con
`stateOfficials.json`.

Ese fichero se genera con:

```bash
npm run update-officials
```

que descarga datos de dos fuentes públicas **sin clave de API**:

| Dato | Fuente |
| --- | --- |
| Senadores y representantes | [`unitedstates/congress-legislators`](https://github.com/unitedstates/congress-legislators) (dominio público) |
| Gobernadores | [`openstates/people`](https://github.com/openstates/people) |
| Capitales | Constante del script (no cambian nunca) |

El workflow `.github/workflows/update-officials.yml` lo ejecuta **el día 1 de cada mes** y hace
commit si algo cambió, así que los datos se mantienen al día solos. El script valida el resultado
antes de escribir (50 estados, 2 senadores por estado, capital y gobernador presentes) y falla sin
tocar el fichero si algo falta: es preferible un fallo ruidoso a publicar una respuesta vacía.

## Estructura

```
src/
  components/   UI reutilizable (Layout, SpeakerButton, ProgressBar, SessionReview…)
  hooks/        useSpeechRecognition (dictado con Web Speech API)
  routes/       una pantalla por ruta (Home, Flashcards, Quiz, Interview, Progress, NotFound)
  store/        estado global con Zustand, persistido en localStorage
  utils/        lógica pura: repetición espaciada, racha, comparación difusa, opciones del quiz
  styles/       hoja de estilos única (tokens + mobile-first)
```

## Aviso

Herramienta de estudio **independiente**, basada en material público del USCIS. No está afiliada
ni respaldada por USCIS, no constituye asesoría legal y no garantiza la aprobación del examen.
Verifica siempre la información con las fuentes oficiales.
