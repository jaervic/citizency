// src/hooks/useThemeEffect.ts
// Propósito: mantener el tema aplicado al día. Se llama una vez, en `App`, y:
//   - aplica el tema resuelto a partir de la preferencia guardada;
//   - si la preferencia es 'system', escucha los cambios de `prefers-color-scheme` del sistema.
import { useEffect } from 'react';

import { useStore } from '@/store/useStore';
import { applyTheme, resolveTheme } from '@/utils/theme';

export function useThemeEffect(): void {
  const theme = useStore((state) => state.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = () => {
      applyTheme(resolveTheme(theme, media.matches));
    };

    apply();

    if (theme !== 'system') {
      return undefined;
    }

    media.addEventListener('change', apply);

    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
