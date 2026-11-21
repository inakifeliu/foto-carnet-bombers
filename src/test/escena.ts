/** Ajudes per als tests de visió: landmarks, imatges, màscares i matrius sintètics. No forma part de l'aplicació. */
import { CONFIG_PER_DEFECTE } from '../config/configuracio';
import type { IImatgeRGBA, IMascara, IMatriu, IMesures, IPunt } from '../vision/tipus';

export const LLINDARS = CONFIG_PER_DEFECTE.llindars;
export const PESOS = CONFIG_PER_DEFECTE.pesosPuntuacio;
export const PARAMS_RETALL = { alcadaCapMm: 34, margeSuperiorMm: 4 };

export interface IOpcionsCara {
  centreX?: number;
  yFront?: number;
  yBarbeta?: number;
  ample?: number;
}

/** 478 punts a l'origen, amb els quatre que fa servir l'aplicació (10, 152, 234, 454) col·locats. */
export function creaLandmarks(o: IOpcionsCara = {}): IPunt[] {
  const cx = o.centreX ?? 0.5;
  const ample = o.ample ?? 0.2;
  const llista: IPunt[] = Array.from({ length: 478 }, () => ({ x: cx, y: 0.45, z: 0 }));
  llista[10] = { x: cx, y: o.yFront ?? 0.3, z: 0 };
  llista[152] = { x: cx, y: o.yBarbeta ?? 0.62, z: 0 };
  llista[234] = { x: cx - ample / 2, y: 0.45, z: 0 };
  llista[454] = { x: cx + ample / 2, y: 0.45, z: 0 };
  return llista;
}

/** Imatge RGBA `w × h` on cada píxel el decideix `pinta(x, y)`. */
export function creaImatge(
  w: number,
  h: number,
  pinta: (x: number, y: number) => [number, number, number]
): IImatgeRGBA {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pinta(x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, w, h };
}

/** Màscara `w × h` (1 = persona) segons `persona(x, y)`. */
export function creaMascara(w: number, h: number, persona: (x: number, y: number) => boolean): IMascara {
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      data[y * w + x] = persona(x, y) ? 1 : 0;
    }
  }
  return { data, w, h };
}

/** Matriu 4×4 en ordre de columnes: R = Ry(yaw)·Rx(pitch)·Rz(roll) (graus), escalada i amb translació. */
export function creaMatriu(yaw: number, pitch: number, roll: number, escala = 1): IMatriu {
  const r = (g: number): number => (g * Math.PI) / 180;
  const [cy, sy, cx, sx, cz, sz] = [
    Math.cos(r(yaw)),
    Math.sin(r(yaw)),
    Math.cos(r(pitch)),
    Math.sin(r(pitch)),
    Math.cos(r(roll)),
    Math.sin(r(roll))
  ];
  const col0 = [cy * cz + sy * sx * sz, cx * sz, -sy * cz + cy * sx * sz];
  const col1 = [-cy * sz + sy * sx * cz, cx * cz, sy * sz + cy * sx * cz];
  const col2 = [sy * cx, -sx, cy * cx];
  const data = [
    ...col0.map((v) => v * escala),
    0,
    ...col1.map((v) => v * escala),
    0,
    ...col2.map((v) => v * escala),
    0,
    1.5,
    -2,
    -40,
    1
  ];
  return { rows: 4, columns: 4, data };
}

/** Mesures totes dins els llindars (cada control, ben dins). */
export function mesuresBones(): IMesures {
  return {
    nCares: 1,
    desviacio: 0,
    alcadaCara: 0.375,
    yaw: 0,
    pitch: 0,
    roll: 0,
    parpelleig: 0.05,
    bocaOberta: 0.02,
    llum: 155,
    ombra: 0.05,
    nitidesa: 500,
    fons: 0.97,
    polo: 0.9,
    torsVisible: 1
  };
}

/** Mesures idèntiques a les bones però amb tots els valors al seu ideal (puntuació 100). */
export function mesuresPerfectes(): IMesures {
  return { ...mesuresBones(), ombra: 0, parpelleig: 0, bocaOberta: 0, fons: 1, polo: 1 };
}

/** Mesures totes fora de llindar (vermell). */
export function mesuresDolentes(): IMesures {
  return {
    nCares: 1,
    desviacio: 0.3,
    alcadaCara: 0.1,
    yaw: 40,
    pitch: 40,
    roll: 30,
    parpelleig: 0.9,
    bocaOberta: 0.8,
    llum: 20,
    ombra: 0.9,
    nitidesa: 5,
    fons: 0.2,
    polo: 0.1,
    torsVisible: 0.2
  };
}
