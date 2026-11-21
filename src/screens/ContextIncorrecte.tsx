import * as React from 'react';
import { Capcalera } from '../components/Capcalera';
import { Peu } from '../components/Peu';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';

/** RF-19: l'aplicació s'ha obert dins un iframe (vista prèvia d'un servei): no es demana la càmera. */
export const ContextIncorrecte: React.FC = () => (
  <div className={styles.arrel}>
    <Capcalera />
    <main className={styles.principal}>
      <section className={styles.pantalla}>
        <p className={styles.text} role="alert">
          {t('rf19.missatge')}
        </p>
      </section>
    </main>
    <Peu />
  </div>
);
