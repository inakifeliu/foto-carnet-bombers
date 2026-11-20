import * as React from 'react';
import { useApp } from '../app/AppContext';
import { validaMatricula } from '../app/formulari';
import { Boto } from '../components/Boto';
import { TextRic } from '../components/TextRic';
import { t } from '../i18n';
import styles from '../styles/brand.module.scss';

export const P2Matricula: React.FC = () => {
  const { estat, config, dispatch } = useApp();
  const [valor, setValor] = React.useState<string>(estat.matricula);
  const [tocat, setTocat] = React.useState<boolean>(false);

  const resultat = validaMatricula(valor, config.matriculaRegex);
  // El botó sempre està actiu: l'error es mostra en intentar continuar (o en sortir del camp).
  const mostraError = tocat && !resultat.valida;

  const continuar = (): void => {
    setTocat(true);
    if (resultat.valida) {
      dispatch({ tipus: 'DESA_MATRICULA', matricula: resultat.matricula });
      dispatch({ tipus: 'ENDAVANT' });
    }
  };

  return (
    <section className={styles.pantalla}>
      <h1 className={styles.titol}>{t('p2.titol')}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          continuar();
        }}
      >
        <label htmlFor="fc-matricula" className={styles.etiqueta}>
          {t('p2.etiqueta')}
        </label>
        <p id="fc-matricula-ajuda" className={styles.ajuda}>
          {t('p2.ajuda')}
        </p>
        <input
          id="fc-matricula"
          className={styles.camp}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={valor}
          aria-describedby="fc-matricula-ajuda fc-matricula-error"
          aria-invalid={mostraError}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => valor.trim() !== '' && setTocat(true)}
        />
        <div id="fc-matricula-error" role="alert" className={styles.error}>
          {mostraError ? (resultat.regexInvalida ? t('p2.errorConfig') : t('p2.error')) : ''}
        </div>
        {resultat.valida && (
          <p className={styles.confirmacio}>
            <TextRic text={t('p2.confirmacio', { matricula: resultat.matricula })} />
          </p>
        )}
        <div className={styles.accions}>
          <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })}>
            {t('nav.enrere')}
          </Boto>
          <Boto type="submit">{t('p2.continuar')}</Boto>
        </div>
      </form>
    </section>
  );
};
