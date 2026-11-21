import * as React from 'react';
import styles from '../styles/brand.module.css';
import { t } from '../i18n';

/** Silueta guia (placeholder): oval per a la cara i línia d'espatlles. */
export const SiluetaGuia: React.FC = () => (
  <svg className={styles.silueta} viewBox="0 0 350 450" role="img" aria-label={t('p3.silueta')}>
    <ellipse cx="175" cy="170" rx="85" ry="110" className={styles.siluetaTrac} />
    <path d="M25 440 C 40 340, 110 310, 175 310 C 240 310, 310 340, 325 440" className={styles.siluetaTrac} />
  </svg>
);
