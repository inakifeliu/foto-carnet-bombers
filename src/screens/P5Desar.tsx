import * as React from 'react';
import { useApp } from '../app/AppContext';
import { nomFitxer } from '../app/formulari';
import { pppSortida } from '../captura/retall';
import { codificaJpeg, desaFitxer, entornDesatActual, recordaHandleDesat } from '../captura/desar';
import { Boto } from '../components/Boto';
import { Miniatura } from '../components/Miniatura';
import { t } from '../i18n';
import { Titol } from '../components/Titol';
import styles from '../styles/brand.module.css';

export const P5Desar: React.FC = () => {
  const { estat, config, fotos, dispatch } = useApp();
  const [desant, setDesant] = React.useState<boolean>(false);
  const [error, setError] = React.useState<boolean>(false);
  const foto = fotos[estat.fotoTriada];
  const nom = nomFitxer(estat.matricula);

  const desa = (): void => {
    if (!foto || desant) {
      return;
    }
    setDesant(true);
    setError(false);
    // IMPORTANT: `desaFitxer` s'invoca aquí mateix, dins el clic i sense cap await abans: obre el selector de
    // fitxers primer i només després codifica (RF-11).
    desaFitxer(estat.matricula, () =>
      codificaJpeg(foto.canvas, config.sortida.qualitatJpeg, pppSortida(config.sortida, foto.canvas.height))
    )
      .then((r) => {
        if (r.tipus === 'ok') {
          recordaHandleDesat(r.handle);
          dispatch({ tipus: 'DESAT', desti: r.desti, nom: r.nom });
          dispatch({ tipus: 'ENDAVANT' });
        } else if (r.tipus === 'error') {
          setError(true);
        }
        // 'cancelat' (AbortError): es queda a P5 sense cap error.
      })
      .catch(() => setError(true))
      .finally(() => setDesant(false));
  };

  return (
    <section className={styles.pantalla}>
      <Titol>{t('p5.titol')}</Titol>
      <div className={styles.previa}>
        <Miniatura etiqueta={t('p4.foto', { n: estat.fotoTriada + 1 })} src={foto?.url} />
      </div>
      <p className={styles.text}>{t('p5.nomFitxer', { fitxer: nom })}</p>
      <p className={styles.nota}>{t(entornDesatActual().showSaveFilePicker ? 'p5.ajuda' : 'p5.baixades')}</p>
      {!foto && (
        <p className={styles.error} role="alert">
          {t('p5.sensefoto')}
        </p>
      )}
      <div role="alert" className={styles.error}>
        {error ? t('p5.errorDesat') : ''}
      </div>
      <div className={styles.accions}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })} disabled={desant}>
          {t('nav.enrere')}
        </Boto>
        <Boto onClick={desa} disabled={!foto || desant}>
          {desant ? t('p5.desant') : t('p5.desar')}
        </Boto>
      </div>
    </section>
  );
};
