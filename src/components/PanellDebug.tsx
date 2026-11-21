import * as React from 'react';
import { useApp } from '../app/AppContext';
import { t } from '../i18n';
import { verificaRecursos, type IResultatRecurs } from '../recursos/autoverificacio';
import styles from '../styles/brand.module.css';
import { DATA_COMPILACIO, VERSIO } from '../versio';

function hostDe(url: string): string {
  try {
    return new URL(url.replace('{MATRICULA}', 'X')).host;
  } catch {
    return '?';
  }
}

/** Panell mínim del mode diagnòstic (RF-18, base): versió, data de compilació i resum de la configuració. Mai cap imatge. */
export const PanellDebug: React.FC = () => {
  const { config, funcionalitats } = useApp();
  const [comprovant, setComprovant] = React.useState(false);
  const [resultats, setResultats] = React.useState<IResultatRecurs[] | undefined>(undefined);

  const comprova = (): void => {
    setComprovant(true);
    verificaRecursos()
      .then(setResultats)
      .catch((e: unknown) =>
        setResultats([
          { nom: '*', ok: false, mida: 0, comprimit: false, motiu: e instanceof Error ? e.message : String(e) }
        ])
      )
      .finally(() => setComprovant(false));
  };

  const resum = t('debug.configResum', {
    regex: config.matriculaRegex,
    maxFotos: config.maxFotos,
    ppp: config.sortida.ppp,
    host: hostDe(config.forms.urlPlantilla),
    llindars: Object.keys(config.llindars).length
  });
  const [mediapipe, setMediapipe] = React.useState<string | undefined>(undefined);
  const provaMediapipe = (): void => {
    setMediapipe(t('debug.comprovant'));
    // Càrrega diferida: MediaPipe només es toca si es demana explícitament des d'aquí.
    import('../vision/mediapipe')
      .then((m) => m.provaCarregaFaceLandmarker())
      .then((r) => setMediapipe(t('debug.mediapipeOk', { delegat: r.delegat, ms: r.ms })))
      .catch((e: unknown) =>
        setMediapipe(t('debug.mediapipeError', { motiu: e instanceof Error ? e.message : String(e) }))
      );
  };
  const nOk = resultats?.filter((r) => r.ok).length ?? 0;

  return (
    <aside className={styles.debug} aria-label={t('debug.titol')} data-debug="">
      <h2 className={styles.debugTitol}>{t('debug.titol')}</h2>
      <p className={styles.debugText}>{t('debug.ajuda')}</p>
      <p className={styles.debugText}>
        {t('debug.versio')}: <b id="debug-versio">{VERSIO}</b> · {t('debug.dataCompilacio')}:{' '}
        <b id="debug-data">{DATA_COMPILACIO}</b>
      </p>
      <p className={styles.debugText}>
        {t('debug.config')}: {resum}
      </p>
      <p className={styles.debugText}>
        {t('debug.funcionalitats')}: {JSON.stringify(funcionalitats)}
      </p>
      <p className={styles.debugText}>
        <button type="button" className={styles.botoSecundari} onClick={comprova} disabled={comprovant}>
          {comprovant ? t('debug.comprovant') : t('debug.comprovaRecursos')}
        </button>
      </p>
      <p className={styles.debugText}>
        <button type="button" className={styles.botoSecundari} onClick={provaMediapipe}>
          {t('debug.provaMediapipe')}
        </button>
      </p>
      {mediapipe && (
        <p className={styles.debugText} id="debug-mediapipe" aria-live="polite">
          {mediapipe}
        </p>
      )}
      {resultats && (
        <div id="debug-recursos" aria-live="polite">
          <p className={styles.debugText}>
            {t('debug.recursos')} — {t('debug.resum', { ok: nOk, total: resultats.length })}
          </p>
          <ul className={styles.debugLlista}>
            {resultats.map((r) => (
              <li key={r.nom} data-ok={r.ok ? 'true' : 'false'}>
                {r.ok
                  ? t('debug.recursOk', {
                      nom: r.nom,
                      mida: r.mida,
                      compressio: t(r.comprimit ? 'debug.comprimit' : 'debug.sensecomprimir')
                    })
                  : t('debug.recursError', { nom: r.nom, motiu: r.motiu ?? '?' })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};
