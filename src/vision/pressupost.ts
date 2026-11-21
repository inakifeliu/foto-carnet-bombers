/**
 * Pressupost de temps de l'anàlisi en directe (RF-04, Rendiment). Tot el bucle (dibuix, Face Landmarker, segmentador i
 * mètriques) és síncron al fil principal: si una anàlisi tarda massa el vídeo se'n ressent. Aquest mòdul PUR decideix,
 * a partir de la mitjana mòbil del temps per anàlisi (`msMitja`), a quina freqüència s'analitza i cada quantes
 * anàlisis es segmenta, i quan cal renunciar a l'anàlisi en directe (la captura manual continua sempre).
 *
 * Nivells:
 *  - `normal`: `FPS_NORMAL` anàlisis/s i una segmentació cada `SEGMENTA_CADA_NORMAL` anàlisis (~4 Hz amb 12 fps).
 *  - `reduit`: si `msMitja` > `LLINDAR_REDUIT_MS`, `FPS_REDUIT` anàlisis/s i la segmentació més espaiada. Es torna a
 *    `normal` quan `msMitja` baixa de `LLINDAR_RECUPERA_MS` (histèresi, perquè no oscil·li).
 *  - `aturat`: si `msMitja` > `LLINDAR_ATURA_MS` durant `ANALISIS_SOSTINGUDES_PER_ATURAR` anàlisis seguides. És
 *    definitiu fins a la propera entrada a P3.
 * L'escalfament dels models no passa per aquí (es fa en carregar-los), de manera que la mitjana arrenca amb la primera
 * anàlisi real.
 */
import type { ITempsPas } from './tipus';

export type NivellPressupost = 'normal' | 'reduit' | 'aturat';

export interface IParamsPressupost {
  fpsNormal: number;
  fpsReduit: number;
  segmentaCadaNormal: number;
  segmentaCadaReduit: number;
  llindarReduitMs: number;
  llindarRecuperaMs: number;
  llindarAturaMs: number;
  analisisSostingudesPerAturar: number;
  /** Pes de la mostra nova a la mitjana exponencial (0..1). */
  pesMitjana: number;
}

/** Freqüència objectiu de l'anàlisi (RF-04: ~10-15 fps). El vídeo es continua mostrant a la seva freqüència. */
export const FPS_NORMAL = 12;
export const FPS_REDUIT = 8;
export const SEGMENTA_CADA_NORMAL = 3;
export const SEGMENTA_CADA_REDUIT = 6;
export const LLINDAR_REDUIT_MS = 50;
export const LLINDAR_RECUPERA_MS = 35;
export const LLINDAR_ATURA_MS = 150;
export const ANALISIS_SOSTINGUDES_PER_ATURAR = 10;
export const PES_MITJANA = 0.2;

export const PRESSUPOST_PER_DEFECTE: IParamsPressupost = {
  fpsNormal: FPS_NORMAL,
  fpsReduit: FPS_REDUIT,
  segmentaCadaNormal: SEGMENTA_CADA_NORMAL,
  segmentaCadaReduit: SEGMENTA_CADA_REDUIT,
  llindarReduitMs: LLINDAR_REDUIT_MS,
  llindarRecuperaMs: LLINDAR_RECUPERA_MS,
  llindarAturaMs: LLINDAR_ATURA_MS,
  analisisSostingudesPerAturar: ANALISIS_SOSTINGUDES_PER_ATURAR,
  pesMitjana: PES_MITJANA
};

export class PressupostAnalisi {
  private readonly p: IParamsPressupost;
  private mitjana = 0;
  private mostres = 0;
  private sobreAtura = 0;
  private estat: NivellPressupost = 'normal';

  public constructor(params: Partial<IParamsPressupost> = {}) {
    this.p = { ...PRESSUPOST_PER_DEFECTE, ...params };
  }

  /** Registra el temps (ms) d'una anàlisi i en retorna el nivell resultant. */
  public registra(ms: number): NivellPressupost {
    this.mitjana = this.mostres === 0 ? ms : this.mitjana * (1 - this.p.pesMitjana) + ms * this.p.pesMitjana;
    this.mostres++;
    if (this.estat === 'aturat') {
      return this.estat;
    }
    this.sobreAtura = this.mitjana > this.p.llindarAturaMs ? this.sobreAtura + 1 : 0;
    if (this.sobreAtura >= this.p.analisisSostingudesPerAturar) {
      this.estat = 'aturat';
    } else if (this.mitjana > this.p.llindarReduitMs) {
      this.estat = 'reduit';
    } else if (this.estat === 'reduit' && this.mitjana < this.p.llindarRecuperaMs) {
      this.estat = 'normal';
    }
    return this.estat;
  }

  /** Mitjana mòbil (ms) del temps per anàlisi; 0 fins a la primera anàlisi real. */
  public get msMitja(): number {
    return this.mitjana;
  }

  public get nivell(): NivellPressupost {
    return this.estat;
  }

  /** Anàlisis per segon objectiu en el nivell actual. */
  public get fps(): number {
    return this.estat === 'normal' ? this.p.fpsNormal : this.p.fpsReduit;
  }

  /** Cada quantes anàlisis es torna a segmentar en el nivell actual. */
  public get segmentaCada(): number {
    return this.estat === 'normal' ? this.p.segmentaCadaNormal : this.p.segmentaCadaReduit;
  }
}

/**
 * Mitjana exponencial del temps de cada pas (per al mode diagnòstic). El segmentador només treballa en una part de les
 * anàlisis: la seva mitjana només s'actualitza quan s'ha segmentat de debò (si no, mostraria 0 a la majoria de
 * fotogrames).
 */
export class MitjanaTemps {
  private actual: ITempsPas = { dibuix: 0, landmarker: 0, segmentador: 0, metriques: 0 };
  private primer = true;
  private primerSeg = true;

  public constructor(private readonly pes = PES_MITJANA) {}

  public afegeix(t: ITempsPas, segmentat: boolean): ITempsPas {
    const mescla = (anterior: number, nou: number, inicial: boolean): number =>
      inicial ? nou : anterior * (1 - this.pes) + nou * this.pes;
    this.actual = {
      dibuix: mescla(this.actual.dibuix, t.dibuix, this.primer),
      landmarker: mescla(this.actual.landmarker, t.landmarker, this.primer),
      metriques: mescla(this.actual.metriques, t.metriques, this.primer),
      segmentador: segmentat ? mescla(this.actual.segmentador, t.segmentador, this.primerSeg) : this.actual.segmentador
    };
    this.primer = false;
    if (segmentat) {
      this.primerSeg = false;
    }
    return { ...this.actual };
  }
}
