// src/components/Layout.tsx
// Propósito: armazón común de todas las pantallas: cabecera fija (con botón "volver" fuera del
// inicio) y el contenido de la ruta. La cabecera se queda pegada arriba y respeta el "notch"
// del teléfono (safe-area-inset-top).
import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import Icon from '@/components/Icon';
import Footer from '@/components/Footer';

/** Título de la cabecera según la ruta. */
const TITLES: Record<string, string> = {
  '/': 'USCIS Ciudadanía',
  '/flashcards': 'Estudiar',
  '/quiz': 'Examen de práctica',
  '/interview': 'Entrevista',
  '/progress': 'Progreso',
  '/state': 'Mi estado',
  '/settings': 'Ajustes',
  '/install': 'Instalar la app',
};

export default function Layout() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const title = TITLES[pathname] ?? 'USCIS Ciudadanía';

  // Al cambiar de pantalla se vuelve arriba: en móvil el scroll se conservaba y la pantalla
  // nueva aparecía a mitad de camino.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          {isHome ? (
            <span className="app-header__title app-header__title--start">{title}</span>
          ) : (
            <>
              <Link className="app-header__back" to="/" aria-label="Volver al inicio">
                <Icon name="back" />
              </Link>
              <span className="app-header__title">{title}</span>
              <span className="app-header__spacer" aria-hidden="true" />
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
