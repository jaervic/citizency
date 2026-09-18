// src/theme.ts
// Propósito: fuente única de verdad de los colores de la aplicación. Solo paleta:
// nada de tipografía, espaciado ni radios. Las pantallas migradas importan `colors`
// en lugar de escribir hex sueltos, para que no vuelvan a convivir dos azules
// distintos (era el caso del header del Stack y las cards de Home).

/**
 * Paleta única de la app, con el azul principal `#1a3a6b` que ya domina en
 * flashcards, quiz, progress, SpeakerButton, ProgressBar y SessionReview.
 *
 * Es la FUENTE ÚNICA DE VERDAD de colores: cualquier color hardcoded en una pantalla
 * es deuda a migrar cuando se toque ese archivo. Las pantallas que ya se migraron
 * (hoy `app/_layout.tsx` y `app/index.tsx`) deben usar solo estas claves.
 *
 * `pressed` comparte valor con `background` a propósito: es el mismo color con otra
 * semántica (estado presionado de una tarjeta/botón), no un duplicado a limpiar.
 */
export const colors = {
  primary: '#1a3a6b', // azul principal (botones, header, links, acentos)
  onPrimary: '#ffffff', // texto sobre primary
  background: '#f0f4f9', // fondo de pantalla
  surface: '#ffffff', // tarjetas
  border: '#dbe3ee', // bordes de tarjeta
  pressed: '#f0f4f9', // fondo de un elemento presionado (tap/hover)
  textPrimary: '#1f1f1f', // texto principal
  textSecondary: '#666666', // texto secundario
  textMuted: '#888888', // texto menos importante
  success: '#2e7d32', // ✓ / acierto
  error: '#c62828', // ✗ / fallo
  warning: '#7a5c00', // avisos (preguntas dinámicas)
} as const;
