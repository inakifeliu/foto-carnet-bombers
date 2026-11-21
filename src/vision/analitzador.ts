/**
 * Analitzador de fotogrames (RF-02, RF-03, RF-04): redueix el fotograma a ~640 px d'amplada, hi executa el Face
 * Landmarker i l'Image Segmenter (mode VIDEO) i en calcula les mesures de RF-05 (`calculaMesures`, pur).
 *
 * El mateix camí es fa servir al bucle en directe i a la captura (RF-06). A la captura s'hi passa el fotograma
 * COMPLET de la càmera (el canvas sense mirall); els models i les mètriques de píxels treballen sobre la còpia
 * reduïda d'aquest fotograma (mateixa escala que en directe, que és la qual s'han de calibrar els llindars) i els
 * landmarks, normalitzats, es reaprofiten sobre la resolució completa per al retall (RF-07).
 *
 * MODE VIDEO a la captura: es fa servir `detectForVideo` amb una marca de temps estrictament creixent (comuna a
 * tot l'analitzador) en comptes de canviar el model a mode IMAGE: evita reconfigurar els models i el seguiment
 * temporal ja és escalfat. El cost és que el resultat pot heretar una mica de suavitzat temporal del seguiment.
 */
import type { IConfig } from '../config/configuracio';
import type { IModels } from './mediapipe';
import { calculaMesures, type IMascaraBruta, type IResultatMesures } from './mesures';
import type { IMatriu, IPunt } from './tipus';

/** Amplada (px) de la imatge d'entrada als models i a les mètriques (spec §5, Rendiment). */
export const AMPLADA_ANALISI = 640;

export interface IMostra extends IResultatMesures {
  /** Mida del fotograma analitzat (px). */
  ample: number;
  alt: number;
  /** Landmarks de la primera cara (si n'hi ha). */
  landmarks?: IPunt[];
}

export interface IAnalitzador {
  /** Analitza un fotograma (vídeo o canvas). `ample × alt` és la mida original de la font. */
  analitza: (font: CanvasImageSource, ample: number, alt: number) => IMostra;
  /** Allibera els canvas i buffers d'anàlisi (RF-16). */
  allibera: () => void;
}

let darreraMarca = 0;

/** Marca de temps (ms) estrictament creixent, compartida per totes les crides a `detectForVideo`/`segmentForVideo`. */
export function marcaTemps(): number {
  darreraMarca = Math.max(darreraMarca + 1, Math.floor(performance.now()));
  return darreraMarca;
}

export function creaAnalitzador(models: IModels, config: IConfig): IAnalitzador {
  let canvas: HTMLCanvasElement | undefined = document.createElement('canvas');
  let ctx: CanvasRenderingContext2D | null = null;

  const analitza = (font: CanvasImageSource, ample: number, alt: number): IMostra => {
    if (!canvas) {
      throw new Error('Analitzador alliberat');
    }
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

    const resultat = models.landmarker.detectForVideo(canvas, marca);
    const cares: IPunt[][] = resultat.faceLandmarks.map((c) => c.map((p) => ({ x: p.x, y: p.y, z: p.z })));
    const blendshapes: Record<string, number> = {};
    resultat.faceBlendshapes?.[0]?.categories.forEach((c) => {
      blendshapes[c.categoryName] = c.score;
    });
    const matriu = resultat.facialTransformationMatrixes?.[0] as IMatriu | undefined;

    // La segmentació només es calcula si hi ha cara: sense cara no hi ha res a mesurar amb la màscara.
    let mascaraBruta: IMascaraBruta | undefined;
    if (cares.length === 1) {
      models.segmenter.segmentForVideo(canvas, marca, (r) => {
        const m = r.categoryMask;
        if (m) {
          // `slice` copia: el buffer només és vàlid durant la crida de retorn.
          mascaraBruta = { data: m.getAsUint8Array().slice(), w: m.width, h: m.height };
        }
      });
    }

    const mesurat = calculaMesures(
      { imatge: { data: imatge.data, w, h }, cares, blendshapes, matriu, mascaraBruta },
      config.llindars,
      config.sortida
    );
    return { ...mesurat, ample: w, alt: h, landmarks: cares.length === 1 ? cares[0] : undefined };
  };

  return {
    analitza,
    allibera: (): void => {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
      canvas = undefined;
      ctx = null;
    }
  };
}
