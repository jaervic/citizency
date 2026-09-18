Documento de traspaso (solo lectura, **no he modificado ningún archivo**).

---

# Traspaso de contexto — `ciudadania-app`

Repo: c:\Proyectos\citizency\ciudadania-app · git `main` · Remoto: https://github.com/jaervic/ciudadania-app · Generado: 2026-09-18.

## 1. Estado exacto del proyecto

**Versiones reales** (`package.json`): Expo SDK `~57.0.23` · React Native `0.86.3` · React `19.2.3` · TypeScript `~6.0.3` · Zustand `^5.0.15` · expo-router `~57.0.21` · expo-speech `~57.0.3` · AsyncStorage `2.2.0` · react-native-safe-area-context `~5.7.0` · react-native-web `^0.21.2` · **expo-av `^16.0.8` (0 referencias en código)**. `main: "expo-router/entry"`. `tsconfig`: extiende `expo/tsconfig.base`, `strict: true`, `paths @/* → ./src/*`, `include **/*.ts(x)`. **No hay ESLint, Prettier ni Jest.**

**`src/data/questions.json`**: **128** preguntas · **405** respuestas aceptadas · `languageCode: "multi"`.
**Dinámicas** (`answers_en` vacío): **8** → `gov-023, gov-029, gov-030, gov-038, gov-039, gov-057, gov-061, gov-062` (las 8 tienen `officialField`).
**Dependen del estado del usuario** (`stateSpecific: true`): **4** → `gov-023` (senadores), `gov-029` (representante), `gov-061` (gobernador), `gov-062` (capital).
`is_65_20: true` en **20** preguntas. Distribución por categoría: 15 / 47 / 10 / 17 / 10 / 19 / 10. Nº de respuestas por pregunta: `0:8, 1:40, 2:21, 3:17, 4:16, 5:8, 6:9, 7:1, 8:2, 10:2, 11:1, 13:1, 22:1, 25:1`.

**Líneas por archivo (medido hoy)**

| Archivo | Líneas | | Archivo | Líneas |
|---|---|---|---|---|
| `app/flashcards.tsx` | 853 | | `src/store/useStore.ts` | 100 |
| `app/quiz.tsx` | 818 | | `src/types/index.ts` | 161 |
| `app/progress.tsx` | 317 | | `src/utils/spacedRepetition.ts` | 274 |
| `app/index.tsx` | 97 | | `src/utils/fuzzyMatch.ts` | 13 *(placeholder)* |
| `app/_layout.tsx` | 28 | | `src/components/SpeakerButton.tsx` | 160 |
| `src/data/questions.json` | 4383 | | `src/components/ProgressBar.tsx` | 26 |
| `src/data/officialData.json` | 11 | | `src/components/Button.tsx` | 5 *(placeholder)* |
| `src/data/en.json` / `es.json` | 1286 / 134 | | `src/components/Card.tsx` | 5 *(placeholder)* |
| `scripts/mergeQuestions.js` | 282 | | `app.json` / `tsconfig.json` | 29 / 15 |

## 2. Mapa de rutas y navegación

| Ruta (`app/`) | Pantalla | Qué hace |
|---|---|---|
| `_layout.tsx` | Stack raíz (expo-router) | Header azul `#0B3D91`, `SafeAreaProvider`, `StatusBar light`; títulos: index "USCIS Ciudadanía", flashcards "Estudiar", quiz "Examen de práctica", progress "Progreso" |
| `index.tsx` | Home | Racha + XP, menú con 3 `Link` a `/flashcards`, `/quiz`, `/progress`, y "Reiniciar progreso" (`Alert` + `store.reset`) |
| `flashcards.tsx` | Estudio | Sesión de 20 por prioridad; revela respuestas/explicación/vocabulario; re-encola falladas (máx 2); pantalla de fin con % de Fase A; modos "Repaso intensivo" (`excludeMastered`) y "Repaso completo" (128) |
| `quiz.tsx` | Examen | 20 preguntas aleatorias en 3 fases `quiz → results → review`; multiple choice de 4 opciones; aprueba con 12/20; repaso de falladas con ✓/✗ |
| `progress.tsx` | Progreso | Resumen (racha, XP, respondidas/128) + una card por las 7 categorías con barra, % dominado y desglose de 4 niveles |

Navegación: Home → `Link` (flashcards/quiz/progress); las tres vuelven con `router.push('/')`; **estados internos** (no rutas): flashcards tiene sesión / fin de sesión / "todo dominado" / refuerzo Fase B; quiz tiene quiz / results / review. `SpeakerButton` en flashcards (todo el inglés) y en quiz **solo** en la fase review (enunciado + opción correcta). No hay rutas dinámicas ni `+not-found`.

## 3. API del store (`src/store/useStore.ts`)

Estado = `UserProgress` (4 campos) + 4 acciones:
`xp: number` · `streak: number` · `lastStudyDate: string | null` (ISO `YYYY-MM-DD` local) · `answeredQuestions: Record<string, { correct: number; incorrect: number; lastSeen: string }>` (clave = id, p.ej. `gov-001`).

```ts
recordAnswer: (questionId: string, wasCorrect: boolean) => void   // delega en recordAnswer() pura; suma +10 XP si acierto, +0 si fallo. NO toca streak.
incrementStreak: () => void                                       // +1 solo si lastStudyDate !== hoy (idempotente por día local)
addXp: (amount: number) => void
reset: () => void                                                 // vuelve al progreso inicial
```
Está exportado también `type StoreState = UserProgress & { …acciones }`.
**Hidratación**: `create<StoreState>()(persist(…)` con `name: 'userProgress'`, `version: 1`, `storage: createJSONStorage(() => AsyncStorage)`, `partialize` = solo los 4 campos de datos (las acciones no se persisten). Las pantallas **no** usan `<PersistGate>`: leen con `useStore.persist.hasHydrated()` y se suscriben con `useStore.persist.onFinishHydration(cb)` (devuelve cleanup). El store no contiene reglas de negocio.

## 4. API de utils (`src/utils/spacedRepetition.ts`)

```ts
type MasteryLevel = 'new' | 'learning' | 'reviewing' | 'mastered'
type StudyQueueOptions = { limit?: number; category?: Category; only65_20?: boolean; onlyPending?: boolean; excludeMastered?: boolean; now?: Date }
type CategoryProgress = { total: number; mastered: number; learning: number; new: number }

calculatePriority(progress, questionId, now = new Date()): number
buildStudyQueue(questions, progress, options = {}): Question[]
recordAnswer(progress, questionId, wasCorrect, now = new Date()): UserProgress
getMasteryLevel(progress, questionId): MasteryLevel
getCategoryProgress(questions, progress): Record<Category, CategoryProgress>
```
- `calculatePriority`: 100 si nunca vista; si vista, `incorrect*10 − correct*5 + días sin verla (máx 30)`.
- `buildStudyQueue`: filtra por `category`/`only65_20`/`onlyPending`/`excludeMastered`, ordena por prioridad descendente y recorta al `limit` (def. 20; `Infinity` = todas). Con `excludeMastered` un array vacío = ya domina todo.
- `recordAnswer`: **pura** (no muta); acierto `correct+1` (y `incorrect→0` al llegar a 3), fallo `incorrect+1` y `correct=0`; actualiza `lastSeen`. No toca `xp`/`streak`/`lastStudyDate`.
- `getMasteryLevel`: `new` sin stats · `learning` si `incorrect>0` · `mastered` si `correct>=3` · `reviewing` si `correct>=1`.
- `getCategoryProgress`: agrega por categoría; **`learning` agrupa learning + reviewing**; siempre devuelve **las 7 categorías** en el orden oficial; `total = mastered + learning + new`.

## 5. Contratos de tipos (`src/types/index.ts` — 8 exports)

`VocabularyItem { word; translation }` · `OfficialField = 'senators'|'representative'|'speakerOfHouse'|'president'|'vicePresident'|'chiefJustice'|'governor'|'capital'|null` · `OfficialData { lastUpdated: string; president; vicePresident; speakerOfHouse; chiefJustice: string; senators; representative; governor; capital: string|null }` · `Category` (7 literales en español) · `Question { id; category; question_en; answers_en[]; question_es; answers_es[]; explanation_es; vocabulary[]; is_65_20; stateSpecific; officialField }` · `QuestionsFile { languageCode: string; questions: Question[] }` · `UserProgress { xp; streak; lastStudyDate; answeredQuestions }` · `StudyMode = 'flashcard'|'quiz'|'audio'|'voice'` (**no usado todavía**).

## 6. Convenciones observadas

1. **Patrón `hydrated`** (idéntico en las 3 pantallas): `const [hydrated, setHydrated] = useState(false)` + un `useEffect` que llama `markHydrated()` si `hasHydrated()`, o devuelve `onFinishHydration(markHydrated)`; mientras `!hydrated` se pinta `<ActivityIndicator size="large" color="#1a3a6b" />` dentro de `SafeAreaView` centrado. Refs: **flashcards.tsx:120 y 149-163**, **quiz.tsx:225 y 233-243**, **progress.tsx:58 y 66-76**. En flashcards la cola se construye *dentro* del callback de hidratación (150-155) para no leer un store vacío.
2. **Errores del store**: `try { useStore.getState().recordAnswer(...) } catch (error) { console.warn('[quiz] no se pudo registrar la respuesta en el store:', error); }` → **quiz.tsx:281-285** es el único sitio; el prefijo `[pantalla]` es la convención del mensaje.
3. **Colores**: hardcoded, sin tema central. Paleta de flashcards/quiz/progress/SpeakerButton: `#1a3a6b` (principal), `#f0f4f9` (fondo suave), `#666666`/`#888888` (secundario), `#2e7d32` verde, `#c62828` rojo, `#7a5c00` ámbar. `ProgressBar` usa `#e4eaf2`/`#1a3a6b`. **Ojo**: `app/_layout.tsx` y `app/index.tsx` usan otra paleta (`#0B3D91`, `#F5F7FA`, `#F7F9FC`, `#D6E0EE`, `#334155`).
4. **Estructura de pantalla**: `SafeAreaView edges={['top','left','right']}` → `ScrollView` con `contentContainerStyle` (`padding: 20`, `gap: 14`) → secciones en `View` tipo tarjeta (blanco, borde claro, `borderRadius: 14`, `padding: 16`); `StyleSheet.create` **siempre al final** del archivo; JSDoc `/** */` en cada constante/función y **comentario de cabecera de 5-15 líneas** explicando el propósito del archivo.
5. **JSON + aserción de tipo**: `const QUESTIONS: Question[] = (questionsJson as QuestionsFile).questions;` (el import de JSON ensancha los tipos).
6. **Lógica de dominio fuera de las pantallas**: toda regla vive en `utils` puras; las pantallas orquestan y pintan.
7. Componentes reutilizables reales: `SpeakerButton` (flashcards + quiz) y `ProgressBar` (solo progress por ahora).
8. **Idioma**: comentarios y textos de UI en español; identificadores en inglés; contenido en inglés (lo que se aprende) con traducción española.
9. **Ids**: prefijo `gov|civ|his` + 3 dígitos. Rango real: `gov-001..062`, `civ-063..072`, `his-073..099`, `his-100..118`, `civ-119..128` (**no existe `civ-100`**).
10. Patrón de botón: `Pressable accessibilityRole="button"` con `style={({ pressed }) => [...]}`; radios y checks con `accessibilityRole="radio"`/`"radiogroup"` y `accessibilityState`.

## 7. Decisiones implícitas (no obvias leyendo solo el código)

- **`quiz.tsx:29-46` → `USE_SIBLING_ANSWERS_AS_DISTRACTORS = false`**: decisión de PRODUCTO (solo `answers_en[0]` es válida; las demás respuestas aceptadas de esa pregunta quedan vetadas como distractores). Incluye nota de **mejora futura no bloqueante**: banco curado `src/data/quizDistractors.json`, ~360 entradas, evaluar en Fase 7. **No cambiar a `true`** (lo pide `NOTES.md §10`).
- **La correcta del quiz es siempre `answers_en[0]`** (no aleatoria) — decisión explícita, comentada en `buildOptions`.
- **Las 8 dinámicas están fuera del quiz** (`QUIZ_POOL` = 120); las 4 con valor en `officialData.json` se pospusieron a una iteración posterior.
- **flashcards: dos fases de contador** (A = sesión original, B = re-encoladas) y el **% se calcula SOLO con la Fase A** (líneas 305-320); `MAX_VISIBLE_ANSWERS = 5` con botón "Ver las N restantes" porque las respuestas más comunes van al inicio del array.
- **Racha**: `incrementStreak()` se llama **una sola vez** al terminar flashcards; el **quiz NO la toca** (decisión explícita). `NOTES.md §7` lo lista como pendiente (`markStudiedToday()`).
- **`progress.tsx`**: los **4 niveles** (new/learning/reviewing/mastered) son intencionales y **no deben simplificarse a 3**; como `getCategoryProgress` agrupa `reviewing` dentro de `learning`, se llama a `getMasteryLevel` por pregunta (comentado en 29-36).
- **`SpeakerButton`**: sanitiza paréntesis/corchetes antes del TTS (bug real: "Twenty-seven (27)" → "twenty seven, twenty seven"); el texto de pantalla y el `accessibilityLabel` **no** se tocan. `Speech.stop()` y luego `speak()` dentro del `.finally()` (esperar a que pare para que Android no descarte la lectura).
- **`officialData.json` es manual**: `lastUpdated` + AVISO en `flashcards.tsx:14`.
- **Sin `Intl`**: `MONTHS_ES` escrito a mano (`flashcards.tsx:65`) por irregularidad en Hermes; los cuadros de texto evitan `String.normalize` por el mismo motivo.
- **No hay TODO/FIXME/XXX/HACK** en `app/` ni `src/` (búsqueda case-sensitive: 0 resultados).
- **Sin claves ni secretos**: no existe `.env` real; solo `.env.example` (plantilla comentada).

## 8. Pendientes detectables leyendo el código

- **Placeholders**: `src/components/Card.tsx` y `src/components/Button.tsx` (5 líneas, `export {};`), `src/utils/fuzzyMatch.ts` (13 líneas, solo cabecera con firmas comentadas). **Nadie los importa.** `NOTES.md §7` dice explícitamente: no implementar hasta tener 3+ usos.
- **Scaffold muerto**: `App.tsx` (11 líneas, texto de plantilla) e `index.ts` (`registerRootComponent`) **no se usan** (el entry es `expo-router/entry`).
- **Dependencia muerta**: `expo-av` (0 referencias; prevista para Fase 6). `expo-constants`, `expo-linking`, `react-native-screens`, `@expo/metro-runtime`, `react-native-web` tampoco se importan, pero son plataforma/transitivas de expo-router.
- **Barra duplicada**: `flashcards.tsx` y `quiz.tsx`… (este último no tiene barra) → **pendiente real**: `flashcards.tsx` sigue dibujando su `progressTrack`/`progressFill` local; migrar a `ProgressBar` (tarea separada, ya pactada en `NOTES.md §7`).
- **Archivos grandes**: `flashcards.tsx` (853) y `quiz.tsx` (818) concentran pantalla + estilos; sin componentes extraídos.
- **`StudyMode`** (`'audio'|'voice'`) definido pero sin uso: futuras fases.
- **Rutas**: las 4 rutas de `_layout.tsx` tienen pantalla real; **no hay rutas sin implementar**.
- **Limpieza**: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` → **EXIT=0**, ningún import/variable sin usar.
- No hay CI, ni tests automáticos, ni linter, ni CHANGELOG, ni README.
- **No encontré**: `README.md`, carpeta `docs/`, remoto git, `.env` real, ni el archivo `NOTES.md` en la raíz del workspace (el real es **`ciudadania-app/NOTES.md`**, con minúscula inicial).

## 9. Self-checks existentes (`.expo/selftest/`, gitignoreados)

| Archivo | Qué verifica |
|---|---|
| `check.js` | `buildStudyQueue` sobre las 128 reales: `excludeMastered` vacío cuando todo está dominado, y barra 0% / 95% |
| `requeue-check.js` | Espejo del re-encolado de `flashcards.handleAnswer` (casos límite; todo fallado = 20+2×20 = 60) |
| `threshold-check.js` | Reparto de ramas del bloque de respuestas con `MULTIPLE_ANSWERS_THRESHOLD=1` (40 simples / 80 emparejadas / 8 dinámicas) |
| `answers-truncation-check.js` | Recorte con `MAX_VISIBLE_ANSWERS=5` y los mensajes contextuales |
| `phase-official-check.js` | Contador en dos fases + % solo Fase A + `officialData`/formato de fecha |
| `quiz-build-check.js` | 1000 exámenes: 4 opciones, 1 correcta = `answers_en[0]`, sin duplicados, 100% misma categoría, WARN de distractores válidos |
| `speech-sanitize-check.js` | `sanitizeForSpeech` sobre 917 cadenas (30 cambian, 887 intactas) |
| `progress-check.js` | Aritmética de `progress.tsx` (8 escenarios × 8 invariantes) |
| `out/` + `tsconfig.json` | Compilados de `src/types` y `src/utils/spacedRepetition` (los usan `check.js` y `progress-check.js`) |

## 10. Comandos útiles verificados

```bash
npx tsc --noEmit                                              # EXIT=0 (verificado hoy)
npx tsc --noEmit --noUnusedLocals --noUnusedParameters         # EXIT=0 → detector de código muerto
npx expo export --platform web --output-dir <tmp>              # EXIT=0 (bundle ~1.3 MB, verificado hoy)
npx expo start --web        # o: npm run web                  # dev en navegador
npm start | npm run android | npm run ios                      # dev en dispositivo
npm run merge               # node scripts/mergeQuestions.js → regenera questions.json desde en.json+es.json
                                                                            # (declarado; NO ejecutado en las últimas sesiones)
node -e "const f=require('./src/data/questions.json'); console.log(f.questions.length)"   # verificación de datos: 128
node -e "const q=require('./src/data/questions.json').questions;
  console.log('dinámicas:', q.filter(x=>x.answers_en.length===0).map(x=>x.id).join(','));
  console.log('stateSpecific:', q.filter(x=>x.stateSpecific).length)"                        # 8 dinámicas / 4 del estado
npx tsc -p .expo/selftest/tsconfig.json                        # compila utils para los self-checks
node .expo/selftest/<nombre>.js                                # check.js y progress-check.js requieren el paso anterior
```
No existen: `npm test`, `npm run lint`, `npm run build`.

---

**Contexto de fase (de `NOTES.md`, complementario):** Fases 1-4 completas; **Fase 5 en curso** (quiz ✓, progress ✓, **falta "Modo Revisión"**: volver a preguntas anteriores dentro de una sesión) → luego Fase 6 (entrevista con voz / AssemblyAI tras proxy Vercel), Fase 7 (disclaimers, Play Billing, publicación) y Fase 8. Regla vigente: **no tocar monetización hasta terminar la Fase 6**. Decisiones que no se leen del código y hay que preservar: 4 niveles en `progress.tsx`, `USE_SIBLING_ANSWERS_AS_DISTRACTORS = false`, y no implementar `Card`/`Button` todavía.