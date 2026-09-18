// app/_layout.tsx
// Propósito: layout raíz de Expo Router. Define el navegador de nivel superior
// (Stack) que envuelve a todas las rutas de la carpeta app/ y centraliza la
// configuración del header. Expo Router lo carga antes de renderizar cualquier ruta.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'USCIS Ciudadanía' }} />
        <Stack.Screen name="flashcards" options={{ title: 'Estudiar' }} />
        <Stack.Screen name="quiz" options={{ title: 'Examen de práctica' }} />
        <Stack.Screen name="interview" options={{ title: 'Entrevista' }} />
        <Stack.Screen name="progress" options={{ title: 'Progreso' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
