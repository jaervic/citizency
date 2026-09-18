# Traspaso — Fin de Fase 5

## Estado del proyecto
App móvil para examen de ciudadanía USCIS (versión 2025, 128 preguntas).
Stack: React Native + Expo SDK 57 + Expo Router + TypeScript + Zustand.
Repo: https://github.com/jaervic/ciudadania-app
Carpeta local: c:\Proyectos\citizency\ciudadania-app
Pruebas: `npx expo start --web` (sin dispositivo físico ni emulador).

## Fases
- [x] Fase 1-4: contenido, algoritmo spaced repetition, flashcards, datos oficiales.
- [x] Fase 5 (cerrada el 2026-09-18): quiz.tsx, progress.tsx, ProgressBar
      reutilizable y `SessionReview` (modo revisión en flashcards y quiz, con
      dedup de re-encoladas en la revisión de flashcards).
- [ ] **Fase 6 (en curso)**: simulación de entrevista con voz (grabación +
      AssemblyAI vía proxy en Vercel + comparación difusa + feedback de
      pronunciación).
- [ ] Fase 7: disclaimers legales, Play Billing, EAS Build, publicación.
- [ ] Fase 8: examen lectura/escritura, práctica N-400, evaluación Supabase.

## Qué se cerró en la sesión anterior (2026-09-18)
- `app/quiz.tsx` completo: 818 líneas, 20 preguntas aleatorias, multiple
  choice con 4 opciones, corrección automática, resultados con umbral 12/20,
  modo revisión de falladas. Correcta = `answers_en[0]` siempre.
  `USE_SIBLING_ANSWERS_AS_DISTRACTORS = false`.
- `sanitizeForSpeech()` en `SpeakerButton.tsx`: elimina paréntesis y su
  contenido antes del TTS. "Twenty-seven (27)" → "twenty seven".
- `app/progress.tsx`: 317 líneas, panel por categoría con resumen general,
  desglose de 4 niveles (new/learning/reviewing/mastered) y barras.
- `src/components/ProgressBar.tsx`: 26 líneas, reutilizable, `progress` (0-1)
  + `height` opcional. Usado en progress.tsx.
- `NOTES.md`: documento de decisiones de producto, monetización, legal,
  roadmap y protocolo de traspaso.
- Primer commit + push a GitHub.

## Pendientes inmediatos (próximo chat)
1. **Fase 6 — entrevista con voz**: grabar con `expo-av` (ya en `package.json`
   con 0 referencias), transcribir con AssemblyAI vía **proxy en Vercel Edge
   Function** (la API key NUNCA va en el bundle: `eas secret:create`, no
   `EXPO_PUBLIC_`) y mostrar feedback de pronunciación. El audio del usuario NO
   se almacena en servidores propios.
2. Implementar `src/utils/fuzzyMatch.ts` (hoy placeholder de 13 líneas):
   normalización de la respuesta hablada + similitud tolerante a errores y
   contracciones, antes de montar la pantalla de entrevista.
3. Mantener verdes `npx tsc --noEmit`, `npx tsc --noEmit --noUnusedLocals
   --noUnusedParameters` y `npx expo export --platform web`; tocar los
   self-checks de `.expo/selftest/` solo si se modifica lógica existente.

Regla vigente: no tocar monetización (Play Billing / paywall) hasta terminar
Fase 6.

## Decisiones que NO deben perderse
- 4 niveles en progress.tsx son intencionales, no simplificar a 3.
- `USE_SIBLING_ANSWERS_AS_DISTRACTORS = false` es decisión pedagógica, no bug.
- Criterio de aceptar/rechazar propuestas de Cline: aceptar lo que prepare
  para algo que ya sabemos que necesitaremos; rechazar lo que complique sin
  beneficio claro.
- Sin librerías externas: solo React Native core, expo-router, Zustand,
  expo-speech, expo-av.
- Español neutro para UI, inglés para contenido del examen.
- Colores: #1a3a6b (azul oscuro), #f0f4f9 (fondo), #666/#888 secundario,
  #2e7d32 verde, #c62828 rojo.

## Convención de trabajo con Cline
- Cada tarea = un prompt claro y específico.
- Siempre pedir "muéstrame el diff antes de guardar".
- `npx tsc --noEmit` después de cada cambio (0 errores siempre).
- `npx expo export --platform web` cuando se toca UI.
- Commit + push después de cada bloque funcional.