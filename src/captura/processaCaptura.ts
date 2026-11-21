/**
 * Procés de la captura (RF-06, RF-07): sobre el fotograma COMPLET (sense mirall) es tornen a calcular tots els
 * controls (no s'aprofiten els del vídeo), es calcula la puntuació i es retalla segons RF-07. Sense cara (o sense
 * poder situar el cap) es fa servir el retall centrat simple de la Fase 1 amb un avís.
 */
import type { IConfig } from '../config/configuracio';
import type { ClauI18n } from '../i18n';
import { avalua, calculaPuntuacio, missatgesAvis } from '../vision/avaluacio';
import type { IAnalitzador } from '../vision/analitzador';
import { penalitzacioFora, TOLERANCIA_FORA, calculaRetallCap } from './retallCap';
import { retallaCentrat, retallaRectangle } from './retall';

export interface IResultatCaptura {
  /** Canvas retallat a la mida de sortida (qui el rep l'ha d'alliberar). */
  retallada: HTMLCanvasElement;
  /** Puntuació 0-100; undefined si no hi havia anàlisi disponible. */
  puntuacio?: number;
  /** Avisos de la foto (claus i18n): controls no verds, retall fora del fotograma, etc. */
  avisos: ClauI18n[];
}

export function processaCaptura(
  completa: HTMLCanvasElement,
  analitzador: IAnalitzador | undefined,
  config: IConfig
): IResultatCaptura {
  const ppp = config.sortida.ppp;
  if (!analitzador) {
    return { retallada: retallaCentrat(completa, { ppp }), avisos: ['avis.senseAnalisi'] };
  }
  let mostra;
  try {
    mostra = analitzador.analitza(completa, completa.width, completa.height, { captura: true });
  } catch {
    // L'anàlisi falla però la foto no s'ha de perdre.
    return { retallada: retallaCentrat(completa, { ppp }), avisos: ['avis.senseAnalisi'] };
  }
  const avaluacio = avalua(mostra.mesures, config.llindars, { segmentacio: mostra.segmentacio });
  const avisos = missatgesAvis(avaluacio);
  const sensePuntuacio = calculaPuntuacio(avaluacio, config.pesosPuntuacio);

  if (mostra.mesures.nCares !== 1) {
    // Els avisos ja porten «No et veiem la cara» o «Només hi ha de sortir una persona».
    return {
      retallada: retallaCentrat(completa, { ppp }),
      puntuacio: sensePuntuacio,
      avisos: [...avisos, 'avis.senseCara']
    };
  }
  const retall = calculaRetallCap(mostra.landmarks, mostra.mascara, completa.width, completa.height, config.sortida);
  if (!retall) {
    return {
      retallada: retallaCentrat(completa, { ppp }),
      puntuacio: sensePuntuacio,
      avisos: [...avisos, 'avis.retallCentrat']
    };
  }
  const foraDeFotograma = retall.fraccioFora > TOLERANCIA_FORA;
  const penalitzacio = penalitzacioFora(retall.fraccioFora, config.sortida.penalitzacioForaFotograma);
  return {
    retallada: retallaRectangle(completa, retall.rect, ppp),
    puntuacio: calculaPuntuacio(avaluacio, config.pesosPuntuacio, penalitzacio),
    avisos: foraDeFotograma ? [...avisos, 'avis.retallFora'] : avisos
  };
}
