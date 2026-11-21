import type { IPunt, IRectNorm } from './tipus';

/** Índexs dels landmarks del Face Landmarker (malla de 478 punts) que fem servir. */
export const LM = {
  /** Part superior del front (límit superior de la malla). */
  FRONT: 10,
  /** Punta del nas (només diagnòstic). */
  NAS: 1,
  /** Barbeta. */
  BARBETA: 152,
  /** Vora de la cara a l'esquerra de la imatge / a la dreta de la imatge. */
  VORA_ESQ: 234,
  VORA_DRE: 454
} as const;

export interface IGeometriaCara {
  /** Centre horitzontal (0..1): punt mig entre les dues vores de la cara. */
  centreX: number;
  /** Amplada de la cara (0..1 de l'amplada del fotograma). */
  ample: number;
  /** y del landmark 10 i de la barbeta (0..1 de l'alçada). */
  yFront: number;
  yBarbeta: number;
  /** Alçada front–barbeta (0..1 de l'alçada del fotograma). */
  alcada: number;
}

/** Geometria bàsica de la cara a partir dels landmarks; undefined si falten punts o no són coherents. */
export function geometriaCara(landmarks: IPunt[] | undefined): IGeometriaCara | undefined {
  if (!landmarks) {
    return undefined;
  }
  const front = landmarks[LM.FRONT];
  const barbeta = landmarks[LM.BARBETA];
  const esq = landmarks[LM.VORA_ESQ];
  const dre = landmarks[LM.VORA_DRE];
  if (!front || !barbeta || !esq || !dre) {
    return undefined;
  }
  const alcada = barbeta.y - front.y;
  const ample = Math.abs(dre.x - esq.x);
  if (!(alcada > 0) || !(ample > 0) || ![front.y, barbeta.y, esq.x, dre.x].every(isFinite)) {
    return undefined;
  }
  return { centreX: (esq.x + dre.x) / 2, ample, yFront: front.y, yBarbeta: barbeta.y, alcada };
}

/** Rectangle de la cara (de la vora a la vora i del front a la barbeta), normalitzat. */
export function rectCara(g: IGeometriaCara): IRectNorm {
  return { x: g.centreX - g.ample / 2, y: g.yFront, w: g.ample, h: g.alcada };
}

/** Intersecció d'un rectangle amb el fotograma [0,1]×[0,1]. */
export function retallaAlFotograma(r: IRectNorm): IRectNorm {
  const x0 = Math.max(0, r.x);
  const y0 = Math.max(0, r.y);
  const x1 = Math.min(1, r.x + r.w);
  const y1 = Math.min(1, r.y + r.h);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}
