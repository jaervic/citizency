// src/routes/ProgressScreen.tsx
// Propósito: mostrar el progreso por categoría con los 4 niveles de dominio (nueva, en
// estudio, en repaso, dominada). Es una decisión de producto: el desglose se mantiene en 4
// niveles aunque la barra resuma con «dominadas / total».
import { Link } from 'react-router-dom';

import ProgressRing from '@/components/ProgressRing';
import { useStore } from '@/store/useStore';
import { CATEGORY_STYLE } from '@/utils/categories';
import { QUESTIONS } from '@/utils/content';
import { getMasteryLevel } from '@/utils/spacedRepetition';
import type { MasteryLevel } from '@/utils/spacedRepetition';
import type { Category, Question, UserProgress } from '@/types';

type LevelCounts = Record<MasteryLevel, number>;

const LEVEL_LABELS: Record<MasteryLevel, string> = {
  new: 'Nuevas',
  learning: 'En estudio',
  reviewing: 'En repaso',
  mastered: 'Dominadas',
};

/** Etiqueta corta de cada nivel para el desglose (se usa en la leyenda y el valor). */
const LEVEL_SHORT: Record<MasteryLevel, string> = {
  new: 'Nuevas',
  learning: 'Estudio',
  reviewing: 'Repaso',
  mastered: 'Dominadas',
};

function emptyCounts(): LevelCounts {
  return { new: 0, learning: 0, reviewing: 0, mastered: 0 };
}

function countLevels(questions: Question[], progress: UserProgress): LevelCounts {
  const counts = emptyCounts();

  for (const question of questions) {
    counts[getMasteryLevel(progress, question.id)] += 1;
  }

  return counts;
}

export default function ProgressScreen() {
  const xp = useStore((state) => state.xp);
  const streak = useStore((state) => state.streak);
  const lastStudyDate = useStore((state) => state.lastStudyDate);
  const answeredQuestions = useStore((state) => state.answeredQuestions);

  // El objeto se construye aquí, y no con un selector que devuelva un objeto nuevo: Zustand v5
  // compara con `Object.is` y ese selector provocaría un bucle de render en el navegador.
  const progress: UserProgress = { xp, streak, lastStudyDate, answeredQuestions };
  const totals = countLevels(QUESTIONS, progress);  const masteredPercentage = QUESTIONS.length > 0 ? totals.mastered / QUESTIONS.length : 0;

  // Categorías en el orden en que aparecen en el examen, sin repetir.
  const categories: Category[] = [];
  for (const question of QUESTIONS) {
    if (!categories.includes(question.category)) {
      categories.push(question.category);
    }
  }

  return (
    <div className="page">
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="progress-card__title">Tu progreso</h2>

        <div className="progress-header">
          <ProgressRing value={masteredPercentage} size={92} stroke={10} label="Preguntas dominadas">
            <span className="ring__value">{Math.round(masteredPercentage * 100)}%</span>
          </ProgressRing>

          <div className="progress-category__info">
            <span className="progress-stat">
              {totals.mastered} de {QUESTIONS.length} dominadas
            </span>
            <span className="progress-stat">
              {xp} XP · {streak} {streak === 1 ? 'día' : 'días'} de racha
            </span>
          </div>
        </div>

        <div className="progress-breakdown">
          {(Object.keys(LEVEL_LABELS) as MasteryLevel[]).map((level) => (
            <div key={level} className="progress-breakdown__item">
              <span className={`progress-breakdown__value level--${level}`}>{totals[level]}</span>
              <span className="progress-breakdown__label">{LEVEL_LABELS[level]}</span>
            </div>
          ))}
        </div>
      </section>

      {categories.map((category) => {
        const categoryQuestions = QUESTIONS.filter((question) => question.category === category);
        const counts = countLevels(categoryQuestions, progress);
        const total = categoryQuestions.length;
        const ratio = total > 0 ? counts.mastered / total : 0;
        const notStarted = counts.new === total;
        const style = CATEGORY_STYLE[category];

        return (
          <section key={category} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="progress-category__heading">
              <ProgressRing
                value={ratio}
                size={62}
                stroke={7}
                color={style.color}
                label={`Dominio de ${category}`}
              >
                <span className="ring__value" style={{ color: style.color }}>
                  {Math.round(ratio * 100)}%
                </span>
              </ProgressRing>

              <div className="progress-category__info">
                <span className="progress-category__name">{category}</span>
                <span className="progress-category__total">
                  {notStarted ? 'Todavía no has empezado' : `${total} preguntas · ${counts.mastered} dominadas`}
                </span>
              </div>
            </div>

            <div className="progress-breakdown">
              {(Object.keys(LEVEL_LABELS) as MasteryLevel[]).map((level) => (
                <div key={level} className="progress-breakdown__item">
                  <span className={`progress-breakdown__value level--${level}`}>{counts[level]}</span>
                  <span className="progress-breakdown__label">{LEVEL_SHORT[level]}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <Link to="/" className="btn btn--secondary">
        Volver al inicio
      </Link>
    </div>
  );
}
