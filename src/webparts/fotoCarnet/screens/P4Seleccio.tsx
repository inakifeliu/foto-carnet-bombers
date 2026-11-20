import * as React from 'react';
import { useApp } from '../app/AppContext';
import { Boto } from '../components/Boto';
import { Miniatura } from '../components/Miniatura';
import { t } from '../i18n';
import styles from '../styles/brand.module.scss';

/** Puntuacions simulades (la Fase 1 en calcularà de reals). */
const PUNTUACIONS_SIMULADES = [72, 88, 65];

export const P4Seleccio: React.FC = () => {
  const { dispatch } = useApp();
  // Preseleccionada: la de puntuació més alta.
  const millor = PUNTUACIONS_SIMULADES.indexOf(Math.max(...PUNTUACIONS_SIMULADES));

  return (
    <section className={styles.pantalla}>
      <h1 className={styles.titol}>{t('p4.titol')}</h1>
      <p className={styles.nota}>{t('p4.simulacio')}</p>
      <ul className={styles.fotos}>
        {PUNTUACIONS_SIMULADES.map((punts, i) => (
          <li key={i} className={styles.fotoItem}>
            <Miniatura etiqueta={t('p4.foto', { n: i + 1 })} seleccionada={i === millor}>
              <p className={styles.puntuacio}>{t('p4.puntuacio', { punts })}</p>
              {i === millor && <p className={styles.etiquetaRecomanada}>{t('p4.preseleccionada')}</p>}
            </Miniatura>
            <Boto
              onClick={() => {
                dispatch({ tipus: 'TRIA_FOTO', index: i });
                dispatch({ tipus: 'ENDAVANT' });
              }}
            >
              {t('p4.triar')}
            </Boto>
          </li>
        ))}
      </ul>
      <div className={styles.accions}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })}>
          {t('p4.repetir')}
        </Boto>
      </div>
    </section>
  );
};
