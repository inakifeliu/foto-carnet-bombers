import * as React from 'react';
import styles from '../styles/brand.module.css';

export interface IMiniaturaProps {
  etiqueta: string;
  seleccionada?: boolean;
  children?: React.ReactNode;
}

/** Placeholder d'una foto 35:45 (la Fase 1 hi posarà la imatge retallada). */
export const Miniatura: React.FC<IMiniaturaProps> = ({ etiqueta, seleccionada, children }) => (
  <div className={seleccionada ? `${styles.miniatura} ${styles.miniaturaSeleccionada}` : styles.miniatura}>
    <div className={styles.miniaturaMarc} role="img" aria-label={etiqueta}>
      <span aria-hidden="true">{etiqueta}</span>
    </div>
    {children}
  </div>
);
