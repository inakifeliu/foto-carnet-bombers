import * as React from 'react';
import styles from '../styles/brand.module.css';

export interface IMiniaturaProps {
  etiqueta: string;
  seleccionada?: boolean;
  /** URL de la imatge (blob:); sense ella es mostra el text de l'etiqueta. */
  src?: string;
  children?: React.ReactNode;
}

/** Una foto 35:45 (la imatge retallada) o, sense `src`, un marcador de posició. */
export const Miniatura: React.FC<IMiniaturaProps> = ({ etiqueta, seleccionada, src, children }) => (
  <div className={seleccionada ? `${styles.miniatura} ${styles.miniaturaSeleccionada}` : styles.miniatura}>
    {src ? (
      <div className={styles.miniaturaMarc}>
        <img src={src} alt={etiqueta} className={styles.miniaturaImg} />
      </div>
    ) : (
      <div className={styles.miniaturaMarc} role="img" aria-label={etiqueta}>
        <span aria-hidden="true">{etiqueta}</span>
      </div>
    )}
    {children}
  </div>
);
