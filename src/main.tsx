// src/main.tsx
// Propósito: punto de entrada. Monta la app en `#root` dentro de un `BrowserRouter` (las
// rutas limpias las sirve Vercel con la reescritura de `vercel.json`).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from '@/App';
import '@/styles/global.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('No se encontró el elemento #root en index.html.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
