import * as React from 'react';
import { useApp } from '../app/AppContext';
import { Boto } from '../components/Boto';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';
import escut from '../assets/brand/escut_bombers_color.png';
import segell from '../assets/brand/segell_historic_bombers.png';

export const P0Benvinguda: React.FC = () => {
  const { dispatch, funcionalitats } = useApp();
  return (
    <section className={styles.pantalla}>
      <div className={styles.logosBenvinguda}>
        <img src={escut} alt={t('logo.escut')} className={styles.imgBenvinguda} />
        <img src={segell} alt={t('logo.segell')} className={styles.imgBenvinguda} />
      </div>
      <h1 className={styles.titol}>{t('p0.titol')}</h1>
      <p className={styles.text}>{t('p0.text')}</p>
      <p className={styles.text}>{t('p0.privacitat')}</p>
      {!funcionalitats.webGL2 && <p className={styles.nota}>{t('p0.senseWebgl2')}</p>}
      <div className={styles.accions}>
        <Boto onClick={() => dispatch({ tipus: 'ENDAVANT' })}>{t('p0.comencar')}</Boto>
      </div>
    </section>
  );
};
