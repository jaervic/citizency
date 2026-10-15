// src/components/ConfirmDialog.tsx
// Propósito: diálogo de confirmación propio (nada de `window.confirm`, que en móvil se ve
// tosco y no se puede adaptar). Se usa con el hook `useConfirm()`:
//
//   const confirm = useConfirm();
//   const ok = await confirm({ title: 'Reiniciar', message: '…' });
//
// El proveedor `ConfirmProvider` va una sola vez, envolviendo la app en `src/App.tsx`.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type ConfirmOptions = {
  /** Título del diálogo. */
  title: string;
  /** Texto explicativo (opcional). */
  message?: string;
  /** Texto del botón que confirma (por defecto "Confirmar"). */
  confirmLabel?: string;
  /** Texto del botón que cancela (por defecto "Cancelar"). */
  cancelLabel?: string;
};

type ConfirmRequest = ConfirmOptions & {
  resolve: (accepted: boolean) => void;
};

type ConfirmContextValue = {
  /** Muestra el diálogo y resuelve `true` si el usuario confirma. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

/** Acceso al diálogo de confirmación. Debe usarse dentro de `ConfirmProvider`. */
export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const context = useContext(ConfirmContext);

  if (context === null) {
    throw new Error('useConfirm() debe usarse dentro de <ConfirmProvider>.');
  }

  return context.confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setRequest({ ...options, resolve });
    });
  }, []);

  const close = useCallback((accepted: boolean) => {
    setRequest((current) => {
      current?.resolve(accepted);
      return null;
    });
  }, []);

  // Al abrir: se enfoca el botón de confirmar y se bloquea el scroll del fondo.
  useEffect(() => {
    if (request === null) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [request, close]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {request !== null && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            // Un toque fuera del diálogo lo cancela.
            if (event.target === event.currentTarget) {
              close(false);
            }
          }}
        >
          <div className="modal" role="alertdialog" aria-modal="true" aria-label={request.title}>
            <h2 className="modal__title">{request.title}</h2>
            {request.message !== undefined && <p className="modal__message">{request.message}</p>}
            <div className="modal__actions">
              <button
                type="button"
                className="btn btn--primary"
                ref={confirmButtonRef}
                onClick={() => close(true)}
              >
                {request.confirmLabel ?? 'Confirmar'}
              </button>
              <button type="button" className="btn modal__cancel" onClick={() => close(false)}>
                {request.cancelLabel ?? 'Cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
