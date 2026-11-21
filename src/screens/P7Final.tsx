import * as React from 'react';
import { useApp } from '../app/AppContext';
import { nomFitxer } from '../app/formulari';
import { clauCarpeta } from '../captura/desar';
import { Boto } from '../components/Boto';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';
import segell from '../assets/brand/segell_historic_bombers.png';

export const P7Final: React.FC = () => {
  const { estat, reinicia, alliberaTot } = useApp();
  // RF-16: en finalitzar, s'allibera la memòria (pistes, URL blob, canvas i fotos).
  React.useEffect(() => {
    alliberaTot();
  }, [alliberaTot]);
  return (
    <section className={styles.pantalla}>
      <div className={styles.logosBenvinguda}>
        <img src={segell} alt={t('logo.segell')} className={styles.imgBenvinguda} />
      </div>
      <h1 className={styles.titol}>{t('p7.titol')}</h1>
      <p className={styles.text}>{t('p7.text')}</p>
      <p className={styles.text}>
        {t('p7.recordatori', {
          fitxer: estat.nomDesat || nomFitxer(estat.matricula),
          carpeta: t(clauCarpeta(estat.desti))
        })}
      </p>
      <div className={styles.accions}>
        <Boto onClick={reinicia}>{t('p7.comencarDeNou')}</Boto>
      </div>
    </section>
  );
};
