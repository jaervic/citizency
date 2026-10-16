// src/routes/BackupScreen.tsx
// Propósito: que nadie pierda su progreso. Todo vive en `localStorage`, así que se pierde al borrar
// los datos del navegador, en modo privado o al cambiar de dispositivo. Aquí se puede:
//   - descargar una copia (fichero .json) o copiar un código de texto para guardarlo donde quiera;
//   - restaurarla pegando el código o subiendo el fichero, eligiendo entre reemplazar o combinar;
//   - leer consejos para que no se borre.
import { useState } from 'react';
import { Link } from 'react-router-dom';

import Icon from '@/components/Icon';
import { useConfirm } from '@/components/ConfirmDialog';
import { selectExportableState, useStore } from '@/store/useStore';
import {
  backupFileName,
  createBackup,
  decodeBackup,
  encodeBackup,
  mergeProgress,
  parseBackup,
  serializeBackup,
  summarizeBackup,
  toRestorable,
} from '@/utils/backup';
import type { Backup, BackupSummary } from '@/utils/backup';

/** Descarga un texto como fichero. */
function downloadText(nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/json' }));
  const enlace = document.createElement('a');

  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** Fecha ISO en formato legible. */
function formatDate(iso: string): string {
  const fecha = new Date(iso);

  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleDateString('es-ES');
}

type Pendiente = { backup: Backup; summary: BackupSummary };

export default function BackupScreen() {
  const restore = useStore((state) => state.restore);
  const confirm = useConfirm();

  /** Código generado al exportar (solo lectura). */
  const [codigoGenerado, setCodigoGenerado] = useState('');
  /** Texto que la persona pega para importar. */
  const [entrada, setEntrada] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);

  const exportarFichero = () => {
    const backup = createBackup(selectExportableState(useStore.getState()));

    downloadText(backupFileName(), serializeBackup(backup));
    setAviso({ tipo: 'ok', texto: 'Copia descargada. Guárdala donde no la pierdas.' });
  };

  const copiarCodigo = async () => {
    const backup = createBackup(selectExportableState(useStore.getState()));
    const texto = await encodeBackup(backup);

    setCodigoGenerado(texto);

    try {
      await navigator.clipboard.writeText(texto);
      setAviso({ tipo: 'ok', texto: 'Código copiado. Pégalo en Notas o mándatelo por mensaje.' });
    } catch {
      // Sin permiso de portapapeles, el código queda visible para copiarlo a mano.
      setAviso({ tipo: 'ok', texto: 'Copia el código de abajo y guárdalo.' });
    }
  };

  /** Lee una copia (de un código o de un fichero) y la deja lista para confirmar. */
  const preparar = async (texto: string, desdeFichero: boolean) => {
    const resultado = desdeFichero ? parseBackup(texto) : await decodeBackup(texto);

    if (!resultado.ok) {
      setPendiente(null);
      setAviso({ tipo: 'error', texto: resultado.error });
      return;
    }

    setPendiente({ backup: resultado.backup, summary: summarizeBackup(resultado.backup) });
    setAviso(null);
  };

  const aplicar = async (modo: 'reemplazar' | 'combinar') => {
    if (pendiente === null) {
      return;
    }

    if (modo === 'reemplazar') {
      const aceptado = await confirm({
        title: 'Reemplazar tu progreso',
        message:
          'Se borrará el progreso que tienes ahora y se pondrá el de la copia. Si tienes dudas, cancela y descarga antes una copia de lo actual.',
        confirmLabel: 'Sí, reemplazar',
        cancelLabel: 'Cancelar',
      });

      if (!aceptado) {
        return;
      }

      restore(toRestorable(pendiente.backup));
    } else {
      restore(mergeProgress(selectExportableState(useStore.getState()), pendiente.backup));
    }

    setAviso({ tipo: 'ok', texto: 'Progreso restaurado.' });
    setPendiente(null);
    setEntrada('');
  };

  return (
    <div className="page">
      <section className="card settings-section">
        <h2 className="settings-title">Guardar una copia</h2>
        <p className="settings-hint">
          Tu progreso se guarda solo en este dispositivo. Si borras los datos del navegador, cambias
          de teléfono o usas una ventana privada, se pierde. Descarga una copia de vez en cuando: es
          la única forma de recuperarlo.
        </p>

        <button type="button" className="btn btn--primary" onClick={exportarFichero}>
          <Icon name="download" />
          Descargar copia
        </button>

        <button type="button" className="settings-donate" onClick={() => void copiarCodigo()}>
          <Icon name="copy" />
          Copiar código para guardarlo
        </button>

        {codigoGenerado !== '' && (
          <>
            <label className="field-label" htmlFor="codigo-generado">
              Tu código (guárdalo en Notas o mándatelo)
            </label>
            <textarea
              id="codigo-generado"
              className="backup-code"
              readOnly
              value={codigoGenerado}
              rows={5}
              onFocus={(event) => event.currentTarget.select()}
            />
          </>
        )}
      </section>

      <section className="card settings-section">
        <h2 className="settings-title">Restaurar una copia</h2>
        <p className="settings-hint">Pega el código que guardaste o sube el fichero .json.</p>

        <label className="field-label" htmlFor="codigo-entrada">
          Código de la copia
        </label>
        <textarea
          id="codigo-entrada"
          className="backup-code"
          value={entrada}
          rows={4}
          placeholder="USCIS1Z:…"
          onChange={(event) => setEntrada(event.target.value)}
        />

        <button
          type="button"
          className="settings-donate"
          disabled={entrada.trim() === ''}
          onClick={() => void preparar(entrada, false)}
        >
          <Icon name="upload" />
          Leer este código
        </button>

        <label className="field-label" htmlFor="fichero-copia">
          …o elige el fichero
        </label>
        <input
          id="fichero-copia"
          className="field-select backup-file"
          type="file"
          accept="application/json,.json"
          onChange={async (event) => {
            const fichero = event.target.files?.[0];

            if (fichero !== undefined) {
              await preparar(await fichero.text(), true);
            }

            // Se limpia para poder volver a elegir el mismo fichero.
            event.target.value = '';
          }}
        />

        {pendiente !== null && (
          <div className="backup-preview">
            <p className="backup-preview__title">Esa copia contiene:</p>
            <ul className="backup-preview__list">
              <li>{pendiente.summary.xp} XP</li>
              <li>
                {pendiente.summary.streak} {pendiente.summary.streak === 1 ? 'día' : 'días'} de racha
              </li>
              <li>{pendiente.summary.answered} preguntas con historial</li>
              <li>{pendiente.summary.mastered} dominadas</li>
              <li>Guardada el {formatDate(pendiente.summary.exportedAt)}</li>
            </ul>

            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={() => void aplicar('reemplazar')}>
                Reemplazar mi progreso
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => void aplicar('combinar')}>
                Combinar con el mío
              </button>
            </div>
          </div>
        )}

        {aviso !== null && (
          <p className={aviso.tipo === 'ok' ? 'install-ok' : 'backup-error'}>
            {aviso.tipo === 'ok' ? <Icon name="check" /> : null}
            <span>{aviso.texto}</span>
          </p>
        )}
      </section>

      <section className="card settings-section">
        <h2 className="settings-title">Cómo evitar que se borre</h2>
        <ul className="backup-tips">
          <li>No uses el modo privado o de incógnito para estudiar.</li>
          <li>Si borras las cookies y los datos del sitio, se borra el progreso.</li>
          <li>
            En iPhone o iPad, si no entras en semanas, Safari puede liberar el almacenamiento. Abrir
            la app de vez en cuando (o instalarla) evita ese borrado.
          </li>
          <li>Descarga una copia antes de cambiar de teléfono o de navegador.</li>
        </ul>
      </section>

      <Link to="/settings" className="btn btn--secondary">
        Volver a Ajustes
      </Link>
    </div>
  );
}
