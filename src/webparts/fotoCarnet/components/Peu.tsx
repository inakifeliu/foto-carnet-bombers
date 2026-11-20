import * as React from 'react';
import { t } from '../i18n';
import styles from '../styles/brand.module.scss';
import signaturaVermella from '../assets/brand/AJBCN_Sign_Com_Vermell_Transparent.svg';

export const Peu: React.FC = () => (
  <footer className={styles.peu}>
    <div className={styles.logoSignatura}>
      <img src={signaturaVermella} alt={t('peu.ajuntament')} className={styles.imgSignatura} />
    </div>
    <p className={styles.peuText}>{t('peu.text')}</p>
  </footer>
);
