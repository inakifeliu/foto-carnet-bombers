import { compilaRegexMatricula } from '../app/formulari';
import { midaSortida, type Enquadrament, type MidaSortida } from '../captura/retall';
import defaultConfigJson from './config.default.json';

/** Llindars de qualitat (RF-05). Tots els valors són configurables i s'han de calibrar amb fotos reals (RF-18). */
export interface ILlindars {
  /** 5.2 Desviació màxima del centre de la cara respecte del centre del fotograma (fracció de l'amplada). */
  centratMax: number;
  /** 5.3 Alçada de la cara (front–barbeta) / alçada del fotograma: interval vàlid. */
  alcadaCaraMin: number;
  alcadaCaraMax: number;
  /** 5.4 Angles màxims (graus): gir (yaw), cabotada (pitch), inclinació (roll). */
  yawMax: number;
  pitchMax: number;
  rollMax: number;
  /** 5.5 Blendshapes: parpelleig màxim (eyeBlinkLeft/Right) i obertura de boca màxima (jawOpen). */
  parpelleigMax: number;
  bocaObertaMax: number;
  /** 5.6 Fons: proporció mínima de píxels de fons «blancs» (luminància > fonsLumMin i saturació < fonsSatMax). */
  fonsBlancMin: number;
  fonsLumMin: number;
  fonsSatMax: number;
  /** 5.7 Luminància mitjana de la cara (0-255): interval vàlid. */
  llumCaraMin: number;
  llumCaraMax: number;
  /** 5.8 Diferència relativa de luminància entre les dues meitats de la cara. */
  ombraMax: number;
  /** 5.9 Variància del Laplacià mínima (a calibrar). */
  nitidesaMin: number;
  /** 5.10 Polo blau: to (graus), saturació mínima, valor (min/max) i proporció mínima de píxels de persona. */
  poloHueMin: number;
  poloHueMax: number;
  poloSatMin: number;
  poloValMin: number;
  poloValMax: number;
  poloProporcioMin: number;
  /** 5.11 Fracció mínima de la zona del tors que ha de ser dins del fotograma. */
  torsVisibleMin: number;
  /** Àmbar = fora del llindar però a menys d'aquesta fracció del llindar (p. ex. 0,25 = fins a un 25% més enllà). */
  margeAmbar: number;
  /** Signe (+1 / -1) aplicat als angles yaw i pitch de la matriu facial; es canvia si els missatges direccionals van al revés. */
  yawSigne: number;
  pitchSigne: number;
}

/** Pesos de la puntuació de qualitat (RF-05, final). */
export interface IPesos {
  orientacio: number;
  fons: number;
  llum: number;
  ombra: number;
  nitidesa: number;
  polo: number;
  centrat: number;
  distancia: number;
  espatlles: number;
  ullsBoca: number;
}

export interface IConfig {
  matriculaRegex: string;
  maxFotos: number;
  sortida: {
    ppp: number;
    /** «original» (per defecte): el retall es desa a la resolució de la càmera, sense reescalar; «fixa»: sempre `midaSortida(ppp)`. */
    mida: MidaSortida;
    /** Alçada màxima en píxels amb «original» (per defecte 16384, el màxim admès: a la pràctica, cap reducció). */
    alcadaMaxPx: number;
    qualitatJpeg: number;
    /** «visor» (per defecte): la foto és exactament el que es veu al visor de P3; «cap»: retall RF-07 (cap = alcadaCapMm). */
    enquadrament: Enquadrament;
    alcadaCapMm: number;
    margeSuperiorMm: number;
    /** Punts que es resten a la puntuació si el retall surt del fotograma (proporcional fins a un 10% de l'àrea fora). */
    penalitzacioForaFotograma: number;
  };
  forms: { urlPlantilla: string };
  captura: { segonsEstableAbansCompte: number; compteEnrere: number };
  llindars: ILlindars;
  pesosPuntuacio: IPesos;
}

export type CodiAvis =
  | 'jsonInvalid'
  | 'jsonNoObjecte'
  | 'regexInvalida'
  | 'pppInvalid'
  | 'maxFotosInvalid'
  | 'capturaInvalida'
  | 'valorInvalid'
  | 'campDesconegut'
  | 'configInvalida';

export interface IAvis {
  codi: CodiAvis;
  /** Camí de la clau afectada (p. ex. "sortida.ppp"), si n'hi ha. */
  camp?: string;
}

export interface IConfigResolta {
  config: IConfig;
  /** Avisos no bloquejants: els valors invàlids s'ignoren i s'usen els per defecte. */
  avisos: IAvis[];
}

export const CONFIG_PER_DEFECTE: IConfig = defaultConfigJson as IConfig;

type Objecte = Record<string, unknown>;

function esObjecte(v: unknown): v is Objecte {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function clona<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Fusió profunda: els objectes es fusionen, la resta (primitius, arrays) se substitueix. No muta cap entrada. */
export function fusioProfunda<T>(base: T, sobreescriu: unknown): T {
  if (!esObjecte(base) || !esObjecte(sobreescriu)) {
    return (sobreescriu === undefined ? base : sobreescriu) as T;
  }
  const resultat: Objecte = {};
  Object.keys(base).forEach((k) => {
    resultat[k] = base[k];
  });
  Object.keys(sobreescriu).forEach((k) => {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      return;
    }
    const valor = sobreescriu[k];
    if (valor === undefined) {
      return;
    }
    resultat[k] = k in base ? fusioProfunda(base[k], valor) : valor;
  });
  return resultat as T;
}

export function validaRegex(font: string | undefined): boolean {
  if (font === undefined || font.trim() === '') {
    return true;
  }
  try {
    // Es valida amb el mateix embolcall `^(?:…)$` que usa l'app (validaMatricula).
    return compilaRegexMatricula(font) instanceof RegExp;
  } catch {
    return false;
  }
}

/**
 * Validació de la configuració fusionada contra la forma i els tipus de `config.default.json`.
 * Retorna una còpia neta: cada fulla invàlida torna al valor per defecte i genera un avís;
 * les claus desconegudes s'eliminen (amb avís); els objectes sempre són objectes.
 */
function validaContraDefecte(defecte: Objecte, valor: Objecte, prefix: string, avisos: IAvis[]): Objecte {
  const resultat: Objecte = {};
  Object.keys(defecte).forEach((clau) => {
    const camp = prefix + clau;
    const d = defecte[clau];
    const v = valor[clau];
    if (esObjecte(d)) {
      if (esObjecte(v)) {
        resultat[clau] = validaContraDefecte(d, v, camp + '.', avisos);
      } else {
        if (v !== undefined) {
          avisos.push({ codi: 'valorInvalid', camp });
        }
        resultat[clau] = clona(d);
      }
      return;
    }
    if (v === undefined) {
      resultat[clau] = d;
    } else if (typeof d === 'number' ? typeof v === 'number' && isFinite(v) : typeof v === typeof d) {
      resultat[clau] = v;
    } else {
      avisos.push({ codi: 'valorInvalid', camp });
      resultat[clau] = d;
    }
  });
  Object.keys(valor).forEach((clau) => {
    if (!Object.prototype.hasOwnProperty.call(defecte, clau)) {
      avisos.push({ codi: 'campDesconegut', camp: prefix + clau });
    }
  });
  return resultat;
}

/** Restriccions de domini sobre una configuració que ja té la forma correcta. */
function aplicaRestriccions(config: IConfig, avisos: IAvis[]): IConfig {
  if (config.sortida.ppp !== 300 && config.sortida.ppp !== 600) {
    avisos.push({ codi: 'pppInvalid', camp: 'sortida.ppp' });
    config.sortida.ppp = CONFIG_PER_DEFECTE.sortida.ppp;
  }
  if (!Number.isInteger(config.maxFotos) || config.maxFotos < 1 || config.maxFotos > 10) {
    avisos.push({ codi: 'maxFotosInvalid', camp: 'maxFotos' });
    config.maxFotos = CONFIG_PER_DEFECTE.maxFotos;
  }
  if (config.captura.segonsEstableAbansCompte < 0.1 || config.captura.segonsEstableAbansCompte > 10) {
    avisos.push({ codi: 'capturaInvalida', camp: 'captura.segonsEstableAbansCompte' });
    config.captura.segonsEstableAbansCompte = CONFIG_PER_DEFECTE.captura.segonsEstableAbansCompte;
  }
  if (
    !Number.isInteger(config.captura.compteEnrere) ||
    config.captura.compteEnrere < 1 ||
    config.captura.compteEnrere > 10
  ) {
    avisos.push({ codi: 'capturaInvalida', camp: 'captura.compteEnrere' });
    config.captura.compteEnrere = CONFIG_PER_DEFECTE.captura.compteEnrere;
  }
  if (config.sortida.enquadrament !== 'visor' && config.sortida.enquadrament !== 'cap') {
    avisos.push({ codi: 'valorInvalid', camp: 'sortida.enquadrament' });
    config.sortida.enquadrament = CONFIG_PER_DEFECTE.sortida.enquadrament;
  }
  if (config.sortida.mida !== 'original' && config.sortida.mida !== 'fixa') {
    avisos.push({ codi: 'valorInvalid', camp: 'sortida.mida' });
    config.sortida.mida = CONFIG_PER_DEFECTE.sortida.mida;
  }
  if (
    !Number.isInteger(config.sortida.alcadaMaxPx) ||
    config.sortida.alcadaMaxPx < midaSortida(config.sortida.ppp).h ||
    config.sortida.alcadaMaxPx > 16384
  ) {
    avisos.push({ codi: 'valorInvalid', camp: 'sortida.alcadaMaxPx' });
    config.sortida.alcadaMaxPx = CONFIG_PER_DEFECTE.sortida.alcadaMaxPx;
  }
  (['yawSigne', 'pitchSigne'] as const).forEach((clau) => {
    if (config.llindars[clau] !== 1 && config.llindars[clau] !== -1) {
      avisos.push({ codi: 'valorInvalid', camp: 'llindars.' + clau });
      config.llindars[clau] = CONFIG_PER_DEFECTE.llindars[clau];
    }
  });
  if (config.matriculaRegex.trim() === '' || !validaRegex(config.matriculaRegex)) {
    avisos.push({ codi: 'regexInvalida', camp: 'matriculaRegex' });
    config.matriculaRegex = CONFIG_PER_DEFECTE.matriculaRegex;
  }
  return config;
}

function resolConfigIntern(entrada: unknown): IConfigResolta {
  const avisos: IAvis[] = [];
  if (entrada === undefined || entrada === null) {
    return { config: clona(CONFIG_PER_DEFECTE), avisos };
  }
  if (!esObjecte(entrada)) {
    avisos.push({ codi: 'jsonNoObjecte' });
    return { config: clona(CONFIG_PER_DEFECTE), avisos };
  }
  const fusionada = fusioProfunda<unknown>(CONFIG_PER_DEFECTE, entrada);
  const neta = esObjecte(fusionada)
    ? validaContraDefecte(CONFIG_PER_DEFECTE as unknown as Objecte, fusionada, '', avisos)
    : clona(CONFIG_PER_DEFECTE);
  const config = aplicaRestriccions(clona(neta) as unknown as IConfig, avisos);
  return { config, avisos };
}

/**
 * Configuració efectiva = per defecte <- contingut de `config/config.json`, validada contra la
 * forma i els tipus de `config.default.json`. Mai llança excepcions: davant qualsevol error
 * inesperat retorna la configuració per defecte (amb avís). El build en fa fallar la
 * compilació si hi ha qualsevol avís.
 */
export function resolConfig(entrada: unknown): IConfigResolta {
  try {
    return resolConfigIntern(entrada);
  } catch {
    return { config: clona(CONFIG_PER_DEFECTE), avisos: [{ codi: 'configInvalida' }] };
  }
}

/** Igual que `resolConfig`, però a partir del text JSON del fitxer (JSON no vàlid => avís `jsonInvalid`). */
export function resolConfigDeText(text: string): IConfigResolta {
  let valor: unknown;
  try {
    valor = JSON.parse(text);
  } catch {
    return { config: clona(CONFIG_PER_DEFECTE), avisos: [{ codi: 'jsonInvalid' }] };
  }
  return resolConfig(valor);
}
