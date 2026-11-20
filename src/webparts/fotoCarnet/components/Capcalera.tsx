import * as React from 'react';
import { t } from '../i18n';
import styles from '../styles/brand.module.scss';
import signaturaNegra from '../assets/brand/AJBCN_Sign_Com_Negre_Transparent_0.svg';
import escut from '../assets/brand/escut_bombers_color.png';

/** Capçalera: signatura de l'Ajuntament (negre) a l'esquerra i escut de Bombers (color) a la dreta, sobre blanc. */
export const Capcalera: React.FC = () => (
  <header className={styles.capcalera}>
    <div className={styles.logoSignatura}>
      <img src={signaturaNegra} alt={t('capcalera.ajuntament')} className={styles.imgSignatura} />
    </div>
    <div className={styles.logoEscut}>
      <img src={escut} alt={t('capcalera.bombers')} className={styles.imgEscut} />
    </div>
  </header>
);
