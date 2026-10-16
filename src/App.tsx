// src/App.tsx
// Propósito: definir las rutas de la SPA. `Layout` aporta la cabecera y el `<Outlet />`;
// `ConfirmProvider` habilita el diálogo de confirmación en toda la app.
import { Route, Routes } from 'react-router-dom';

import { ConfirmProvider } from '@/components/ConfirmDialog';
import Layout from '@/components/Layout';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import FlashcardsScreen from '@/routes/FlashcardsScreen';
import HomeScreen from '@/routes/HomeScreen';
import InstallScreen from '@/routes/InstallScreen';
import InterviewScreen from '@/routes/InterviewScreen';
import NotFoundScreen from '@/routes/NotFoundScreen';
import ProgressScreen from '@/routes/ProgressScreen';
import QuizScreen from '@/routes/QuizScreen';
import SettingsScreen from '@/routes/SettingsScreen';
import StateScreen from '@/routes/StateScreen';

export default function App() {
  // Mantiene aplicado el tema (claro/oscuro) elegido en Ajustes.
  useThemeEffect();

  return (
    <ConfirmProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomeScreen />} />
          <Route path="flashcards" element={<FlashcardsScreen />} />
          <Route path="quiz" element={<QuizScreen />} />
          <Route path="interview" element={<InterviewScreen />} />
          <Route path="progress" element={<ProgressScreen />} />
          <Route path="state" element={<StateScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          <Route path="install" element={<InstallScreen />} />
          <Route path="*" element={<NotFoundScreen />} />
        </Route>
      </Routes>
    </ConfirmProvider>
  );
}
