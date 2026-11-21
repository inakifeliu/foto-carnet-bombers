import * as React from 'react';
import styles from '../styles/brand.module.css';
import { t } from '../i18n';

/**
 * Silueta guia (placeholder) de l'enquadrament «visor»: cap + espatlles + part del polo. L'oval del cap fa ~33% de
 * l'alçada del visor (cara, del front a la barbeta, ≈ 27%: coherent amb `alcadaCaraMin/Max` = 0,22–0,30) i les espatlles
 * comencen a ~63%, de manera que a la foto es veu el polo.
 */
export const SiluetaGuia: React.FC = () => (
  <svg className={styles.silueta} viewBox="0 0 350 450" role="img" aria-label={t('p3.silueta')}>
    <ellipse cx="175" cy="150" rx="52" ry="75" className={styles.siluetaTrac} />
    <path d="M20 445 C 30 345, 105 288, 175 288 C 245 288, 320 345, 330 445" className={styles.siluetaTrac} />
  </svg>
);
