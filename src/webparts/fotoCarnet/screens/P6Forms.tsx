import * as React from 'react';
import { useApp } from '../app/AppContext';
import { construeixUrlForms, nomFitxer } from '../app/formulari';
import { Boto } from '../components/Boto';
import { Modal } from '../components/Modal';
import { TextRic } from '../components/TextRic';
import { t } from '../i18n';
import styles from '../styles/brand.module.scss';

export const P6Forms: React.FC = () => {
  const { estat, config, dispatch } = useApp();
  const [modalObert, setModalObert] = React.useState<boolean>(true);
  const url = construeixUrlForms(config.forms.urlPlantilla, estat.matricula);
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
      {!url && (
        <p className={styles.error} role="alert">
          {t('p6.sensePlantilla')}
        </p>
      )}
      <div className={styles.accions}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })}>
          {t('nav.enrere')}
        </Boto>
        <Boto variant="secundari" onClick={() => setModalObert(true)}>
          {t('p6.mostrarInstruccions')}
        </Boto>
        <Boto onClick={() => dispatch({ tipus: 'ENDAVANT' })}>{t('p6.jaEnviat')}</Boto>
      </div>

      {modalObert && (
        <Modal titol={t('p6.modalTitol')} onTancar={() => setModalObert(false)}>
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
