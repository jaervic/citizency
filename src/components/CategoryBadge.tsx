// src/components/CategoryBadge.tsx
// Propósito: insignia con el color de la categoría de la pregunta. Se usa en las tarjetas de
// estudio, el examen y el repaso, para que la misma categoría se reconozca de un vistazo.
import type { CSSProperties } from 'react';

import { CATEGORY_STYLE } from '@/utils/categories';
import type { Category } from '@/types';

type CategoryBadgeProps = {
  category: Category;
  className?: string;
};

export default function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const style = CATEGORY_STYLE[category];

  return (
    <span
      className={className === undefined ? 'category-badge' : `category-badge ${className}`}
      // El nombre completo va en el `title`: la insignia muestra la etiqueta corta.
      title={category}
      style={
        {
          '--badge-color': style.color,
          '--badge-soft': style.soft,
        } as CSSProperties
      }
    >
      {style.short}
    </span>
  );
}
