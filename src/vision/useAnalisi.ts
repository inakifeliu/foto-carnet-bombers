import * as React from 'react';
import type { IConfig } from '../config/configuracio';
import type { ClauI18n } from '../i18n';
import type { IAnalitzador } from './analitzador';
import { avalua } from './avaluacio';
import { estatAnalisi } from './estatAnalisi';
import { FPS_NORMAL, MitjanaTemps, PressupostAnalisi } from './pressupost';
import { EstabilitzadorMissatge, Suavitzador } from './suavitzat';
import { ORDRE_PRIORITAT, type IAvaluacio } from './tipus';

/** Freqüència objectiu de l'anàlisi en condicions normals (RF-04: ~10-15 fps); el pressupost la pot abaixar. */
export const FPS_ANALISI = FPS_NORMAL;
const FINESTRA_SUAVITZAT_MS = 500;
const ERRORS_SEGUITS_MAXIM = 5;
const MIN_ACTUALITZACIO_UI_MS = 250;

export interface IParamsAnalisi {
  video: React.RefObject<HTMLVideoElement | null>;
  analitzador: IAnalitzador | undefined;
  /** El bucle només corre si és cert (P3 amb càmera, sense estar en revisió). */
  actiu: boolean;
  /** Canvia quan canvia la font de vídeo (canvi de càmera): reinicia el suavitzat. */
  fluxId: unknown;
  config: IConfig;
  delegat?: 'GPU' | 'CPU';
}

export interface IEstatBucle {
  avaluacio?: IAvaluacio;
  /** Missatge principal ja estabilitzat (canvia poc); `p3.msg.totOk` si tot és verd. */
  missatge?: ClauI18n;
  /** El bucle s'ha aturat per errors repetits. */
  error: boolean;
  /** El bucle s'ha aturat perquè l'anàlisi tardava massa (pressupost de temps, vegeu `pressupost.ts`). */
  massaLent: boolean;
}

const signatura = (a: IAvaluacio, missatge: ClauI18n | undefined): string =>
  ORDRE_PRIORITAT.map((c) => a.controls[c].estat).join(',') + '|' + (missatge ?? '');

type VideoAmbCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number) => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/**
 * Bucle d'anàlisi en directe (RF-04). S'engega quan `actiu` i hi ha analitzador, amb `requestVideoFrameCallback`
 * (o `requestAnimationFrame` si no hi és) limitat a ~12 fps; mesura els fps d'anàlisi i els ms per fotograma, suavitza
 * les mesures amb una mitjana mòbil de 0,5 s, les avalua i publica la instantània al mode diagnòstic. S'atura en
 * sortir de P3, en passar a revisió o en canviar de càmera (efecte de neteja). L'estat de React només s'actualitza
 * quan canvien els semàfors o el missatge (o cada 0,25 s), de manera que el lector de pantalla no sent spam.
 */
export function useAnalisi({
  video,
  analitzador,
  actiu,
  fluxId,
  config,
  delegat
}: IParamsAnalisi): IEstatBucle & { ultimaAvaluacioTs: React.MutableRefObject<number | undefined> } {
  const [estat, setEstat] = React.useState<IEstatBucle>({ error: false, massaLent: false });
  // Instant (performance.now) de l'última avaluació feta; undefined si el bucle no corre. A diferència de l'estat, s'actualitza a cada anàlisi.
  const ultimaAvaluacioTs = React.useRef<number | undefined>(undefined);
  const llindars = config.llindars;

  React.useEffect(() => {
    if (!actiu || !analitzador) {
      return;
    }
    let aturat = false;
    // L'element de vídeo en engegar el bucle (el mateix al qual es cancel·la la crida en netejar).
    const elementInicial = video.current as VideoAmbCallback | null;
    let idVideo: number | undefined;
    let idRaf: number | undefined;
    let errorsSeguits = 0;
    let ultimaAnalisi = -Infinity;
    const pressupost = new PressupostAnalisi();
    const tempsPerPas = new MitjanaTemps();
    let ultimaUi = -Infinity;
    let ultimaSignatura = '';
    let darrerFpsVideo: { ts: number; fotogrames: number } | undefined;
    let fpsVideo: number | undefined;
    const suavitzador = new Suavitzador(FINESTRA_SUAVITZAT_MS);
    const estabilitzador = new EstabilitzadorMissatge<ClauI18n>(3);
    const instants: number[] = [];
    ultimaAvaluacioTs.current = undefined;
    setEstat({ error: false, massaLent: false });

    const programa = (): void => {
      const v = video.current as VideoAmbCallback | null;
      if (aturat || !v) {
        return;
      }
      if (typeof v.requestVideoFrameCallback === 'function') {
        idVideo = v.requestVideoFrameCallback((now) => pas(now));
      } else {
        idRaf = requestAnimationFrame((now) => pas(now));
      }
    };

    const pas = (now: number): void => {
      if (aturat) {
        return;
      }
      programa();
      const v = video.current;
      if (!v || v.videoWidth === 0 || v.readyState < 2 || now - ultimaAnalisi < 1000 / pressupost.fps - 4) {
        return;
      }
      ultimaAnalisi = now;
      const t0 = performance.now();
      try {
        const mostra = analitzador.analitza(v, v.videoWidth, v.videoHeight, { segmentaCada: pressupost.segmentaCada });
        errorsSeguits = 0;
        const t1 = performance.now();
        const nivell = pressupost.registra(t1 - t0);
        const temps = tempsPerPas.afegeix(mostra.temps, mostra.segmentat);
        instants.push(t1);
        while (instants.length > 1 && t1 - instants[0] > 2000) {
          instants.shift();
        }
        const fps = instants.length > 1 ? ((instants.length - 1) * 1000) / (t1 - instants[0]) : 0;
        // fps del vídeo mostrat (RF, Rendiment: ≥ 24): fotogrames presentats pel navegador, mesurats cada ~1 s.
        const q = v.getVideoPlaybackQuality?.();
        if (q) {
          if (!darrerFpsVideo) {
            darrerFpsVideo = { ts: t1, fotogrames: q.totalVideoFrames };
          } else if (t1 - darrerFpsVideo.ts >= 1000) {
            fpsVideo = ((q.totalVideoFrames - darrerFpsVideo.fotogrames) * 1000) / (t1 - darrerFpsVideo.ts);
            darrerFpsVideo = { ts: t1, fotogrames: q.totalVideoFrames };
          }
        }
        const mesures = suavitzador.afegeix(t1, mostra.mesures);
        const avaluacio = avalua(mesures, llindars, { segmentacio: mostra.segmentacio });
        ultimaAvaluacioTs.current = t1;
        const candidat: ClauI18n | undefined = avaluacio.totOk ? 'p3.msg.totOk' : avaluacio.missatge;
        const missatge = estabilitzador.push(candidat);
        estatAnalisi.publica({
          ts: t1,
          ample: mostra.ample,
          alt: mostra.alt,
          mesures,
          avaluacio,
          retall: mostra.retall,
          zonaFons: mostra.zonaFons,
          zonaTors: mostra.zonaTors,
          zonaCara: mostra.zonaCara,
          mascara: mostra.mascara,
          landmarks: mostra.landmarks,
          fpsAnalisi: fps,
          msPerFotograma: pressupost.msMitja,
          fpsVideo,
          delegat,
          temps,
          nivell,
          fpsObjectiu: pressupost.fps,
          segmentacio: mostra.segmentacio
        });
        const sig = signatura(avaluacio, missatge);
        if (sig !== ultimaSignatura || t1 - ultimaUi >= MIN_ACTUALITZACIO_UI_MS) {
          // La regió d'estat només canvia de text quan canvia el missatge: aria-live no repeteix res.
          ultimaSignatura = sig;
          ultimaUi = t1;
          setEstat({ avaluacio, missatge, error: false, massaLent: false });
        }
        if (nivell === 'aturat') {
          // Equip massa lent (>150 ms sostinguts): s'abandona l'anàlisi en directe; la captura manual continua.
          console.warn(`[analisi] aturada: ${pressupost.msMitja.toFixed(0)} ms per fotograma de mitjana`);
          aturat = true;
          estatAnalisi.publica(undefined);
          setEstat({ error: false, massaLent: true });
        }
      } catch (e) {
        console.warn('[analisi] error:', e instanceof Error ? e.message : String(e));
        errorsSeguits++;
        if (errorsSeguits >= ERRORS_SEGUITS_MAXIM) {
          aturat = true;
          estatAnalisi.publica(undefined);
          setEstat({ error: true, massaLent: false });
        }
      }
    };

    programa();
    return (): void => {
      aturat = true;
      if (idVideo !== undefined && elementInicial?.cancelVideoFrameCallback) {
        elementInicial.cancelVideoFrameCallback(idVideo);
      }
      if (idRaf !== undefined) {
        cancelAnimationFrame(idRaf);
      }
      ultimaAvaluacioTs.current = undefined;
      suavitzador.reinicia();
      estabilitzador.reinicia();
      estatAnalisi.publica(undefined);
    };
  }, [actiu, analitzador, fluxId, llindars, delegat, video]);

  return { ...estat, ultimaAvaluacioTs };
}
