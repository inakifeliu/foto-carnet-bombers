import * as React from 'react';
import { useApp } from '../app/AppContext';
import { useDebug } from '../app/useDebug';
import { CLAU_ERROR_CAMERA } from '../captura/camera';
import { creaFoto } from '../captura/fotos';
import { processaCaptura } from '../captura/processaCaptura';
import { useCamera } from '../captura/useCamera';
import { Boto } from '../components/Boto';
import { Miniatura } from '../components/Miniatura';
import { Modal } from '../components/Modal';
import { OverlayDiagnostic } from '../components/OverlayDiagnostic';
import { Semafor } from '../components/Semafor';
import { SiluetaGuia } from '../components/SiluetaGuia';
import { t, type ClauI18n } from '../i18n';
import { Titol } from '../components/Titol';
import styles from '../styles/brand.module.css';
import { useAnalisi } from '../vision/useAnalisi';
import { useModels } from '../vision/useModels';
import { ORDRE_PRIORITAT } from '../vision/tipus';

/** Una avaluació més antiga que això (bucle aturat, pestanya amagada, vídeo encallat) no autoritza la captura automàtica. */
const MAX_ANTIGUITAT_AVALUACIO_MS = 500;
const REINTENT_FRESCOR_MS = 250;

/**
 * Captura guiada (Fase 2): vídeo en mirall només a la visualització; els models de MediaPipe es carreguen en entrar
 * (RF-02, RF-03), el bucle d'anàlisi (RF-04) alimenta els semàfors (RF-05) i el missatge principal. La foto es fa a
 * resolució completa sobre un canvas SENSE mirall (RF-06), s'hi tornen a calcular els controls (puntuació) i es
 * retalla amb RF-07 (retall centrat simple si no hi ha cara). La captura és MANUAL; si hi ha controls no verds
 * es demana confirmació. Captura automàtica (Fase 3): amb tots els controls verds de manera sostinguda
 * (`config.captura.segonsEstableAbansCompte`) s'inicia un compte enrere (`config.captura.compteEnrere`) i es fa la
 * foto; es cancel·la si algun control passa a vermell. No conviu amb el temporitzador manual (el manual preval) i,
 * un cop feta la foto, no es reinicia fins que l'usuari tria «Fer-ne una altra». Només es fia d'una avaluació fresca
 * (< 500 ms) i amb la pàgina visible. Un error de captura o «Cancel·lar» la bloquegen fins que els controls tornin a
 * passar per no-verd. Sense anàlisi no hi ha captura automàtica.
 */
export const P3Captura: React.FC = () => {
  const { config, funcionalitats, dispatch, fotos, afegeixFoto } = useApp();
  const camera = useCamera();
  const debug = useDebug();
  const models = useModels(config, funcionalitats.webGL2, funcionalitats.webGL);
  const [confirmant, setConfirmant] = React.useState<boolean>(false);
  const video = React.useRef<HTMLVideoElement>(null);
  const [revisio, setRevisio] = React.useState<boolean>(false);
  const [errorCaptura, setErrorCaptura] = React.useState<boolean>(false);
  const [ocupat, setOcupat] = React.useState<boolean>(false);
  // Només es pot fer la foto quan el vídeo ja té fotograma (videoWidth > 0).
  const [videoListo, setVideoListo] = React.useState<boolean>(false);
  const botoAltra = React.useRef<HTMLButtonElement>(null);
  const botoProu = React.useRef<HTMLButtonElement>(null);
  const botoFeta = React.useRef<HTMLButtonElement>(null);
  // Temporitzador: segons que falten per fer la foto (undefined = inactiu).
  const [compte, setCompte] = React.useState<number | undefined>(undefined);
  // Captura automàtica: segons que falten (undefined = no hi ha compte automàtic en marxa).
  const [compteAuto, setCompteAuto] = React.useState<number | undefined>(undefined);
  // Captura automàtica bloquejada (error de captura o «Cancel·lar»): només es reactiva quan els controls deixen de
  // ser tots verds i hi tornen a ser, o quan l'usuari fa «Fer-ne una altra».
  const [bloquejatAuto, setBloquejatAuto] = React.useState<boolean>(false);
  // Guarda síncrona contra dobles captures (l'estat `ocupat` només es veu al render següent).
  const ocupatRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    const el = video.current;
    setVideoListo(false);
    if (el) {
      el.srcObject = camera.flux ?? null;
    }
  }, [camera.flux]);

  const alVideoListo = (): void => setVideoListo((video.current?.videoWidth ?? 0) > 0);

  const maxAssolit = fotos.length >= config.maxFotos;
  const enRevisioAnalisi = revisio || maxAssolit;
  const analisi = useAnalisi({
    video,
    analitzador: models.analitzador,
    actiu: models.estat === 'llest' && camera.flux !== undefined && videoListo && !enRevisioAnalisi,
    fluxId: camera.flux,
    config,
    delegat: models.delegat
  });
  const analisiDisponible = models.estat === 'llest' && !analisi.error && !analisi.massaLent;

  const fesFoto = async (): Promise<void> => {
    const el = video.current;
    if (!el || el.videoWidth === 0 || ocupat || ocupatRef.current) {
      return;
    }
    ocupatRef.current = true;
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
      // RF-06/RF-07: controls recalculats sobre el fotograma complet, puntuació i retall intel·ligent.
      const captura = processaCaptura(completa, models.analitzador, config);
      retallada = captura.retallada;
      afegeixFoto(await creaFoto(retallada, { puntuacio: captura.puntuacio, avisos: captura.avisos }));
      setRevisio(true);
    } catch {
      // Si `creaFoto` falla, ningú no s'endú el canvas retallat: s'allibera aquí.
      if (retallada) {
        retallada.width = 0;
        retallada.height = 0;
      }
      setErrorCaptura(true);
      // Sense bucle de reintents: la captura automàtica no es reactiva fins que els controls tornin a passar per no-verd.
      setBloquejatAuto(true);
    } finally {
      if (completa) {
        completa.width = 0;
        completa.height = 0;
      }
      ocupatRef.current = false;
      setOcupat(false);
    }
  };

  /** Botó «Fer la foto ara»: amb controls no verds demana confirmació (spec P3). */
  const alClicFeta = (): void => {
    // Preval sobre qualsevol compte (manual o automàtic): es cancel·la i es fa la foto amb la confirmació habitual.
    setCompte(undefined);
    cancelaAuto();
    if (analisiDisponible && !analisi.avaluacio?.totOk) {
      setConfirmant(true);
    } else {
      void fesFoto();
    }
  };

  const potCapturar = camera.flux !== undefined && !camera.carregant && videoListo && !revisio && !maxAssolit;

  // Temporitzador de 5 s: compte enrere d'un segon en un segon i, en arribar a 0, foto directa (sense confirmació:
  // la persona ja s'ha col·locat). Es cancel·la si es perd la càmera o es surt de la pantalla (neteja de l'efecte).
  const fesFotoRef = React.useRef(fesFoto);
  fesFotoRef.current = fesFoto;
  React.useEffect(() => {
    if (compte === undefined) {
      return undefined;
    }
    if (!potCapturar) {
      setCompte(undefined);
      return undefined;
    }
    const id = window.setTimeout(() => {
      if (compte <= 1) {
        setCompte(undefined);
        void fesFotoRef.current();
      } else {
        setCompte(compte - 1);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [compte, potCapturar]);
  const enRevisio = revisio || maxAssolit;

  // --- Captura automàtica -------------------------------------------------------------------------------------
  // Condicions per poder començar: anàlisi disponible, càmera llesta, cap altra captura/temporitzador/avís en marxa.
  const autoPossible = analisiDisponible && potCapturar && !ocupat && !confirmant && compte === undefined;
  const avaluacioOk = analisiDisponible && analisi.avaluacio?.totOk === true;
  const totOk = autoPossible && avaluacioOk && !bloquejatAuto;
  const hiHaAvaluacio = analisi.avaluacio !== undefined;
  const hiHaVermell = analisi.avaluacio
    ? Object.values(analisi.avaluacio.controls).some((c) => c.estat === 'error')
    : false;
  const segonsEstable = config.captura.segonsEstableAbansCompte;
  const segonsCompte = config.captura.compteEnrere;

  const ultimaAvaluacioTs = analisi.ultimaAvaluacioTs;
  /** L'avaluació és recent i la pàgina és visible (si no, l'estat de React pot ser obsolet). */
  const avaluacioFresca = React.useCallback((): boolean => {
    const ts = ultimaAvaluacioTs.current;
    return ts !== undefined && !document.hidden && performance.now() - ts <= MAX_ANTIGUITAT_AVALUACIO_MS;
  }, [ultimaAvaluacioTs]);

  // El bloqueig s'aixeca quan els controls deixen de ser tots verds.
  React.useEffect(() => {
    if (!avaluacioOk) {
      setBloquejatAuto(false);
    }
  }, [avaluacioOk]);

  // Amb la pàgina amagada el bucle d'anàlisi s'atura: es cancel·la el compte automàtic.
  React.useEffect(() => {
    const alCanviVisibilitat = (): void => {
      if (document.hidden) {
        setCompteAuto(undefined);
      }
    };
    document.addEventListener('visibilitychange', alCanviVisibilitat);
    return () => document.removeEventListener('visibilitychange', alCanviVisibilitat);
  }, []);

  // 1) Tot verd de manera sostinguda -> comença el compte (només amb una avaluació fresca; si no, reintenta d'aquí a poc).
  //    Qualsevol canvi de `totOk` el reinicia.
  React.useEffect(() => {
    if (!totOk || compteAuto !== undefined) {
      return undefined;
    }
    let id: number | undefined;
    const prova = (): void => {
      if (avaluacioFresca()) {
        setCompteAuto(segonsCompte);
      } else {
        id = window.setTimeout(prova, REINTENT_FRESCOR_MS);
      }
    };
    id = window.setTimeout(prova, segonsEstable * 1000);
    return () => window.clearTimeout(id);
  }, [totOk, compteAuto, segonsEstable, segonsCompte, avaluacioFresca]);

  // 2) Compte enrere: un segon a cada pas; es cancel·la si es perd la possibilitat de capturar o hi ha un vermell.
  React.useEffect(() => {
    if (compteAuto === undefined) {
      return undefined;
    }
    if (!autoPossible || hiHaVermell || !hiHaAvaluacio) {
      setCompteAuto(undefined);
      return undefined;
    }
    const id = window.setTimeout(() => {
      if (!avaluacioFresca()) {
        setCompteAuto(undefined);
      } else if (compteAuto <= 1) {
        setCompteAuto(undefined);
        void fesFotoRef.current();
      } else {
        setCompteAuto(compteAuto - 1);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [compteAuto, autoPossible, hiHaVermell, hiHaAvaluacio, avaluacioFresca]);

  /** Els botons manuals tenen prioritat: cancel·len qualsevol compte automàtic en marxa. */
  const cancelaAuto = (): void => setCompteAuto(undefined);
  const compteVisible = compte ?? compteAuto;

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
      <Titol>{t('p3.titol')}</Titol>
      <p className={styles.nota} data-nota-p3="">
        {t(analisiDisponible ? 'p3.nota' : 'p3.notaSenseAnalisi')}
      </p>
      {camera.flux !== undefined && (
        <p className={styles.text} data-consell-camera={camera.mirall ? 'selfie' : 'posterior'}>
          {t(camera.mirall ? 'p3.consellSelfie' : 'p3.consellPosterior')}
        </p>
      )}

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
        <div className={camera.mirall ? styles.visor : `${styles.visor} ${styles.visorSenseMirall}`}>
          {/* El mirall és només CSS (transform) a la visualització i només amb la càmera frontal o la webcam;
              el canvas de captura no el té mai. Amb la càmera posterior es veu l'escena tal com és. */}
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
          {debug && <OverlayDiagnostic />}
          <SiluetaGuia />
          {compteVisible !== undefined && (
            <span className={styles.compteEnrere} aria-hidden="true" data-compte-enrere="">
              {compteVisible}
            </span>
          )}
        </div>
        <div className={styles.panell}>
          <div className={styles.guia} role="status" aria-live="polite" aria-atomic="true">
            {compte !== undefined
              ? t('p3.compteEnrere', { n: 5 })
              : compteAuto !== undefined
                ? t('p3.compteAuto', { n: segonsCompte })
                : revisio
                  ? t('p3.capturada', { n: fotos.length })
                  : t(analisi.missatge ?? 'p3.guia')}
          </div>
          {models.estat === 'carregant' && (
            <p className={styles.guiaCarregant} data-carregant-models="">
              {t('p3.carregantModels')}
            </p>
          )}
          {models.estat === 'noDisponible' && (
            <p className={styles.nota} data-analisi-no-disponible="">
              {t('p3.senseWebgl')}
            </p>
          )}
          {(models.estat === 'error' || analisi.error || analisi.massaLent) && (
            <p className={styles.nota} data-error-models="">
              {t(analisi.error ? 'p3.errorAnalisi' : analisi.massaLent ? 'p3.analisiMassaLenta' : 'p3.errorModels')}
            </p>
          )}
          {analisiDisponible && !enRevisio && (
            <ul
              className={`${styles.semafors} ${styles.semaforsPanell}`}
              aria-label={t('p3.semafors')}
              data-semafors=""
            >
              {ORDRE_PRIORITAT.map((clau) => (
                <Semafor
                  key={clau}
                  etiqueta={t(`p3.semafor.${clau}` as ClauI18n)}
                  estat={analisi.avaluacio?.controls[clau].estat ?? 'cap'}
                />
              ))}
            </ul>
          )}
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

      <div className={`${styles.accions} ${styles.accionsCaptura}`}>
        <Boto variant="secundari" onClick={() => dispatch({ tipus: 'ENRERE' })} disabled={ocupat}>
          {t('nav.enrere')}
        </Boto>
        {enRevisio ? (
          <>
            {!maxAssolit && (
              <Boto
                variant="secundari"
                refBoto={botoAltra}
                onClick={() => {
                  setBloquejatAuto(false);
                  setRevisio(false);
                }}
              >
                {t('p3.altra')}
              </Boto>
            )}
            <Boto refBoto={botoProu} onClick={() => dispatch({ tipus: 'ENDAVANT' })}>
              {t('p3.prouFotos')}
            </Boto>
          </>
        ) : (
          <>
            {compteVisible !== undefined && (
              <Boto
                variant="secundari"
                onClick={() => {
                  if (compteAuto !== undefined) {
                    setBloquejatAuto(true);
                  }
                  setCompte(undefined);
                  cancelaAuto();
                }}
              >
                {t('p3.cancela')}
              </Boto>
            )}
            {compte === undefined && (
              <Boto
                variant="secundari"
                onClick={() => {
                  cancelaAuto();
                  setCompte(5);
                }}
                disabled={!potCapturar || ocupat}
              >
                {t('p3.temporitzador')}
              </Boto>
            )}
            <Boto refBoto={botoFeta} onClick={alClicFeta} disabled={!potCapturar || ocupat}>
              {t('p3.feta')}
            </Boto>
          </>
        )}
      </div>

      {confirmant && (
        <Modal
          titol={t('p3.confirmaTitol')}
          onTancar={() => setConfirmant(false)}
          textTancar={t('p3.confirmaNo')}
          retornaFocusA={() => botoFeta.current ?? undefined}
        >
          <p>{t('p3.confirmaText')}</p>
          <p>
            <Boto
              onClick={() => {
                setConfirmant(false);
                void fesFoto();
              }}
            >
              {t('p3.confirmaSi')}
            </Boto>
          </p>
        </Modal>
      )}
    </section>
  );
};
