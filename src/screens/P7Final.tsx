import * as React from 'react';
import { useApp } from '../app/AppContext';
import { nomFitxer } from '../app/formulari';
import { clauCarpeta, esborraFitxerDesat, obteHandleDesat, potEsborrar } from '../captura/desar';
import { Boto } from '../components/Boto';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';
import segell from '../assets/brand/segell_historic_bombers.png';

export const P7Final: React.FC = () => {
  const { estat, reinicia, alliberaTot } = useApp();
  // RF-15: el handle només es llegeix; s'oblida a «Començar de nou», pagehide i pageshow persistit.
  const [handle] = React.useState(() => obteHandleDesat());
  const [esborrable, setEsborrable] = React.useState<boolean>(() => potEsborrar(handle));
  const [esborrant, setEsborrant] = React.useState<boolean>(false);
  const [esborrada, setEsborrada] = React.useState<boolean>(false);
  const [errorEsborrar, setErrorEsborrar] = React.useState<boolean>(false);

  const esborra = (): void => {
    if (esborrant) {
      return;
    }
    setEsborrant(true);
    setErrorEsborrar(false);
    // Es crida directament dins el clic (el permís es demana amb activació d'usuari).
    void esborraFitxerDesat(handle).then((r) => {
      setEsborrant(false);
      if (r === 'ok') {
        setEsborrada(true);
        setEsborrable(false);
      } else {
        // Error, permís denegat o no suportat: s'amaga el botó i queda el recordatori.
        setEsborrable(false);
        setErrorEsborrar(true);
      }
    });
  };

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
      <div role="status" className={styles.nota}>
        {esborrada ? t('p7.esborrada') : errorEsborrar ? t('p7.errorEsborrar') : ''}
      </div>
      <div className={styles.accions}>
        {esborrable && (
          <Boto variant="secundari" onClick={esborra} disabled={esborrant}>
            {esborrant ? t('p7.esborrant') : t('p7.esborrar')}
          </Boto>
        )}
        <Boto onClick={reinicia}>{t('p7.comencarDeNou')}</Boto>
      </div>
    </section>
  );
};
