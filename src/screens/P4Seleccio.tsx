import * as React from 'react';
import { useApp } from '../app/AppContext';
import type { IFoto } from '../captura/fotos';
import { Boto } from '../components/Boto';
import { Miniatura } from '../components/Miniatura';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';

/** Índex de la foto amb més puntuació (la primera en cas d'empat); 0 si cap té puntuació. */
export function indexMillorFoto(fotos: IFoto[]): number {
  let millor = 0;
  let max = -1;
  fotos.forEach((f, i) => {
    if (f.puntuacio !== undefined && f.puntuacio > max) {
      max = f.puntuacio;
      millor = i;
    }
  });
  return millor;
}

export const P4Seleccio: React.FC = () => {
  const { fotos, dispatch, alliberaFotos } = useApp();
  const millor = indexMillorFoto(fotos);
  const hiHaPuntuacio = fotos.some((f) => f.puntuacio !== undefined);

  // La foto de més puntuació ve preseleccionada.
  React.useEffect(() => {
    dispatch({ tipus: 'TRIA_FOTO', index: millor });
  }, [dispatch, millor]);

  return (
    <section className={styles.pantalla}>
      <h1 className={styles.titol}>{t('p4.titol')}</h1>
      <p className={styles.nota}>{t('p4.nota')}</p>
      <ul className={styles.fotos}>
        {fotos.map((foto, i) => {
          const recomanada = hiHaPuntuacio && i === millor && fotos.length > 1;
          return (
            <li key={foto.id} className={styles.fotoItem}>
              <Miniatura etiqueta={t('p4.foto', { n: i + 1 })} src={foto.url} seleccionada={recomanada}>
                <p className={styles.puntuacio}>
                  {foto.puntuacio === undefined ? t('p4.senseAnalisi') : t('p4.puntuacio', { punts: foto.puntuacio })}
                </p>
                {recomanada && <p className={styles.recomanada}>{t('p4.recomanada')}</p>}
                {foto.avisos && foto.avisos.length > 0 && (
                  <ul className={styles.avisosFoto} aria-label={t('p4.avisos')} data-avisos-foto="">
                    {foto.avisos.map((a) => (
                      <li key={a}>{t(a)}</li>
                    ))}
                  </ul>
                )}
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
          );
        })}
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
