import * as React from 'react';
import { useApp } from '../app/AppContext';
import { construeixUrlForms, diagnosticaPlantilla, nomFitxer } from '../app/formulari';
import { Boto } from '../components/Boto';
import { Modal } from '../components/Modal';
import { TextRic } from '../components/TextRic';
import { t, type ClauI18n } from '../i18n';
import styles from '../styles/brand.module.css';

/** `navigator.onLine === false` (i canvis en directe); sense l'API, es suposa connectat. */
function useSenseConnexio(): boolean {
  const [senseConnexio, setSenseConnexio] = React.useState<boolean>(() => navigator.onLine === false);
  React.useEffect(() => {
    const actualitza = (): void => setSenseConnexio(navigator.onLine === false);
    window.addEventListener('online', actualitza);
    window.addEventListener('offline', actualitza);
    return (): void => {
      window.removeEventListener('online', actualitza);
      window.removeEventListener('offline', actualitza);
    };
  }, []);
  return senseConnexio;
}

const CLAU_DIAGNOSTIC: Record<string, ClauI18n> = {
  noHttps: 'p6.urlNoHttps',
  hostNoPermes: 'p6.urlHostNoPermes',
  sensePlantilla: 'p6.sensePlantilla'
};

export const P6Forms: React.FC = () => {
  const { estat, config, dispatch } = useApp();
  const senseConnexio = useSenseConnexio();
  const botoInstruccions = React.useRef<HTMLButtonElement>(null);
  const [modalObert, setModalObert] = React.useState<boolean>(true);
  const url = construeixUrlForms(config.forms.urlPlantilla, estat.matricula);
  const diagnostic = diagnosticaPlantilla(config.forms.urlPlantilla);
  const fitxer = nomFitxer(estat.matricula);

  const obreFormulari = (): void => {
    // Ha de ser dins del gestor del clic per evitar el bloqueig de finestres emergents (RF-13).
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <section className={styles.pantalla}>
      <h1 className={styles.titol}>{t('p6.titol')}</h1>
      <p className={styles.text}>{t('p6.text')}</p>
      {senseConnexio && (
        <p className={styles.nota} role="status" data-offline="">
          {t('p6.senseConnexio')}
        </p>
      )}
      {!url && (
        <p className={styles.error} role="alert">
          {t(CLAU_DIAGNOSTIC[diagnostic] ?? 'p6.sensePlantilla')}
        </p>
      )}
      <div className={styles.accions}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })}>
          {t('nav.enrere')}
        </Boto>
        <Boto variant="secundari" refBoto={botoInstruccions} onClick={() => setModalObert(true)}>
          {t('p6.mostrarInstruccions')}
        </Boto>
        <Boto onClick={() => dispatch({ tipus: 'ENDAVANT' })}>{t('p6.jaEnviat')}</Boto>
      </div>

      {modalObert && (
        <Modal
          titol={t('p6.modalTitol')}
          onTancar={() => setModalObert(false)}
          retornaFocusA={() => botoInstruccions.current ?? undefined}
        >
          <ol className={styles.passos}>
            <li>
              <TextRic text={t('p6.pas1')} />
            </li>
            <li>
              <TextRic text={t('p6.pas2')} />
            </li>
            <li>
              <TextRic text={t('p6.pas3', { fitxer })} />
            </li>
            <li>
              <TextRic text={t('p6.pas4')} />
            </li>
          </ol>
          <div className={styles.accions}>
            <Boto onClick={obreFormulari} disabled={!url}>
              {t('p6.obrir')}
            </Boto>
          </div>
          {url && (
            <p className={styles.text}>
              <a href={url} target="_blank" rel="noopener noreferrer" className={styles.enllac}>
                {t('p6.enllac')}
              </a>
            </p>
          )}
        </Modal>
      )}
    </section>
  );
};
