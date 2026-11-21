import * as React from 'react';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';
import signaturaVermella from '../assets/brand/AJBCN_Sign_Com_Vermell_Transparent.svg';
import { DATA_COMPILACIO, VERSIO } from '../versio';

/** Peu de totes les pantalles: signatura de l'Ajuntament, text del Servei i versió i data de compilació (RF-21). */
export const Peu: React.FC = () => (
  <footer className={styles.peu}>
    <div className={styles.logoSignatura}>
      <img src={signaturaVermella} alt="" className={styles.imgSignatura} />
    </div>
    <p className={styles.peuText}>{t('peu.text')}</p>
    <p className={styles.versio} data-versio="">
      {t('peu.versio', { versio: VERSIO, data: DATA_COMPILACIO })}
    </p>
  </footer>
);
