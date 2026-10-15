// src/routes/NotFoundScreen.tsx
// Propósito: página 404. Vercel reescribe todas las rutas a index.html, así que las URLs
// desconocidas llegan aquí en vez de a un error del servidor.
import { Link } from 'react-router-dom';

export default function NotFoundScreen() {
  return (
    <div className="centered-screen">
      <h1 className="screen-title">Pantalla no encontrada</h1>
      <p className="screen-subtitle">La página que buscas no existe o se ha movido.</p>
      <div className="btn-row" style={{ width: '100%', maxWidth: 320 }}>
        <Link to="/" className="btn btn--primary">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
