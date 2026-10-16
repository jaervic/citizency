// src/routes/SettingsScreen.tsx
// Propósito: pantalla de Ajustes. Agrupa las preferencias que no pertenecen a ninguna pantalla de
// estudio. De momento el tema; las siguientes fases añaden aquí la voz del audio, la copia de
// seguridad del progreso y el estado del almacenamiento.
import { Link } from 'react-router-dom';

import Icon from '@/components/Icon';
import SpeakerButton from '@/components/SpeakerButton';
import { AUTHOR, DONATION_LABEL, DONATION_URL } from '@/config/support';
import { useVoices, isSpeechSupported } from '@/hooks/useVoices';
import { useStore } from '@/store/useStore';
import { describeVoice, resolveVoice } from '@/utils/speech';
import { THEME_LABELS, THEME_OPTIONS } from '@/utils/theme';
import type { ThemePreference } from '@/utils/theme';

export default function SettingsScreen() {
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);
  const voiceName = useStore((state) => state.voiceName);
  const setVoiceName = useStore((state) => state.setVoiceName);
  const voices = useVoices();

  const vozActual = isSpeechSupported() ? resolveVoice(voices, voiceName) : null;

  return (
    <div className="page">
      <section className="card settings-section">
        <h2 className="settings-title">Tema</h2>
        <p className="settings-hint">
          Elige cómo se ve la app. Con «Sistema» sigue el modo claro u oscuro de tu teléfono o
          computadora, y cambia con él.
        </p>

        <div className="segmented" role="group" aria-label="Tema de la aplicación">
          {THEME_OPTIONS.map((option: ThemePreference) => (
            <button
              key={option}
              type="button"
              className="segment"
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
            >
              {THEME_LABELS[option]}
            </button>
          ))}
        </div>
      </section>

      <section className="card settings-section">
        <h2 className="settings-title">Voz</h2>
        <p className="settings-hint">
          La app lee las preguntas y las respuestas en inglés. Se prefieren las voces que necesitan
          internet porque son las que suenan más naturales; si te quedas sin conexión, la lectura
          pasa sola a una voz del dispositivo.
        </p>

        <label className="field-label" htmlFor="voice-select">
          Voz de lectura
        </label>
        <select
          id="voice-select"
          className="field-select"
          value={voiceName ?? ''}
          disabled={voices.length === 0}
          onChange={(event) => setVoiceName(event.target.value === '' ? null : event.target.value)}
        >
          <option value="">
            {voices.length === 0 ? 'Cargando voces…' : 'Automática (la mejor disponible)'}
          </option>
          {voices.map((voice) => (
            <option key={voice.name} value={voice.name}>
              {describeVoice(voice)}
            </option>
          ))}
        </select>

        <SpeakerButton
          className="settings-donate"
          text="What is the form of government of the United States?"
          label="Probar la voz"
        />

        <p className="settings-hint">
          {vozActual === null
            ? 'Este dispositivo no ofrece voces en inglés. La lectura no estará disponible, pero puedes seguir estudiando.'
            : `Se usará: ${describeVoice(vozActual)}.`}
        </p>

        <p className="state-note">
          Si usas Firefox, solo hay voces del sistema y suenan peor. En Chrome, Edge, Safari y en
          Android e iOS, la lectura es mejor.
        </p>
      </section>

      <section className="card settings-section">
        <h2 className="settings-title">Tu progreso</h2>
        <p className="settings-hint">
          Se guarda en este dispositivo. Descarga una copia de vez en cuando para no perderlo si
          borras los datos del navegador o cambias de teléfono.
        </p>
        <Link to="/backup" className="settings-donate">
          <Icon name="download" />
          Copia de seguridad
        </Link>
      </section>

      <section className="card settings-section">
        <h2 className="settings-title">Instalar la app</h2>
        <p className="settings-hint">
          Añádela a la pantalla de inicio de tu teléfono o computadora para abrirla como una app y
          usarla sin conexión.
        </p>
        <Link to="/install" className="settings-donate">
          <Icon name="download" />
          Ver cómo instalarla
        </Link>
      </section>

      <section className="card settings-section">
        <h2 className="settings-title">Apoyar el proyecto</h2>
        <p className="settings-hint">
          La app es gratis y sin anuncios, y tu progreso se queda en tu dispositivo. Si te está
          sirviendo para prepararte, puedes invitarme a un café. Es voluntario y no desbloquea nada:
          todo el contenido ya está disponible.
        </p>

        <a
          className="settings-donate"
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${DONATION_LABEL} en Ko-fi (se abre en otra pestaña)`}
        >
          <Icon name="coffee" />
          {DONATION_LABEL}
        </a>

        <a
          className="settings-author"
          href={AUTHOR.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`GitHub de ${AUTHOR.name} (se abre en otra pestaña)`}
        >
          <Icon name="github" />
          Hecho por {AUTHOR.name}
        </a>
      </section>

      <Link to="/" className="btn btn--secondary">
        Volver al inicio
      </Link>
    </div>
  );
}
