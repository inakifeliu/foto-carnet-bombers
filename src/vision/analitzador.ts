/**
 * Analitzador de fotogrames (RF-02, RF-03, RF-04): redueix el fotograma a ~640 px d'amplada, hi executa el Face
 * Landmarker i, si cal, l'Image Segmenter (mode VIDEO) i en calcula les mesures de RF-05 (`calculaMesures`, pur).
 *
 * El mateix camí es fa servir al bucle en directe i a la captura (RF-06). A la captura s'hi passa el fotograma
 * COMPLET de la càmera (el canvas sense mirall); els models i les mètriques de píxels treballen sobre la còpia
 * reduïda d'aquest fotograma (mateixa escala que en directe, que és la qual s'han de calibrar els llindars) i els
 * landmarks, normalitzats, es reaprofiten sobre la resolució completa per al retall (RF-07).
 *
 * Rendiment (tot és síncron al fil principal):
 *  - Al bucle en directe el segmentador només corre cada `segmentaCada` anàlisis (~3-4 Hz) i amb una entrada reduïda
 *    (`AMPLADA_SEGMENTACIO_DIRECTE` px d'amplada); entre segmentacions es reaprofita l'última màscara AMB LES SEVES
 *    MIDES (és una cosa normalitzada: les mètriques de `mesures.ts` projecten fotograma → màscara per proporció, de manera
 *    que la mida de la màscara no ha de coincidir amb la de la imatge). Si la cara desapareix o la màscara té més de
 *    `EDAT_MAXIMA_MASCARA_MS`, s'oblida.
 *  - A la captura sempre se segmenta, sobre la mateixa còpia de ~640 px (resolució actual) i sense tocar la memòria cau.
 *
 * Segmentador OPCIONAL: sense segmentador (no s'ha pogut carregar) o després de `FALLADES_SEGMENTACIO_MAXIM` errors
 * seguits, la segmentació es desactiva i `mostra.segmentacio` és false (fons, polo i espatlles passen a «no disponible»);
 * un error de segmentació mai no propaga: el Face Landmarker continua.
 *
 * MODE VIDEO a la captura: es fa servir `detectForVideo` amb una marca de temps estrictament creixent (comuna a
 * tot l'analitzador) en comptes de canviar el model a mode IMAGE: evita reconfigurar els models i el seguiment
 * temporal ja és escalfat. El cost és que el resultat pot heretar una mica de suavitzat temporal del seguiment.
 */
import type { IConfig } from '../config/configuracio';
import { marcaTemps } from './marcaTemps';
import type { IModels } from './mediapipe';
import { calculaMesures, centreCaraMascara, normalitzaMascara, type IResultatMesures } from './mesures';
import type { IMascara, IMatriu, IPunt, ITempsPas } from './tipus';

export { marcaTemps };

/** Amplada (px) de la imatge d'entrada als models i a les mètriques (spec §5, Rendiment). */
export const AMPLADA_ANALISI = 640;
/** Amplada (px) de l'entrada del segmentador durant el bucle en directe (a la captura es fa servir la de 640 px). */
export const AMPLADA_SEGMENTACIO_DIRECTE = 256;
/** Cada quantes anàlisis en directe es torna a segmentar (si no se'n demana una altra a cada crida). */
export const SEGMENTA_CADA_PER_DEFECTE = 3;
/** Errors de segmentació seguits a partir dels quals es desactiva la segmentació. */
export const FALLADES_SEGMENTACIO_MAXIM = 3;
/** Edat màxima (ms) d'una màscara reaprofitada. */
export const EDAT_MAXIMA_MASCARA_MS = 1000;

export interface IMostra extends IResultatMesures {
  /** Mida del fotograma analitzat (px). */
  ample: number;
  alt: number;
  /** Landmarks de la primera cara (si n'hi ha). */
  landmarks?: IPunt[];
  /** Temps de cada pas d'aquesta anàlisi (ms); `segmentador` és 0 si no s'ha segmentat. */
  temps: ITempsPas;
  /** S'ha executat el segmentador en aquesta anàlisi (si no, la màscara, si n'hi ha, és la de l'última segmentació). */
  segmentat: boolean;
  /** Hi ha segmentació disponible (fals: no hi ha segmentador o s'ha desactivat per errors repetits). */
  segmentacio: boolean;
}

export interface IOpcionsAnalitza {
  /** Captura (RF-06): sempre se segmenta, amb l'entrada de 640 px i sense usar la memòria cau de màscara. */
  captura?: boolean;
  /** Cada quantes anàlisis se segmenta (només en directe). Per defecte, el de l'analitzador. */
  segmentaCada?: number;
}

export interface IAnalitzador {
  /** Analitza un fotograma (vídeo o canvas). `ample × alt` és la mida original de la font. */
  analitza: (font: CanvasImageSource, ample: number, alt: number, opcions?: IOpcionsAnalitza) => IMostra;
  /** Allibera els canvas i buffers d'anàlisi (RF-16). */
  allibera: () => void;
}

export interface IOpcionsAnalitzador {
  segmentaCada?: number;
}

export function creaAnalitzador(
  models: IModels,
  config: IConfig,
  opcionsAnalitzador: IOpcionsAnalitzador = {}
): IAnalitzador {
  let canvas: HTMLCanvasElement | undefined = document.createElement('canvas');
  let ctx: CanvasRenderingContext2D | null = null;
  let canvasSeg: HTMLCanvasElement | undefined;
  let ctxSeg: CanvasRenderingContext2D | null = null;

  let segmentacioActiva = models.segmenter !== undefined;
  let fallades = 0;
  /** Última màscara normalitzada (en directe) i quan es va fer; es reaprofita entre segmentacions. */
  let cau: { mascara: IMascara; ts: number } | undefined;
  let analisisDesDeSegmentar = 0;

  /** Entrada del segmentador: el canvas de 640 px o, en directe, una còpia reduïda d'`AMPLADA_SEGMENTACIO_DIRECTE` px. */
  const entradaSegmentacio = (
    principal: HTMLCanvasElement,
    w: number,
    h: number,
    captura: boolean
  ): HTMLCanvasElement => {
    if (captura || w <= AMPLADA_SEGMENTACIO_DIRECTE) {
      return principal;
    }
    const ws = AMPLADA_SEGMENTACIO_DIRECTE;
    const hs = Math.max(1, Math.round((h * ws) / w));
    if (!canvasSeg) {
      canvasSeg = document.createElement('canvas');
    }
    if (canvasSeg.width !== ws || canvasSeg.height !== hs || !ctxSeg) {
      canvasSeg.width = ws;
      canvasSeg.height = hs;
      ctxSeg = canvasSeg.getContext('2d');
    }
    if (!ctxSeg) {
      return principal;
    }
    ctxSeg.drawImage(principal, 0, 0, ws, hs);
    return canvasSeg;
  };

  /** Una segmentació. Retorna la màscara normalitzada (mides pròpies) o undefined; no llança mai. */
  const segmenta = (
    entrada: HTMLCanvasElement,
    marca: number,
    centre: { x: number; y: number },
    reutilitza: IMascara | undefined
  ): IMascara | undefined => {
    const segmentador = models.segmenter;
    if (!segmentador) {
      return undefined;
    }
    try {
      let mascara: IMascara | undefined;
      segmentador.segmentForVideo(entrada, marca, (r) => {
        const m = r.categoryMask;
        if (m) {
          // El buffer de MediaPipe només és vàlid durant la crida de retorn: es normalitza aquí mateix (còpia).
          mascara = normalitzaMascara({ data: m.getAsUint8Array(), w: m.width, h: m.height }, centre, reutilitza);
        }
      });
      if (!mascara) {
        throw new Error('El segmentador no ha retornat cap màscara');
      }
      fallades = 0;
      return mascara;
    } catch (e) {
      fallades++;
      console.warn('[analisi] error de segmentació:', e instanceof Error ? e.message : String(e));
      if (fallades >= FALLADES_SEGMENTACIO_MAXIM) {
        segmentacioActiva = false;
        cau = undefined;
        console.warn('[analisi] segmentació desactivada després de diversos errors seguits');
      }
      return undefined;
    }
  };

  const analitza = (font: CanvasImageSource, ample: number, alt: number, opcions: IOpcionsAnalitza = {}): IMostra => {
    if (!canvas) {
      throw new Error('Analitzador alliberat');
    }
    const captura = opcions.captura === true;
    const cada = Math.max(
      1,
      Math.floor(opcions.segmentaCada ?? opcionsAnalitzador.segmentaCada ?? SEGMENTA_CADA_PER_DEFECTE)
    );
    const t0 = performance.now();
    const escala = Math.min(1, AMPLADA_ANALISI / ample);
    const w = Math.max(1, Math.round(ample * escala));
    const h = Math.max(1, Math.round(alt * escala));
    if (canvas.width !== w || canvas.height !== h || !ctx) {
      canvas.width = w;
      canvas.height = h;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (!ctx) {
      throw new Error('No es pot crear el context 2D d’anàlisi');
    }
    ctx.drawImage(font, 0, 0, w, h);
    const imatge = ctx.getImageData(0, 0, w, h);
    const marca = marcaTemps();
    const t1 = performance.now();

    const resultat = models.landmarker.detectForVideo(canvas, marca);
    const cares: IPunt[][] = resultat.faceLandmarks.map((c) => c.map((p) => ({ x: p.x, y: p.y, z: p.z })));
    const blendshapes: Record<string, number> = {};
    resultat.faceBlendshapes?.[0]?.categories.forEach((c) => {
      blendshapes[c.categoryName] = c.score;
    });
    const matriu = resultat.facialTransformationMatrixes?.[0] as IMatriu | undefined;
    const t2 = performance.now();

    // La segmentació només es calcula si hi ha exactament una cara: sense cara no hi ha res a mesurar amb la màscara.
    let mascara: IMascara | undefined;
    let segmentat = false;
    let tDibuixSeg = 0;
    if (cares.length !== 1) {
      cau = undefined;
      analisisDesDeSegmentar = 0;
    } else if (segmentacioActiva) {
      const centre = centreCaraMascara(cares[0]);
      const ara = performance.now();
      const caducada = cau !== undefined && ara - cau.ts > EDAT_MAXIMA_MASCARA_MS;
      const toca = captura || !cau || caducada || analisisDesDeSegmentar + 1 >= cada;
      if (centre && toca) {
        const ts0 = performance.now();
        const entrada = entradaSegmentacio(canvas, w, h, captura);
        tDibuixSeg = performance.now() - ts0;
        segmentat = true;
        // A la captura no es toca la memòria cau (ni els seus buffers): és una màscara a part, de mida completa.
        const nova = segmenta(entrada, marca, centre, captura ? undefined : cau?.mascara);
        if (captura) {
          mascara = nova;
        } else if (nova) {
          cau = { mascara: nova, ts: performance.now() };
          analisisDesDeSegmentar = 0;
          mascara = nova;
        } else {
          // Error puntual: es continua amb l'última màscara si encara és fresca (si no, sense màscara).
          analisisDesDeSegmentar = 0;
          mascara = cau && !caducada ? cau.mascara : undefined;
        }
      } else if (cau) {
        analisisDesDeSegmentar++;
        mascara = cau.mascara;
      }
    }
    const t3 = performance.now();

    const mesurat = calculaMesures(
      { imatge: { data: imatge.data, w, h }, cares, blendshapes, matriu, mascara },
      config.llindars,
      config.sortida
    );
    const t4 = performance.now();
    return {
      ...mesurat,
      ample: w,
      alt: h,
      landmarks: cares.length === 1 ? cares[0] : undefined,
      temps: {
        dibuix: t1 - t0 + tDibuixSeg,
        landmarker: t2 - t1,
        segmentador: segmentat ? t3 - t2 - tDibuixSeg : 0,
        metriques: t4 - t3
      },
      segmentat,
      segmentacio: segmentacioActiva
    };
  };

  return {
    analitza,
    allibera: (): void => {
      [canvas, canvasSeg].forEach((c) => {
        if (c) {
          c.width = 0;
          c.height = 0;
        }
      });
      canvas = undefined;
      canvasSeg = undefined;
      ctx = null;
      ctxSeg = null;
      cau = undefined;
    }
  };
}
