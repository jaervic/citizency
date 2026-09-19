// src/utils/confirm.ts
// Propósito: ofrecer un diálogo de confirmación (cancelar / confirmar) que funcione en TODAS las
// plataformas. React Native Web no implementa `Alert.alert` con botones: en web la llamada no hace
// nada visible, así que los botones "Salir"/"Reiniciar" de la app quedaban muertos al probar con
// `expo start --web`. Aquí se centraliza el arreglo: en web se usa el `window.confirm` del
// navegador (síncrono, bloqueante y con el mismo "Cancelar/Aceptar" nativo) y en Android/iOS se
// sigue usando `Alert.alert`, que allí sí funciona y permite estilo destructivo.
//
// Sin dependencias externas ni estado: es una función pura de plataforma + callback.
import { Alert, Platform } from 'react-native';

/**
 * Muestra un diálogo de confirmación multiplataforma y ejecuta `onConfirm` solo si el usuario
 * confirma.
 *
 * - Web: `window.confirm` con el título y el mensaje juntos (React Native Web no tiene
 *   `Alert.alert` con botones). El texto del botón de aceptar lo pone el navegador ("Aceptar") y no
 *   se puede personalizar; `confirmLabel` solo se usa en nativo.
 * - Nativo (Android/iOS): `Alert.alert` con un botón "Cancelar" (style `cancel`) y otro con
 *   `confirmLabel` (style `destructive`, porque las cuatro confirmaciones actuales cierran o
 *   borran algo: salir de un examen/sesión o reiniciar el progreso).
 *
 * @param title Título del diálogo (en web se antepone al mensaje, ya que `window.confirm` solo
 *   tiene un campo de texto).
 * @param message Texto explicativo de lo que va a pasar si se confirma.
 * @param confirmLabel Texto del botón de confirmar en nativo (p. ej. "Salir", "Reiniciar").
 * @param onConfirm Qué hacer si el usuario confirma (cancelar no ejecuta nada).
 */
export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
