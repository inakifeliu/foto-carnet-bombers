/**
 * Retall al format oficial 35:45 (RF-07), versió simple de la Fase 1: rectangle centrat al fotograma,
 * sense landmarks. La geometria és pura (testejable); el dibuix sobre canvas és al final del fitxer.
 */
export const AMPLADA_MM = 35;
export const ALCADA_MM = 45;
const MM_PER_POLZADA = 25.4;

/**
 * Enquadrament de la foto final: «visor» = exactament el que es veu al visor de P3 (rectangle 35:45 centrat, el
 * mateix que mostra `object-fit: cover`); «cap» = retall intel·ligent RF-07 (el cap ocupa 34 de 45 mm).
 */
export type Enquadrament = 'visor' | 'cap';

export interface IRectangle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface IMida {
  w: number;
  h: number;
}

/**
 * Mida de sortida en píxels per a 35 × 45 mm a la densitat indicada: 300 ppp → 413 × 531, 600 ppp → 827 × 1063.
 */
export function midaSortida(ppp: number): IMida {
  return {
    w: Math.round((AMPLADA_MM / MM_PER_POLZADA) * ppp),
    h: Math.round((ALCADA_MM / MM_PER_POLZADA) * ppp)
  };
}

/**
 * Rectangle 35:45 el més gran possible, centrat al fotograma `ample × alt`. `factor` (0 < factor ≤ 1) en
 * redueix la mida respecte del màxim (1 = el més gran possible). Les coordenades són enters i el rectangle
 * sempre cap dins el fotograma.
 */
export function rectangleRetallCentrat(ample: number, alt: number, factor = 1): IRectangle {
  if (!(ample > 0) || !(alt > 0)) {
    throw new Error('Mida de fotograma no vàlida');
  }
  if (!(factor > 0) || factor > 1) {
    throw new Error('El factor de retall ha d’estar entre 0 (exclòs) i 1');
  }
  let w: number;
  let h: number;
  if (ample * ALCADA_MM >= alt * AMPLADA_MM) {
    // El fotograma és més ample que 35:45: l'alçada és el límit.
    h = Math.floor(alt * factor);
    w = Math.round((h * AMPLADA_MM) / ALCADA_MM);
  } else {
    w = Math.floor(ample * factor);
    h = Math.round((w * ALCADA_MM) / AMPLADA_MM);
  }
  w = Math.min(w, ample);
  h = Math.min(h, alt);
  return {
    x: Math.floor((ample - w) / 2),
    y: Math.floor((alt - h) / 2),
    w,
    h
  };
}

/**
 * Rectangle del fotograma que es veu al visor de P3 (`.visor`: `aspect-ratio: 35 / 45` + `object-fit: cover`
 * sobre el `<video>`). És la ÚNICA font de veritat: la captura (enquadrament «visor»), les zones dels controls
 * i el rectangle previst del diagnòstic fan servir aquesta funció. `object-fit: cover` mostra el rectangle 35:45
 * més gran centrat, sigui quina sigui la proporció de la càmera; el visor no té cap factor de zoom.
 */
export function rectangleVisor(ample: number, alt: number): IRectangle {
  return rectangleRetallCentrat(ample, alt);
}

/**
 * Mides intermèdies per reduir una imatge a poc a poc (a cada pas com a màxim a la meitat), perquè el
 * reescalat sigui de qualitat. Inclou la mida final; si no cal reduir més d'un factor 2, només la final.
 */
export function pasosReduccio(origen: IMida, desti: IMida): IMida[] {
  const passos: IMida[] = [];
  let w = origen.w;
  let h = origen.h;
  while (w / 2 > desti.w && h / 2 > desti.h) {
    w = Math.max(desti.w, Math.round(w / 2));
    h = Math.max(desti.h, Math.round(h / 2));
    passos.push({ w, h });
  }
  passos.push({ w: desti.w, h: desti.h });
  return passos;
}

export interface IOpcionsRetall {
  ppp: number;
  /** Factor sobre el rectangle màxim (per defecte 1). */
  factor?: number;
}

function creaCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No es pot crear el context 2D del canvas');
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}

/** Reducció per passos del rectangle `rect` de `origen` fins a la mida de sortida (qualitat alta). */
function reduccioPerPassos(origen: HTMLCanvasElement, rect: IRectangle, sortida: IMida): HTMLCanvasElement {
  const passos = pasosReduccio({ w: rect.w, h: rect.h }, sortida);
  let font: HTMLCanvasElement = origen;
  let sx = rect.x;
  let sy = rect.y;
  let sw = rect.w;
  let sh = rect.h;
  for (let i = 0; i < passos.length; i++) {
    const { w, h } = passos[i];
    const desti = creaCanvas(w, h);
    context2d(desti).drawImage(font, sx, sy, sw, sh, 0, 0, w, h);
    if (font !== origen) {
      // Allibera el canvas intermedi.
      font.width = 0;
      font.height = 0;
    }
    font = desti;
    sx = 0;
    sy = 0;
    sw = w;
    sh = h;
  }
  return font;
}

/**
 * Retalla `origen` (un fotograma sense mirall) al rectangle centrat 35:45 i el reescala a la mida de sortida
 * segons `ppp`, amb reducció per passos i `imageSmoothingQuality = 'high'`. No modifica `origen`.
 * Només retall i reescalat: cap retoc (RF-07).
 */
export function retallaCentrat(origen: HTMLCanvasElement, opcions: IOpcionsRetall): HTMLCanvasElement {
  const rect = rectangleRetallCentrat(origen.width, origen.height, opcions.factor ?? 1);
  return reduccioPerPassos(origen, rect, midaSortida(opcions.ppp));
}

/**
 * Retalla `origen` a un rectangle QUALSEVOL (RF-07, retall intel·ligent) i el reescala a la mida de sortida. Si el
 * rectangle sobresurt del fotograma, la part de fora queda BLANCA (neutra: és el color de fons oficial); la resta
 * de píxels no es toquen. No modifica `origen`.
 */
export function retallaRectangle(origen: HTMLCanvasElement, rect: IRectangle, ppp: number): HTMLCanvasElement {
  const dins = rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= origen.width && rect.y + rect.h <= origen.height;
  const sortida = midaSortida(ppp);
  if (dins) {
    return reduccioPerPassos(origen, rect, sortida);
  }
  const base = creaCanvas(rect.w, rect.h);
  const ctx = context2d(base);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, rect.w, rect.h);
  ctx.drawImage(origen, -rect.x, -rect.y);
  const resultat = reduccioPerPassos(base, { x: 0, y: 0, w: rect.w, h: rect.h }, sortida);
  if (resultat !== base) {
    base.width = 0;
    base.height = 0;
  }
  return resultat;
}
