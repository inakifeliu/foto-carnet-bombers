import * as React from 'react';
import { useApp } from '../app/AppContext';
import { Boto } from '../components/Boto';
import { Semafor } from '../components/Semafor';
import { SiluetaGuia } from '../components/SiluetaGuia';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';

/** Captura simulada: sense càmera ni MediaPipe (Fase 1). */
export const P3Captura: React.FC = () => {
  const { config, dispatch } = useApp();
  return (
    <section className={styles.pantalla}>
      <h1 className={styles.titol}>{t('p3.titol')}</h1>
      <p className={styles.nota}>{t('p3.simulacio')}</p>
      <div className={styles.captura}>
        <div className={styles.visor}>
          <span className={styles.visorText}>{t('p3.simulada')}</span>
          <SiluetaGuia />
        </div>
        <div className={styles.panell}>
          {/* Regió aria-live: una sola indicació alhora (la de més prioritat). */}
          <div
            className={styles.guia}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={t('p3.guiaRegio')}
          >
            {t('p3.guia')}
          </div>
          <p className={styles.comptador}>{t('p3.comptador', { n: 1, max: config.maxFotos })}</p>
          <ul className={styles.semafors} aria-label={t('p3.semafors')}>
            <Semafor etiqueta={t('p3.semafor.cara')} estat="ok" />
            <Semafor etiqueta={t('p3.semafor.distancia')} estat="avis" />
            <Semafor etiqueta={t('p3.semafor.llum')} estat="error" />
          </ul>
        </div>
      </div>
      <div className={styles.accions}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })}>
          {t('nav.enrere')}
        </Boto>
        <Boto onClick={() => dispatch({ tipus: 'ENDAVANT' })}>{t('p3.feta')}</Boto>
      </div>
    </section>
  );
};
