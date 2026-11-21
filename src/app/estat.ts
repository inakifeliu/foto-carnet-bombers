/** Màquina d'estats de les pantalles (P0–P7 + NoCompatible). Reducer pur. */
import type { DestiDesat } from '../captura/desar';

export type Pantalla =
  | 'P0Benvinguda'
  | 'P1Instruccions'
  | 'P2Matricula'
  | 'P3Captura'
  | 'P4Seleccio'
  | 'P5Desar'
  | 'P6Forms'
  | 'P7Final'
  | 'NoCompatible';

export const ORDRE_PANTALLES: Pantalla[] = [
  'P0Benvinguda',
  'P1Instruccions',
  'P2Matricula',
  'P3Captura',
  'P4Seleccio',
  'P5Desar',
  'P6Forms',
  'P7Final'
];

export interface IEstat {
  pantalla: Pantalla;
  /** Matrícula validada a P2 (cadena buida fins llavors). */
  matricula: string;
  /** Índex de la foto triada a P4 (dins la llista de fotos capturades). */
  fotoTriada: number;
  /** On s'ha desat la foto a P5: carpeta Imatges (selector de fitxers) o Baixades (alternativa). */
  desti: DestiDesat;
  /** Nom real del fitxer desat quan el navegador el diu (buit si no es coneix: es fa servir `{matricula}.jpg`). */
  nomDesat: string;
  /** Resultat de la detecció de funcionalitats; si és false l'app queda a NoCompatible. */
  compatible: boolean;
}

export type Accio =
  | { tipus: 'ENDAVANT' }
  | { tipus: 'ENRERE' }
  | { tipus: 'DESA_MATRICULA'; matricula: string }
  | { tipus: 'TRIA_FOTO'; index: number }
  | { tipus: 'DESAT'; desti: DestiDesat; nom?: string }
  | { tipus: 'REINICIA' };

export function estatInicial(compatible: boolean): IEstat {
  return {
    pantalla: compatible ? 'P0Benvinguda' : 'NoCompatible',
    matricula: '',
    fotoTriada: 0,
    desti: 'imatges',
    nomDesat: '',
    compatible
  };
}

export function reductor(estat: IEstat, accio: Accio): IEstat {
  switch (accio.tipus) {
    case 'ENDAVANT': {
      const i = ORDRE_PANTALLES.indexOf(estat.pantalla);
      if (i === -1 || i === ORDRE_PANTALLES.length - 1) {
        return estat;
      }
      // No es pot sortir de P2 sense una matrícula validada.
      if (estat.pantalla === 'P2Matricula' && estat.matricula === '') {
        return estat;
      }
      return { ...estat, pantalla: ORDRE_PANTALLES[i + 1] };
    }
    case 'ENRERE': {
      const i = ORDRE_PANTALLES.indexOf(estat.pantalla);
      // Des de P0 i des de la pantalla final no es retrocedeix.
      if (i <= 0 || estat.pantalla === 'P7Final') {
        return estat;
      }
      return { ...estat, pantalla: ORDRE_PANTALLES[i - 1] };
    }
    case 'DESA_MATRICULA':
      return { ...estat, matricula: accio.matricula };
    case 'TRIA_FOTO':
      return { ...estat, fotoTriada: accio.index };
    case 'DESAT':
      return { ...estat, desti: accio.desti, nomDesat: accio.nom ?? '' };
    case 'REINICIA':
      return estatInicial(estat.compatible);
    default:
      return estat;
  }
}
