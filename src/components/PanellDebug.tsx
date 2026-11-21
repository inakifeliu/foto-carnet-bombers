import * as React from 'react';
import { useApp } from '../app/AppContext';
import { t, type ClauI18n } from '../i18n';
import { creaDiagnostic, descarregaDiagnostic } from '../vision/diagnostic';
import { estatAnalisi, type IInstantania } from '../vision/estatAnalisi';
import { CLAUS_MESURES, ORDRE_PRIORITAT } from '../vision/tipus';
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

const fmt = (v: number | undefined, decimals = 3): string => (v === undefined ? '—' : v.toFixed(decimals));

/** Valors en directe de l'anàlisi (RF-18): es refresquen com a màxim 4 cops per segon. */
const AnalisiEnDirecte: React.FC = () => {
  const { config } = useApp();
  const [i, setI] = React.useState<IInstantania | undefined>(() => estatAnalisi.llegeix());
  React.useEffect(() => {
    let darrer = 0;
    const cancela = estatAnalisi.subscriu((nou) => {
      const ara = performance.now();
      if (nou === undefined || ara - darrer >= 250) {
        darrer = ara;
        setI(nou);
      }
    });
    return cancela;
  }, []);

  const descarrega = (): void =>
    descarregaDiagnostic(creaDiagnostic(estatAnalisi.llegeix(), config, VERSIO, DATA_COMPILACIO));

  return (
    <div data-debug-analisi="">
      <h3 className={styles.debugTitol}>{t('debug.analisi')}</h3>
      {i ? (
        <>
          <p className={styles.debugText} id="debug-rendiment">
            {t('debug.rendiment', {
              fps: fmt(i.fpsAnalisi, 1),
              ms: fmt(i.msPerFotograma, 1),
              fpsVideo: fmt(i.fpsVideo, 0),
              delegat: i.delegat ?? '?'
            })}
          </p>
          {i.temps && (
            <p className={styles.debugText} id="debug-temps">
              {t('debug.temps', {
                dibuix: fmt(i.temps.dibuix, 1),
                landmarker: fmt(i.temps.landmarker, 1),
                segmentador: fmt(i.temps.segmentador, 1),
                metriques: fmt(i.temps.metriques, 1),
                nivell: i.nivell ?? '?',
                fpsObjectiu: i.fpsObjectiu ?? '?',
                segmentacio: i.segmentacio === false ? 'no disponible' : 'activa'
              })}
            </p>
          )}
          <ul className={styles.debugLlista} id="debug-controls">
            {ORDRE_PRIORITAT.map((clau) => {
              const c = i.avaluacio.controls[clau];
              return (
                <li key={clau} data-control={clau} data-estat={c.estat}>
                  {t('debug.control', {
                    nom: t(`p3.semafor.${clau}` as ClauI18n),
                    valor: fmt(c.valor),
                    estat: c.estat
                  })}
                </li>
              );
            })}
          </ul>
          <p className={styles.debugText} id="debug-mesures">
            {CLAUS_MESURES.map((k) => `${k}=${fmt(i.mesures[k])}`).join(' · ')} · nCares={i.mesures.nCares}
          </p>
        </>
      ) : (
        <p className={styles.debugText}>{t('debug.senseAnalisi')}</p>
      )}
      <p className={styles.debugText}>{t('debug.superposicio')}</p>
      <p className={styles.debugText}>
        <button type="button" className={styles.botoSecundari} onClick={descarrega} id="debug-descarrega">
          {t('debug.descarregaJson')}
        </button>
      </p>
      <p className={styles.debugText}>{t('debug.jsonNota')}</p>
    </div>
  );
};

/** Panell del mode diagnòstic (RF-18): versió, configuració, recursos, MediaPipe i valors en directe de l'anàlisi. Mai cap imatge. */
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
  const [executantMediapipe, setExecutantMediapipe] = React.useState(false);
  const provaMediapipe = (): void => {
    setExecutantMediapipe(true);
    setMediapipe(t('debug.comprovant'));
    // Càrrega diferida: MediaPipe només es toca si es demana explícitament des d'aquí.
    import('../vision/mediapipe')
      .then((m) => m.provaCarregaFaceLandmarker())
      .then((r) => setMediapipe(t('debug.mediapipeOk', { delegat: r.delegat, ms: r.ms })))
      .catch((e: unknown) =>
        setMediapipe(t('debug.mediapipeError', { motiu: e instanceof Error ? e.message : String(e) }))
      )
      .finally(() => setExecutantMediapipe(false));
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
        <button type="button" className={styles.botoSecundari} onClick={provaMediapipe} disabled={executantMediapipe}>
          {executantMediapipe ? t('debug.comprovant') : t('debug.provaMediapipe')}
        </button>
      </p>
      <AnalisiEnDirecte />
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
