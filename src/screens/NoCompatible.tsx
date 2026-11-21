import * as React from 'react';
import { t } from '../i18n';
import { Titol } from '../components/Titol';
import styles from '../styles/brand.module.css';

export const NoCompatible: React.FC = () => (
  <section className={styles.pantalla}>
    <Titol>{t('noCompatible.titol')}</Titol>
    <p className={styles.text} role="alert">
      {t('noCompatible.text')}
    </p>
  </section>
);
