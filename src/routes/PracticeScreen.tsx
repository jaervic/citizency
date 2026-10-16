// src/routes/PracticeScreen.tsx
// Propósito: reunir en un sitio las formas de practicar distintas del repaso normal. Cada una
// aprovecha filtros que el motor de estudio ya tenía y la interfaz no usaba:
//
//   - Las 20 preguntas del 65/20: la exención para mayores de 65 con 20+ años de residencia.
//   - Solo las falladas: repaso de lo que se ha fallado alguna vez.
//   - Por categoría: las 7 categorías del examen, una a una.
//   - Escribir las respuestas: sin micrófono, corrigiendo con el comparador difuso.
//   - Simulacro real: 10 preguntas y se aprueba con 6, como en la entrevista de verdad.
import { Link } from 'react-router-dom';

import CategoryBadge from '@/components/CategoryBadge';
import Icon from '@/components/Icon';
import { CATEGORY_ORDER } from '@/utils/categories';
import { QUESTIONS } from '@/utils/content';

const MODOS = [
  {
    to: '/flashcards?only65=1',
    icon: 'quiz' as const,
    title: 'Las 20 del 65/20',
    subtitle: 'Para mayores de 65 años con 20 o más de residencia.',
  },
  {
    to: '/flashcards?onlyFailed=1',
    icon: 'cross' as const,
    title: 'Solo las que he fallado',
    subtitle: 'Repasa únicamente las que se te resisten.',
  },
  {
    to: '/interview?modo=escribir&size=10',
    icon: 'book' as const,
    title: 'Escribir las respuestas',
    subtitle: 'Practica sin micrófono: escribe y se corrige sola.',
  },
  {
    to: '/quiz?count=10&feedback=final',
    icon: 'check' as const,
    title: 'Simulacro real',
    subtitle: '10 preguntas, se aprueba con 6, sin saber el resultado hasta el final.',
  },
];

export default function PracticeScreen() {
  const total65_20 = QUESTIONS.filter((question) => question.is_65_20).length;

  return (
    <div className="page">
      <p className="screen-subtitle">
        Formas de practicar que se centran en lo que necesitas. Todas usan las mismas 128 preguntas
        oficiales.
      </p>

      <nav className="home-menu" aria-label="Formas de practicar">
        {MODOS.map((modo) => (
          <Link key={modo.to} to={modo.to} className="home-card">
            <span className="home-card__title">
              <span className="home-card__chip">
                <Icon name={modo.icon} />
              </span>
              {modo.title}
            </span>
            <span className="home-card__subtitle">{modo.subtitle}</span>
          </Link>
        ))}

        <section className="card settings-section">
          <h2 className="settings-title">Practicar por categoría</h2>
          <p className="settings-hint">
            Elige un tema y estudia solo esas preguntas. Se repiten menos las que ya dominas.
          </p>

          <ul className="practice-categories">
            {CATEGORY_ORDER.map((categoria) => {
              const cuantas = QUESTIONS.filter((question) => question.category === categoria).length;

              return (
                <li key={categoria}>
                  <Link
                    className="practice-category"
                    to={`/flashcards?category=${encodeURIComponent(categoria)}`}
                  >
                    <CategoryBadge category={categoria} />
                    <span className="practice-category__count">{cuantas}</span>
                    <Icon name="chevron" className="practice-category__arrow" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </nav>

      <p className="settings-hint">
        Las preguntas del 65/20 son {total65_20} y se pueden estudiar en una sesión corta. Si tu
        exención aplica, en el examen solo te preguntarán por esas.
      </p>

      <Link to="/" className="btn btn--secondary">
        Volver al inicio
      </Link>
    </div>
  );
}
