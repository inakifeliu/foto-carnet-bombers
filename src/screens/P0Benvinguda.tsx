import * as React from 'react';
import { useApp } from '../app/AppContext';
import { Boto } from '../components/Boto';
import { TextRic } from '../components/TextRic';
import { t } from '../i18n';
import { Titol } from '../components/Titol';
import styles from '../styles/brand.module.css';
import escut from '../assets/brand/escut_bombers_color.png';
import segell from '../assets/brand/segell_historic_bombers.png';

export const P0Benvinguda: React.FC = () => {
  const { dispatch, funcionalitats } = useApp();
  return (
    <section className={styles.pantalla}>
      <div className={styles.logosBenvinguda}>
        {/* L'escut ja té nom a la capçalera: aquí és decoratiu. */}
        <img src={escut} alt="" className={styles.imgBenvinguda} />
        <img src={segell} alt={t('logo.segell')} className={styles.imgBenvinguda} />
      </div>
      <Titol>{t('p0.titol')}</Titol>
      {/* El primer que es llegeix: la imatge no surt del dispositiu fins que l'usuari la puja al formulari. */}
      <div className={styles.privacitat} data-privacitat="">
        <p className={styles.privacitatTitol}>{t('p0.privacitatTitol')}</p>
        <p className={styles.privacitatText}>{t('p0.privacitat')}</p>
      </div>
      <p className={styles.text}>{t('p0.text')}</p>
      <p className={styles.text} data-consell-camera="">
        <TextRic text={t('p0.consellCamera')} />
      </p>
      {!funcionalitats.webGL && <p className={styles.nota}>{t('p0.senseWebgl')}</p>}
      {funcionalitats.webGL && !funcionalitats.webGL2 && <p className={styles.nota}>{t('p0.senseWebgl2')}</p>}
      <div className={styles.accions}>
        <Boto onClick={() => dispatch({ tipus: 'ENDAVANT' })}>{t('p0.comencar')}</Boto>
      </div>
    </section>
  );
};
