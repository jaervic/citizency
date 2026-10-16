// src/routes/HomeScreen.tsx
// Propósito: pantalla de inicio. Resume el progreso (XP, racha, preguntas dominadas) y da
// acceso a las cuatro secciones: Estudiar (flashcards), Examen de práctica, Entrevista y
// Progreso. También permite reiniciar todo el progreso.
import { Link } from 'react-router-dom';

import { useConfirm } from '@/components/ConfirmDialog';
import Icon from '@/components/Icon';
import ProgressRing from '@/components/ProgressRing';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { QUESTIONS } from '@/utils/content';
import { getStateEntry } from '@/utils/stateOfficials';
import { useStore } from '@/store/useStore';
import { getMasteryLevel } from '@/utils/spacedRepetition';
import type { IconName } from '@/components/Icon';

const MENU: Array<{ to: string; icon: IconName; title: string; subtitle: string }> = [
  { to: '/flashcards', icon: 'book', title: 'Estudiar', subtitle: 'Repasa las 128 preguntas con tarjetas.' },
  { to: '/quiz', icon: 'quiz', title: 'Examen de práctica', subtitle: '20 preguntas tipo test como en el examen real.' },
  { to: '/interview', icon: 'mic', title: 'Entrevista', subtitle: 'Practica respondiendo en voz alta.' },
  { to: '/progress', icon: 'chart', title: 'Progreso', subtitle: 'Mira cuánto dominas por categoría.' },
];

export default function HomeScreen() {
  const xp = useStore((state) => state.xp);
  const streak = useStore((state) => state.streak);
  const lastStudyDate = useStore((state) => state.lastStudyDate);
  const answeredQuestions = useStore((state) => state.answeredQuestions);
  const reset = useStore((state) => state.reset);
  const homeState = useStore((state) => state.homeState);
  const confirm = useConfirm();
  const install = useInstallPrompt();

  const stateEntry = getStateEntry(homeState);

  const mastered = QUESTIONS.filter(
    (question) => getMasteryLevel({ xp, streak, lastStudyDate, answeredQuestions }, question.id) === 'mastered',
  ).length;

  const masteredRatio = QUESTIONS.length > 0 ? mastered / QUESTIONS.length : 0;

  const handleReset = async () => {
    const accepted = await confirm({
      title: 'Reiniciar progreso',
      message: 'Se borrarán tu XP, tu racha y el historial de todas las preguntas. Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, reiniciar',
      cancelLabel: 'Cancelar',
    });

    if (accepted) {
      reset();
    }
  };

  return (
    <div className="page">
      <section className="hero">
        <div className="hero__info">
          <p className="hero__eyebrow">Tu racha</p>
          <p className="hero__streak">
            {streak} <span>{streak === 1 ? 'día' : 'días'}</span>
          </p>
          <p className="hero__sub">
            {xp} XP · {mastered} de {QUESTIONS.length} dominadas
          </p>
        </div>

        <ProgressRing value={masteredRatio} size={84} stroke={9} label="Preguntas dominadas">
          <span className="ring__value">{Math.round(masteredRatio * 100)}%</span>
        </ProgressRing>
      </section>

      <Link to="/flashcards" className="btn btn--primary">
        Seguir estudiando
      </Link>

      <nav className="home-menu" aria-label="Secciones">
        <Link to="/state" className="home-card home-card--location">
          <span className="home-card__title">
            <span className="home-card__chip">
              <Icon name="pin" />
            </span>
            {stateEntry === null ? 'Configurar mi estado' : `Mi estado: ${stateEntry.nameEs}`}
          </span>
          <span className="home-card__subtitle">
            {stateEntry === null
              ? 'Elige tu estado para 4 preguntas que dependen de dónde vives.'
              : 'Senadores, representante, gobernador y capital al día.'}
          </span>
        </Link>

        {MENU.map((item) => (
          <Link key={item.to} to={item.to} className="home-card">
            <span className="home-card__title">
              <span className="home-card__chip">
                <Icon name={item.icon} />
              </span>
              {item.title}
            </span>
            <span className="home-card__subtitle">{item.subtitle}</span>
          </Link>
        ))}

        {!install.installed && (
          <Link to="/install" className="home-card">
            <span className="home-card__title">
              <span className="home-card__chip">
                <Icon name="download" />
              </span>
              Instalar la app
            </span>
            <span className="home-card__subtitle">
              Añádela a la pantalla de inicio y úsala sin conexión.
            </span>
          </Link>
        )}
      </nav>

      <button type="button" className="home-reset" onClick={handleReset}>
        Reiniciar progreso
      </button>

      <Link to="/settings" className="home-settings-link">
        <Icon name="settings" />
        Ajustes
      </Link>
    </div>
  );
}
