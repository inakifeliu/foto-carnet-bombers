/**
 * Retall intel·ligent (RF-07): geometria PURA. Les funcions treballen en píxels del fotograma on
 * s'aplicarà el retall (a la captura, la resolució completa de la càmera).
 *
 * Model: l'alçada del cap (barbeta → part superior del cap) ocupa `alcadaCapMm / 45` de l'alçada del retall;
 * el límit superior del retall és `margeSuperiorMm / 45` de l'alçada del retall per sobre del cap;
 * el cap queda centrat horitzontalment (centre = punt mig de les vores de la cara). Proporció 35:45.
 *
 * Decisió sobre píxels fora del fotograma: el retall NO es mou ni es redueix (es perdria l'enquadrament
 * oficial); la part de fora es pinta de BLANC (el color de fons oficial; res no es retoca a la cara), es
 * marca un avís i la puntuació rep una penalització (vegeu `penalitzacioFora`).
 */
import type { IMascara, IPunt } from '../vision/tipus';
import { LM, geometriaCara } from '../vision/cara';
import { ALCADA_MM, AMPLADA_MM, type IRectangle } from './retall';

export interface IParamsRetallCap {
  alcadaCapMm: number;
  margeSuperiorMm: number;
}

export interface IRetallCap {
  /** Rectangle de retall en píxels (enters); pot sobresortir del fotograma. */
  rect: IRectangle;
  /** Y (px) de la part superior del cap i de la barbeta, i com s'ha estimat el cap. */
  capY: number;
  barbetaY: number;
  origenCap: 'mascara' | 'landmarks';
  /** Píxels de retall fora del fotograma per cada costat. */
  fora: { esq: number; dalt: number; dreta: number; baix: number };
  /** Fracció de l'àrea del retall que queda fora del fotograma (0..1). */
  fraccioFora: number;
}

/** Tolerància: per sota d'aquesta fracció fora del fotograma no es considera «fora» (arrodoniments). */
export const TOLERANCIA_FORA = 0.01;

export interface IEstimacioCap {
  /** Y normalitzada (0..1) de la part superior del cap. */
  y: number;
  origen: 'mascara' | 'landmarks';
}

const COLUMNES_CAP = [-0.12, -0.06, 0, 0.06, 0.12];

/**
 * Part superior del cap (Y normalitzada). Amb màscara: a cada una de diverses columnes properes al centre de la
 * cara, es puja des de sota del landmark 10 mentre hi ha persona; la mediana de les columnes vàlides és el cap.
 * Si no és fiable (el punt de partida no és persona, menys de 3 columnes vàlides o un resultat inversemblant),
 * retrocés a landmark 10 + 0,25 × alçada front–barbeta cap amunt (y més petita).
 */
export function estimaCapSuperior(landmarks: IPunt[], mascara: IMascara | undefined): IEstimacioCap | undefined {
  const g = geometriaCara(landmarks);
  if (!g) {
    return undefined;
  }
  const retroces: IEstimacioCap = { y: g.yFront - 0.25 * g.alcada, origen: 'landmarks' };
  if (!mascara || mascara.w <= 0 || mascara.h <= 0 || mascara.data.length < mascara.w * mascara.h) {
    return retroces;
  }
  const fila0 = Math.floor((g.yFront + 0.05 * g.alcada) * mascara.h);
  const tops: number[] = [];
  for (const k of COLUMNES_CAP) {
    const col = Math.floor((g.centreX + k * g.ample) * mascara.w);
    if (col < 0 || col >= mascara.w || fila0 < 0 || fila0 >= mascara.h) {
      continue;
    }
    if (mascara.data[fila0 * mascara.w + col] !== 1) {
      continue; // el punt de partida no és persona: columna no fiable
    }
    let fila = fila0;
    while (fila > 0 && mascara.data[(fila - 1) * mascara.w + col] === 1) {
      fila--;
    }
    tops.push(fila / mascara.h);
  }
  if (tops.length < 3) {
    return retroces;
  }
  tops.sort((a, b) => a - b);
  const y = tops[Math.floor(tops.length / 2)];
  // Si el cap toca la vora superior del fotograma, és el millor valor que tenim (el retall sortirà fora i s'avisarà).
  if (y === 0) {
    return { y, origen: 'mascara' };
  }
  const dalt = g.yFront - y; // quant per sobre del landmark 10
  if (dalt < 0.03 * g.alcada || dalt > 0.8 * g.alcada) {
    return retroces;
  }
  return { y, origen: 'mascara' };
}

/** Geometria pura a partir de píxels: barbeta, part superior del cap i centre. Retorna undefined si no és vàlida. */
export function rectangleRetallCap(
  amplePx: number,
  altPx: number,
  barbetaY: number,
  capY: number,
  centreX: number,
  params: IParamsRetallCap
): { rect: IRectangle; fora: IRetallCap['fora']; fraccioFora: number } | undefined {
  const alcadaCap = barbetaY - capY;
  if (![amplePx, altPx, barbetaY, capY, centreX].every(isFinite) || !(alcadaCap > 0) || !(amplePx > 0)) {
    return undefined;
  }
  if (!(params.alcadaCapMm > 0) || params.alcadaCapMm >= ALCADA_MM) {
    return undefined;
  }
  const h = alcadaCap * (ALCADA_MM / params.alcadaCapMm);
  const w = (h * AMPLADA_MM) / ALCADA_MM;
  const y = capY - (params.margeSuperiorMm / ALCADA_MM) * h;
  const x = centreX - w / 2;
  const rect: IRectangle = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  // Retalls absurds (cara minúscula o gegant): es descarten.
  if (rect.w < 8 || rect.h < 8 || rect.w > 4 * amplePx || rect.h > 4 * altPx) {
    return undefined;
  }
  const fora = {
    esq: Math.max(0, -rect.x),
    dalt: Math.max(0, -rect.y),
    dreta: Math.max(0, rect.x + rect.w - amplePx),
    baix: Math.max(0, rect.y + rect.h - altPx)
  };
  const ix0 = Math.max(0, rect.x);
  const iy0 = Math.max(0, rect.y);
  const ix1 = Math.min(amplePx, rect.x + rect.w);
  const iy1 = Math.min(altPx, rect.y + rect.h);
  const dins = Math.max(0, ix1 - ix0) * Math.max(0, iy1 - iy0);
  const fraccioFora = Math.min(1, Math.max(0, 1 - dins / (rect.w * rect.h)));
  return { rect, fora, fraccioFora };
}

/**
 * Retall RF-07 a partir dels landmarks (normalitzats) i, si n'hi ha, la màscara. `amplePx × altPx` és la mida del
 * fotograma sobre el qual s'aplicarà el retall. Retorna undefined si no es pot calcular (el cridant fa servir el
 * retall centrat simple de la Fase 1).
 */
export function calculaRetallCap(
  landmarks: IPunt[] | undefined,
  mascara: IMascara | undefined,
  amplePx: number,
  altPx: number,
  params: IParamsRetallCap
): IRetallCap | undefined {
  if (!landmarks) {
    return undefined;
  }
  const g = geometriaCara(landmarks);
  const cap = estimaCapSuperior(landmarks, mascara);
  if (!g || !cap) {
    return undefined;
  }
  const barbetaY = landmarks[LM.BARBETA].y * altPx;
  const capY = cap.y * altPx;
  const r = rectangleRetallCap(amplePx, altPx, barbetaY, capY, g.centreX * amplePx, params);
  if (!r) {
    return undefined;
  }
  return { ...r, capY, barbetaY, origenCap: cap.origen };
}

/** Penalització (punts) per retall fora del fotograma: proporcional fins a un 10% de l'àrea fora; 0 sota la tolerància. */
export function penalitzacioFora(fraccioFora: number, puntsMaxims: number): number {
  if (fraccioFora <= TOLERANCIA_FORA) {
    return 0;
  }
  return puntsMaxims * Math.min(1, fraccioFora / 0.1);
}
