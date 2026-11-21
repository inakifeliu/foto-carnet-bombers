import * as React from 'react';
import { useApp } from '../app/AppContext';
import { CLAU_ERROR_CAMERA } from '../captura/camera';
import { creaFoto } from '../captura/fotos';
import { retallaCentrat } from '../captura/retall';
import { useCamera } from '../captura/useCamera';
import { Boto } from '../components/Boto';
import { Miniatura } from '../components/Miniatura';
import { SiluetaGuia } from '../components/SiluetaGuia';
import { t } from '../i18n';
import styles from '../styles/brand.module.css';

/**
 * Captura MANUAL (Fase 1): vídeo en mirall només a la visualització; la foto es fa a resolució completa sobre un
 * canvas SENSE mirall (RF-06), es retalla al centre a 35:45 (RF-07 simple) i se'n guarda la miniatura.
 * Els semàfors i la captura automàtica arriben a la Fase 2/3.
 */
export const P3Captura: React.FC = () => {
  const { config, dispatch, fotos, afegeixFoto } = useApp();
  const camera = useCamera();
  const video = React.useRef<HTMLVideoElement>(null);
  const [revisio, setRevisio] = React.useState<boolean>(false);
  const [errorCaptura, setErrorCaptura] = React.useState<boolean>(false);
  const [ocupat, setOcupat] = React.useState<boolean>(false);
  // Només es pot fer la foto quan el vídeo ja té fotograma (videoWidth > 0).
  const [videoListo, setVideoListo] = React.useState<boolean>(false);
  const botoAltra = React.useRef<HTMLButtonElement>(null);
  const botoProu = React.useRef<HTMLButtonElement>(null);
  const botoFeta = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const el = video.current;
    setVideoListo(false);
    if (el) {
      el.srcObject = camera.flux ?? null;
    }
  }, [camera.flux]);

  const alVideoListo = (): void => setVideoListo((video.current?.videoWidth ?? 0) > 0);

  const maxAssolit = fotos.length >= config.maxFotos;

  const fesFoto = async (): Promise<void> => {
    const el = video.current;
    if (!el || el.videoWidth === 0 || ocupat) {
      return;
    }
    setOcupat(true);
    setErrorCaptura(false);
    let completa: HTMLCanvasElement | undefined;
    let retallada: HTMLCanvasElement | undefined;
    try {
      // Resolució completa del fotograma, sense mirall (només es dibuixa, mai es transforma).
      completa = document.createElement('canvas');
      completa.width = el.videoWidth;
      completa.height = el.videoHeight;
      const ctx = completa.getContext('2d');
      if (!ctx) {
        throw new Error('Sense context 2D');
      }
      ctx.drawImage(el, 0, 0, completa.width, completa.height);
      retallada = retallaCentrat(completa, { ppp: config.sortida.ppp });
      afegeixFoto(await creaFoto(retallada));
      setRevisio(true);
    } catch {
      // Si `creaFoto` falla, ningú no s'endú el canvas retallat: s'allibera aquí.
      if (retallada) {
        retallada.width = 0;
        retallada.height = 0;
      }
      setErrorCaptura(true);
    } finally {
      if (completa) {
        completa.width = 0;
        completa.height = 0;
      }
      setOcupat(false);
    }
  };

  const potCapturar = camera.flux !== undefined && !camera.carregant && videoListo && !revisio && !maxAssolit;
  const enRevisio = revisio || maxAssolit;

  // Accessibilitat: en acabar la captura el focus va a l'acció següent (el botó pressionat desapareix).
  const eraRevisio = React.useRef<boolean>(enRevisio);
  React.useEffect(() => {
    if (enRevisio && !eraRevisio.current) {
      (botoAltra.current ?? botoProu.current)?.focus();
    } else if (!enRevisio && eraRevisio.current) {
      botoFeta.current?.focus();
    }
    eraRevisio.current = enRevisio;
  }, [enRevisio]);

  return (
    <section className={styles.pantalla}>
      <h1 className={styles.titol}>{t('p3.titol')}</h1>
      <p className={styles.nota}>{t('p3.nota')}</p>

      {camera.error && (
        <div role="alert" className={styles.error}>
          <p>{t(CLAU_ERROR_CAMERA[camera.error])}</p>
          <Boto variant="secundari" onClick={camera.reintenta}>
            {t('p3.reintentar')}
          </Boto>
        </div>
      )}

      {camera.resolucioBaixa && (
        <p className={styles.nota} role="status" data-avis-resolucio="">
          {t('p3.avisResolucio', camera.resolucioBaixa)}
        </p>
      )}

      {camera.cameres.length > 1 && (
        <p>
          <label htmlFor="fc-camera" className={styles.etiqueta}>
            {t('p3.camera')}
          </label>
          <select
            id="fc-camera"
            className={styles.camp}
            value={camera.deviceIdActual ?? ''}
            onChange={(e) => camera.canviaCamera(e.target.value)}
          >
            {camera.cameres.map((c) => (
              <option key={c.deviceId} value={c.deviceId}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </p>
      )}

      <div className={styles.captura}>
        <div className={styles.visor}>
          {/* El mirall és només CSS (transform) a la visualització; el canvas de captura no el té. */}
          <video
            ref={video}
            className={styles.video}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={alVideoListo}
            onLoadedData={alVideoListo}
            aria-label={t('p3.video')}
            data-camera=""
          />
          {camera.carregant && !camera.error && <span className={styles.visorText}>{t('p3.carregant')}</span>}
          <SiluetaGuia />
        </div>
        <div className={styles.panell}>
          <div className={styles.guia} role="status" aria-live="polite" aria-atomic="true">
            {revisio ? t('p3.capturada', { n: fotos.length }) : t('p3.guia')}
          </div>
          <p className={styles.comptador}>
            {t('p3.comptador', {
              n: Math.min(fotos.length + (enRevisio ? 0 : 1), config.maxFotos),
              max: config.maxFotos
            })}
          </p>
          {errorCaptura && (
            <p className={styles.error} role="alert">
              {t('p3.errorCaptura')}
            </p>
          )}
          {fotos.length > 0 && (
            <ul className={styles.fotos} aria-label={t('p3.miniatures')}>
              {fotos.map((f, i) => (
                <li key={f.id} className={styles.fotoItemPetit}>
                  <Miniatura etiqueta={t('p4.foto', { n: i + 1 })} src={f.url} />
                </li>
              ))}
            </ul>
          )}
          {maxAssolit && <p className={styles.nota}>{t('p3.maximFotos', { max: config.maxFotos })}</p>}
        </div>
      </div>

      <div className={styles.accions}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })}>
          {t('nav.enrere')}
        </Boto>
        {enRevisio ? (
          <>
            {!maxAssolit && (
              <Boto variant="secundari" refBoto={botoAltra} onClick={() => setRevisio(false)}>
                {t('p3.altra')}
              </Boto>
            )}
            <Boto refBoto={botoProu} onClick={() => dispatch({ tipus: 'ENDAVANT' })}>
              {t('p3.prouFotos')}
            </Boto>
          </>
        ) : (
          <Boto refBoto={botoFeta} onClick={() => void fesFoto()} disabled={!potCapturar || ocupat}>
            {t('p3.feta')}
          </Boto>
        )}
      </div>
    </section>
  );
};
