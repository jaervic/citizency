// src/components/Footer.tsx
// Propósito: pie de página visible en TODAS las pantallas. Reúne tres cosas que antes estaban
// repartidas o no existían:
//   1. El crédito del autor, enlazando a su perfil de GitHub.
//   2. El enlace de donación (Ko-fi). Es un enlace saliente normal, no un widget incrustado: la app
//      no carga nada de terceros hasta que la persona hace clic.
//   3. El aviso legal, que antes solo aparecía en la pantalla de inicio.
//
// No es una barra fija: va al final del contenido, para no robarle alto a la pantalla en el móvil
// ni pelearse con el teclado.
import Icon from '@/components/Icon';
import { AUTHOR, DONATION_LABEL, DONATION_URL, LEGAL_NOTICE } from '@/config/support';
import { OFFICIAL_DATA } from '@/utils/content';
import { STATE_OFFICIALS_LAST_UPDATED } from '@/utils/stateOfficials';

/** Fecha ISO (YYYY-MM-DD) en formato dd/mm/aaaa. */
function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');

  return year !== undefined && month !== undefined && day !== undefined
    ? `${day}/${month}/${year}`
    : isoDate;
}

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <a
          className="app-footer__link"
          href={AUTHOR.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`GitHub de ${AUTHOR.name} (se abre en otra pestaña)`}
        >
          <Icon name="github" />
          Hecho por {AUTHOR.name}
        </a>

        <a
          className="app-footer__donate"
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${DONATION_LABEL} en Ko-fi (se abre en otra pestaña)`}
        >
          <Icon name="coffee" />
          {DONATION_LABEL}
        </a>

        <p className="app-footer__legal">{LEGAL_NOTICE}</p>

        <p className="app-footer__meta">
          Datos oficiales verificados el {formatDate(OFFICIAL_DATA.lastUpdated)} · cargos estatales
          el {formatDate(STATE_OFFICIALS_LAST_UPDATED)}
        </p>
      </div>
    </footer>
  );
}
