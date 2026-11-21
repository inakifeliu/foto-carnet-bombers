import * as React from 'react';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';

export const NoCompatible: React.FC = () => (
  <section className={styles.pantalla}>
    <h1 className={styles.titol}>{t('noCompatible.titol')}</h1>
    <p className={styles.text} role="alert">
      {t('noCompatible.text')}
    </p>
  </section>
);
