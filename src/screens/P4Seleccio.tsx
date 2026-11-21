import * as React from 'react';
import { useApp } from '../app/AppContext';
import { Boto } from '../components/Boto';
import { Miniatura } from '../components/Miniatura';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';

/** Puntuació PROVISIONAL (simulada, no calculada de la imatge): el càlcul real és de la Fase 2. */
export const PUNTUACIO_SIMULADA = 75;

export const P4Seleccio: React.FC = () => {
  const { fotos, dispatch, alliberaFotos } = useApp();

  return (
    <section className={styles.pantalla}>
      <h1 className={styles.titol}>{t('p4.titol')}</h1>
      <p className={styles.nota}>{t('p4.simulacio')}</p>
      <ul className={styles.fotos}>
        {fotos.map((foto, i) => (
          <li key={foto.id} className={styles.fotoItem}>
            <Miniatura etiqueta={t('p4.foto', { n: i + 1 })} src={foto.url}>
              <p className={styles.puntuacio}>{t('p4.puntuacio', { punts: PUNTUACIO_SIMULADA })}</p>
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
        <Boto
          variant="secundari"
          onClick={() => {
            // «Repetir les fotos»: s'alliberen totes les fotos i es torna a la captura.
            alliberaFotos();
            dispatch({ tipus: 'TRIA_FOTO', index: 0 });
            dispatch({ tipus: 'ENRERE' });
          }}
        >
          {t('p4.repetir')}
        </Boto>
      </div>
    </section>
  );
};
