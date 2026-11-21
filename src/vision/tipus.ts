import type { ClauI18n } from '../i18n';

/**
 * Estat d'un control de qualitat. `cap` = no es pot avaluar ara (p. ex. sense cara); `noDisp` = no es pot avaluar
 * en aquest equip (p. ex. sense segmentador): no compta per a `totOk` ni per a la puntuació.
 */
export type EstatControl = 'ok' | 'avis' | 'error' | 'cap' | 'noDisp';

/**
 * Controls de RF-05. L'ordre d'aquesta llista ÉS la prioritat dels missatges de la spec:
 * 5.1 → 5.3 → 5.2 → 5.4 → 5.7 → 5.6 → 5.8 → 5.10 → 5.11 → 5.5 → 5.9.
 */
export const ORDRE_PRIORITAT = [
  'cara', // 5.1
  'distancia', // 5.3
  'centrat', // 5.2
  'orientacio', // 5.4
  'llum', // 5.7
  'fons', // 5.6
  'ombra', // 5.8
  'polo', // 5.10
  'espatlles', // 5.11
  'ullsBoca', // 5.5
  'nitidesa' // 5.9
] as const;

export type ClauControl = (typeof ORDRE_PRIORITAT)[number];

/** Punt normalitzat (0..1) respecte del fotograma analitzat. */
export interface IPunt {
  x: number;
  y: number;
  z?: number;
}

/** Rectangle en coordenades normalitzades (0..1) del fotograma. */
export interface IRectNorm {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Imatge RGBA (4 bytes per píxel, files consecutives). */
export interface IImatgeRGBA {
  data: ArrayLike<number>;
  w: number;
  h: number;
}

/** Màscara binària de persona: 1 = persona, 0 = fons. */
export interface IMascara {
  data: Uint8Array;
  w: number;
  h: number;
}

/** Matriu de MediaPipe (`facialTransformationMatrixes[i]`): 4×4, valors en ordre de columnes. */
export interface IMatriu {
  rows: number;
  columns: number;
  data: ArrayLike<number>;
}

/** Valors numèrics d'un instant (o suavitzats). Només hi ha valors si hi ha exactament una cara. */
export interface IMesures {
  nCares: number;
  /** Centre horitzontal de la cara menys 0,5 (negatiu = la cara és a l'esquerra del fotograma SENSE mirall). */
  desviacio?: number;
  /** Alçada de la cara (front–barbeta) / alçada del fotograma. */
  alcadaCara?: number;
  yaw?: number;
  pitch?: number;
  roll?: number;
  parpelleig?: number;
  bocaOberta?: number;
  llum?: number;
  ombra?: number;
  nitidesa?: number;
  /** Proporció de píxels de fons blancs a la zona del retall (undefined si no hi ha fons a la zona). */
  fons?: number;
  /** Proporció de píxels de persona de la zona del tors que són blau polo. */
  polo?: number;
  /** Fracció de la zona del tors dins del fotograma (0..1). */
  torsVisible?: number;
}

export type ClauMesura = Exclude<keyof IMesures, 'nCares'>;

export const CLAUS_MESURES: ClauMesura[] = [
  'desviacio',
  'alcadaCara',
  'yaw',
  'pitch',
  'roll',
  'parpelleig',
  'bocaOberta',
  'llum',
  'ombra',
  'nitidesa',
  'fons',
  'polo',
  'torsVisible'
];

/** Temps (ms) de cada pas d'una anàlisi: dibuix (reducció + lectura de píxels), Face Landmarker, segmentador i mètriques. */
export interface ITempsPas {
  dibuix: number;
  landmarker: number;
  segmentador: number;
  metriques: number;
}

/** Resultat de l'avaluació d'un control. */
export interface IControl {
  estat: EstatControl;
  /** Valor numèric principal (per al mode diagnòstic). */
  valor?: number;
  /** Missatge d'acció si l'estat és `avis` o `error`. */
  missatge?: ClauI18n;
  /** 0..1: contribució a la puntuació de qualitat. */
  puntuacio: number;
}

export interface IAvaluacio {
  controls: Record<ClauControl, IControl>;
  /** Missatge de més prioritat (undefined si tots els controls són verds). */
  missatge?: ClauI18n;
  /** Tots els controls en verd. */
  totOk: boolean;
}
