import * as React from 'react';
import { useApp } from '../app/AppContext';
import { nomFitxer } from '../app/formulari';
import { Boto } from '../components/Boto';
import { Miniatura } from '../components/Miniatura';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';

export const P5Desar: React.FC = () => {
  const { estat, dispatch } = useApp();
  return (
    <section className={styles.pantalla}>
      <h1 className={styles.titol}>{t('p5.titol')}</h1>
      <div className={styles.previa}>
        <Miniatura etiqueta={t('p4.foto', { n: estat.fotoTriada + 1 })} />
      </div>
      <p className={styles.text}>{t('p5.nomFitxer', { fitxer: nomFitxer(estat.matricula) })}</p>
      <p className={styles.nota}>{t('p5.simulacio')}</p>
      <div className={styles.accions}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })}>
          {t('nav.enrere')}
        </Boto>
        <Boto onClick={() => dispatch({ tipus: 'ENDAVANT' })}>{t('p5.desar')}</Boto>
      </div>
    </section>
  );
};
