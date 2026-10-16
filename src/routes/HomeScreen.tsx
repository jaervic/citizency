// src/routes/HomeScreen.tsx
// Propósito: pantalla de inicio. Resume el progreso (XP, racha, preguntas dominadas) y da
// acceso a las cuatro secciones: Estudiar (flashcards), Examen de práctica, Entrevista y
// Progreso. También permite reiniciar todo el progreso.
import { Link } from 'react-router-dom';

import { useConfirm } from '@/components/ConfirmDialog';
import Icon from '@/components/Icon';
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

  const stateEntry = getStateEntry(homeState);

  const mastered = QUESTIONS.filter(
    (question) => getMasteryLevel({ xp, streak, lastStudyDate, answeredQuestions }, question.id) === 'mastered',
  ).length;

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
      <div className="home-stats">
        <div className="home-stat">
          {xp}
          <div className="progress-breakdown__label">XP</div>
        </div>
        <div className="home-stat">
          {streak}
          <div className="progress-breakdown__label">{streak === 1 ? 'día seguido' : 'días seguidos'}</div>
        </div>
        <div className="home-stat">
          {mastered}
          <div className="progress-breakdown__label">dominadas</div>
        </div>
      </div>

      <nav className="home-menu" aria-label="Secciones">
        <Link to="/state" className="home-card home-card--location">
          <span className="home-card__title">
            <Icon name="pin" className="home-card__icon" />
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
              <Icon name={item.icon} className="home-card__icon" />
              {item.title}
            </span>
            <span className="home-card__subtitle">{item.subtitle}</span>
          </Link>
        ))}
      </nav>

      <button type="button" className="home-reset" onClick={handleReset}>
        Reiniciar progreso
      </button>

      <Link to="/settings" className="home-settings-link">
        <Icon name="settings" />
        Ajustes
      </Link>

      <p className="home-disclaimer">
        App de estudio independiente basada en las 128 preguntas oficiales del examen de
        naturalización de USCIS (versión 2025). No está afiliada a USCIS. Verifica siempre la
        información con las fuentes oficiales.
      </p>
    </div>
  );
}
