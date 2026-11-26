import * as React from 'react';
import styles from '../styles/brand.module.css';

export interface IMiniaturaProps {
  etiqueta: string;
  seleccionada?: boolean;
  /** URL de la imatge (blob:); sense ella es mostra el text de l'etiqueta. */
  src?: string;
  /** Si hi és (i hi ha `src`), es mostra un botó de lupa sobre la imatge per veure-la en gran. */
  onAmplia?: () => void;
  /** Nom accessible del botó de lupa (p. ex. «Veure la foto 1 en gran»). */
  etiquetaAmplia?: string;
  children?: React.ReactNode;
}

/** Icona de lupa (SVG en línia, hereta el color del text). */
const IconaLupa: React.FC = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <line x1="15" y1="15" x2="21" y2="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="10" y1="7" x2="10" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Una foto 35:45 (la imatge retallada) o, sense `src`, un marcador de posició. */
export const Miniatura: React.FC<IMiniaturaProps> = ({
  etiqueta,
  seleccionada,
  src,
  onAmplia,
  etiquetaAmplia,
  children
}) => (
  <div className={seleccionada ? `${styles.miniatura} ${styles.miniaturaSeleccionada}` : styles.miniatura}>
    {src ? (
      <div className={styles.miniaturaMarc}>
        <img src={src} alt={etiqueta} className={styles.miniaturaImg} />
        {onAmplia && (
          <button
            type="button"
            className={styles.botoLupa}
            onClick={onAmplia}
            aria-label={etiquetaAmplia ?? etiqueta}
            title={etiquetaAmplia ?? etiqueta}
            data-lupa=""
          >
            <IconaLupa />
          </button>
        )}
      </div>
    ) : (
      <div className={styles.miniaturaMarc} role="img" aria-label={etiqueta}>
        <span aria-hidden="true">{etiqueta}</span>
      </div>
    )}
    {children}
  </div>
);
