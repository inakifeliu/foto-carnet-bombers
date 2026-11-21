import type { IRetallCap } from '../captura/retallCap';
import type { NivellPressupost } from './pressupost';
import type { IAvaluacio, IMascara, IMesures, IPunt, IRectNorm, ITempsPas } from './tipus';

/**
 * Instantània de l'última anàlisi, publicada pel bucle d'anàlisi (P3) perquè el mode diagnòstic (RF-18) la mostri
 * en directe. Viu només a memòria; `publica(undefined)` la buida (en sortir de P3 i a la neteja RF-16).
 * La màscara i els landmarks només serveixen per dibuixar la superposició: MAI s'exporten al JSON.
 */
export interface IInstantania {
  ts: number;
  /** Mides del fotograma analitzat (px). */
  ample: number;
  alt: number;
  /** Mesures ja suavitzades i la seva avaluació. */
  mesures: IMesures;
  avaluacio: IAvaluacio;
  /** Retall previst (px del fotograma analitzat) i zones analitzades (normalitzades). */
  retall?: IRetallCap;
  zonaFons?: IRectNorm;
  zonaTors?: IRectNorm;
  zonaCara?: IRectNorm;
  /** Només per a la superposició. */
  mascara?: IMascara;
  landmarks?: IPunt[];
  /** Rendiment. */
  fpsAnalisi: number;
  msPerFotograma: number;
  fpsVideo?: number;
  delegat?: 'GPU' | 'CPU';
  /** Temps per pas (ms, mitjana mòbil), nivell del pressupost, fps objectiu actual i si hi ha segmentació. */
  temps?: ITempsPas;
  nivell?: NivellPressupost;
  fpsObjectiu?: number;
  segmentacio?: boolean;
}

type Oient = (i: IInstantania | undefined) => void;

let ultima: IInstantania | undefined;
const oients = new Set<Oient>();

export const estatAnalisi = {
  publica(i: IInstantania | undefined): void {
    ultima = i;
    oients.forEach((o) => o(i));
  },
  llegeix(): IInstantania | undefined {
    return ultima;
  },
  subscriu(o: Oient): () => void {
    oients.add(o);
    return (): void => {
      oients.delete(o);
    };
  }
};
