# NOTES.md — Decisiones de producto, monetización y legal

Este archivo NO es código. Es la fuente de verdad para decisiones que no deben perderse entre sesiones de chat. Cada vez que tomemos una decisión importante de producto, monetización o legal, se documenta acá.

Última actualización: 2026-09-18

---

## 1. Modelo de monetización

**Modelo elegido**: Freemium con **pago único** (NO suscripción).

**Justificación**:
- Público objetivo: inmigrantes hispanohablantes con presupuesto ajustado.
- La suscripción mensual genera rechazo psicológico en este segmento.
- El pago único "para prepararte hasta tu examen" encaja mejor: el usuario sabe cuándo termina su necesidad.
- Google Play cobra 15% (no 30%) si estamos en el programa de pequeñas empresas (<$1M USD/año).

**Precio tentativo**: $4.99 – $7.99 USD (definir en Fase 7 según pruebas con usuarios).

### Qué queda GRATIS

- Flashcards completas (128 preguntas, inglés + español).
- Quiz sin cronómetro (20 preguntas aleatorias, corrección automática).
- Progreso básico (racha, XP, categorías).
- Botón 🔊 con expo-speech en todo el contenido.
- Datos oficiales actualizados (presidente, VP, speaker, chief justice).

### Qué queda PREMIUM (pago único)

- Simulacro de entrevista con voz (Fase 6).
- Modo "examen cronometrado" con límite de tiempo real.
- Estadísticas avanzadas por categoría.
- (Evaluar en su momento) Guía de audio descargable / offline.

### Qué NO vamos a hacer (por ahora)

- **Suscripciones mensuales**: rechazado por UX y por el segmento.
- **In-App Purchases fragmentados** ("Guía intensiva de entrevista", "Pack de N-400", etc.): complica UX, backend y lógica de validación. Un solo desbloqueo premium es suficiente.
- **Supabase en v1**: no se necesita. Todo el estado vive local (Zustand + AsyncStorage). Supabase recién tiene sentido si sincronizamos progreso entre dispositivos (Fase 8+).
- **Analytics invasivos**: cero. Si en algún momento se necesitan métricas, usar Plausible o Umami (privacy-first).

---

## 2. Estrategia de publicación

**Orden**:
1. Publicar en Google Play **gratis, sin paywall**, por 2–4 semanas.
2. Objetivo: juntar reseñas positivas y datos de uso reales.
3. Después: activar el paywall premium con Play Billing.

**Por qué**: lanzar con paywall sin base de reseñas mata el algoritmo de Play Store. Mejor entrar gratis, posicionar, y después monetizar a los que ya confían.

**Herramienta de billing**: Google Play Billing directo. Evaluar RevenueCat si la lógica se complica (tiene tier gratis hasta $2.5K USD/mes de ingresos).

---

## 3. Privacidad y datos

**Principio rector**: minimizar recolección de datos personales sensibles.

- Todo el progreso vive local en el dispositivo (AsyncStorage).
- No hay login, no hay cuenta de usuario, no hay email obligatorio.
- No hay analytics de terceros en v1.
- Fase 6 (AssemblyAI para voz): la API key va detrás de un proxy en Vercel. El audio del usuario NO se almacena en servidores nuestros.
- Si en el futuro se agrega Supabase: solo progreso anónimo, nunca datos personales ni audio.

**Documentar en política de privacidad** (Fase 7):
- Qué datos se guardan (progreso local, nada más).
- Qué NO se guarda (audio, ubicación, contactos, etc.).
- Cómo eliminar los datos (desinstalar la app).

---

## 4. Legal y disclaimers

### Texto del disclaimer (para Home / pantalla "Acerca de")

> **Aviso importante**
>
> Esta aplicación es una **herramienta de estudio independiente** para ayudar a prepararte para el examen de ciudadanía de los Estados Unidos. **No constituye asesoría legal** de ningún tipo ni sustituye la consulta con un abogado de inmigración.
>
> El contenido se basa en materiales públicos del USCIS y se actualiza periódicamente, pero **no garantizamos la aprobación del examen** ni la exactitud absoluta de la información oficial. Verifica siempre con fuentes oficiales del USCIS antes de tomar decisiones legales.
>
> Esta app no está afiliada, patrocinada ni respaldada por el USCIS ni por ninguna agencia del gobierno de los Estados Unidos.

### Texto para la ficha de Google Play

> Aplicación de estudio independiente para el examen de ciudadanía USCIS. No está afiliada al USCIS ni constituye asesoría legal.

### Dónde debe aparecer

- [ ] Pantalla "Acerca de" o modal en Home (Fase 7).
- [ ] Ficha de Google Play (Fase 7).
- [ ] Pantalla inicial antes del primer uso (opcional, evaluar).

---

## 5. Contenido y actualización

- El contenido se basa en el temario oficial del USCIS versión 2025 (128 preguntas).
- `src/data/officialData.json` guarda los datos que cambian con el tiempo (presidente, VP, speaker, chief justice) con fecha de actualización visible.
- **Revisión periódica**: cada cambio de administración o de figuras clave, actualizar `officialData.json`. Al menos 1 vez al año.
- Las 4 preguntas que dependen del estado del usuario (senadores, representante, gobernador, capital) mantienen aviso genérico porque no podemos conocer el estado sin pedir ubicación.

---

## 6. Roadmap y fases

- [x] Fase 1–4: contenido, algoritmo, flashcards, datos oficiales.
- [x] **Fase 5** (cerrada el 2026-09-18): quiz.tsx → progress.tsx → modo revisión
      (`src/components/SessionReview.tsx`, compartido por flashcards y quiz).
- [ ] Fase 6: entrevista con voz (grabación + AssemblyAI vía proxy Vercel + comparación difusa + feedback de pronunciación).
- [ ] Fase 7: disclaimers, Play Billing, EAS Build, publicación gratis, luego paywall.
- [ ] Fase 8: examen de lectura/escritura, práctica N-400, evaluación de Supabase, estructura 501(c)(3).

**Regla**: no tocar monetización hasta terminar Fase 6. El paywall se define después de tener el producto premium construido.

---

## 7. Decisiones pendientes (para revisar en su momento)

- [ ] Precio final del desbloqueo premium.
- [ ] ¿El simulacro de entrevista tiene límite de intentos en la versión gratis? (tentativo: 1 intento gratis, ilimitado en premium).
- [ ] ¿Agregar modo oscuro? (bajo esfuerzo, alto impacto en reviews).
- [ ] ¿Idioma inglés para la UI además de español? (para usuarios que quieren practicar inmersión).
- [ ] Política de reembolsos (Play Store la maneja, pero documentar el flujo).
- [x] Racha (2026-09-18): `computeNextStreak` extraída a `src/utils/streak.ts`
      (lógica pura). El store la consume desde `recordAnswer`: cualquier
      respuesta registrada actualiza la racha, en cualquier pantalla.
      Reset automático si hay gap > 1 día. `incrementStreak` eliminada del
      API del store; no quedan llamadas explícitas desde pantallas.

- [ ] Banco de distractores curados (`src/data/quizDistractors.json`): eliminaría el
      riesgo residual de que una respuesta válida de OTRA pregunta aparezca como distractor.
      Costo: ~360 entradas manuales. Evaluar en Fase 7 según feedback real de usuarios.

- [ ] Pantalla "Mi estado" (Grupo B de las 8 dinámicas): permitir al usuario elegir
      su estado de residencia para resolver senadores, representante, gobernador y capital.
      Preguntas afectadas: gov-023, gov-029, gov-061, gov-062. Fase 5 o 6.
      - [ ] Refactor post-Fase 5: migrar flashcards.tsx y quiz.tsx a `ProgressBar`
      reutilizable. Ya se hizo en progress.tsx el 2026-09-18. Mismo patrón:
      import + `<ProgressBar progress={...} />` + borrar `progressTrack`/`progressFill`.

- [ ] Implementar `Card.tsx` y `Button.tsx`. Siguen como placeholders vacíos
      (`export {};`). NO implementar hasta tener 3+ usos reales que justifiquen
      la abstracción. Ahora sería optimización prematura.

- [x] ~~Modo Revisión (volver a preguntas anteriores en la sesión). Última pieza
      de Fase 5 antes de Fase 6.~~ Ya implementado el 2026-09-18 en
      `src/components/SessionReview.tsx`, integrado en flashcards.tsx y quiz.tsx.
- [x] Deduplicar re-encoladas en la revisión de flashcards: implementado el 2026-09-18.
      Se conserva la ÚLTIMA aparición por `question.id` (posición y resultado). La
      deduplicación vive en flashcards.tsx con `useMemo`; SessionReview se mantiene
      presentacional.
- [x] Contador del quiz en fase review cambió de "X de N" a "N falladas de 20" por
      consistencia con la vista unificada (decisión del 2026-09-18).
- [ ] Eliminar scaffold muerto: `App.tsx` e `index.ts` (entry es
      `expo-router/entry`, no se usan). Borrar en Fase 7 antes de publicar
      para no confundir a futuros chats.
- [x] Unificar paleta (2026-09-18): creado `src/theme.ts` con la paleta única
      (azul principal `#1a3a6b`). Migrados `_layout.tsx` e `index.tsx`. El resto
      de las pantallas (`flashcards.tsx`, `quiz.tsx`, `progress.tsx`,
      `SpeakerButton.tsx`, `ProgressBar.tsx`, `SessionReview.tsx`) tienen
      colores hardcoded equivalentes; se migrarán a `colors.*` cuando se toquen
      por otro motivo, no como tarea aparte.
      
---

## 8. Referencias

- Repositorios y proyectos similares en GitHub: sirven como referencia de UX, no para copiar código.
- Consejos recibidos sobre arquitectura privacy-first, módulo de audio y ética: en su mayoría ya están implementados o agendados. Lo único nuevo que aportaron fue la insistencia en **disclaimers legales visibles** y **contenido actualizado según USCIS**, ambos ya cubiertos.

## 9. Recordatorios de contexto

- **AssemblyAI (Fase 6)**: la API key NUNCA va en el bundle. Proxy obligatorio en
  Vercel Edge Function. Usar `eas secret:create`, no `EXPO_PUBLIC_`.
- **Branding (Fase 7)**: nombre definitivo, ícono, splash, colores de marca y
  tipografía aún sin decidir. No urgente.
- **Subvenciones USCIS (Fase 8+)**: considerar estructura 501(c)(3) cuando haya
  tracción real. Programa CINAS: hasta $300K por organización en 2 años.
  Es recordatorio personal, no tarea.
- **Tests en `.expo/selftest/`**: `requeue-check.js`, `answers-truncation-check.js`,
  `phase-official-check.js`, `quiz-build-check.js`. Gitignoreados pero útiles.

## 10. Traspaso entre chats (protocolo)

Cada vez que se migra a un chat nuevo, el traspaso debe incluir:
1. `NOTES.md` completo (este archivo).
2. Resumen de la última sesión: qué se cerró, qué quedó pendiente.
3. Estado actual de Fase (qué fases están completas, en qué punto va la actual).
4. Pendientes inmediatos (1-3 tareas concretas).

Decisiones que NO deben perderse (porque no se leen del código):
- Los 4 niveles en progress.tsx (new/learning/reviewing/mastered) son
  intencionales. NO simplificar a 3.
- `USE_SIBLING_ANSWERS_AS_DISTRACTORS = false` en quiz.tsx es decisión
  pedagógica, no bug. No cambiar a `true`.
- El criterio de aceptar/rechazar propuestas de Cline: aceptar lo que
  prepare para algo que ya sabemos que necesitaremos; rechazar lo que
  complique sin beneficio claro.
- Los self-checks en `.expo/selftest/` están gitignoreados. Si se pierden,
  se rehacen pidiéndole a Cline que reconstruya los escenarios.