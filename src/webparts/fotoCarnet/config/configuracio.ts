import defaultConfigJson from './config.default.json';

export interface IConfig {
  matriculaRegex: string;
  maxFotos: number;
  sortida: { ppp: number; qualitatJpeg: number; alcadaCapMm: number; margeSuperiorMm: number };
  forms: { urlPlantilla: string };
  captura: { segonsEstableAbansCompte: number; compteEnrere: number };
  llindars: Record<string, number>;
  pesosPuntuacio: Record<string, number>;
}

/** Propietats del panell de propietats del web part. */
export interface IPropietatsConfig {
  urlPlantilla?: string;
  matriculaRegex?: string;
  ppp?: number;
  configAvancada?: string;
}

export type CodiAvis =
  | 'jsonInvalid'
  | 'jsonNoObjecte'
  | 'regexInvalida'
  | 'pppInvalid'
  | 'maxFotosInvalid'
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

/** Retorna el codi d'avís si el text no és un JSON que sigui un objecte; si és buit o vàlid, undefined. */
export function validaJsonAvancat(text: string | undefined): CodiAvis | undefined {
  if (text === undefined || text.trim() === '') {
    return undefined;
  }
  try {
    return esObjecte(JSON.parse(text)) ? undefined : 'jsonNoObjecte';
  } catch {
    return 'jsonInvalid';
  }
}

export function validaRegex(font: string | undefined): boolean {
  if (font === undefined || font.trim() === '') {
    return true;
  }
  try {
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
    return new RegExp(font) instanceof RegExp;
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
  if (config.matriculaRegex.trim() === '' || !validaRegex(config.matriculaRegex)) {
    avisos.push({ codi: 'regexInvalida', camp: 'matriculaRegex' });
    config.matriculaRegex = CONFIG_PER_DEFECTE.matriculaRegex;
  }
  return config;
}

function resolConfigIntern(props: IPropietatsConfig): IConfigResolta {
  const avisos: IAvis[] = [];
  let fusionada: unknown = CONFIG_PER_DEFECTE;

  const textAvancat = typeof props.configAvancada === 'string' ? props.configAvancada : undefined;
  const avisJson = validaJsonAvancat(textAvancat);
  if (avisJson) {
    avisos.push({ codi: avisJson });
  } else if (textAvancat !== undefined && textAvancat.trim() !== '') {
    fusionada = fusioProfunda(fusionada, JSON.parse(textAvancat));
  }

  const explicit: Objecte = {};
  if (typeof props.urlPlantilla === 'string' && props.urlPlantilla.trim() !== '') {
    explicit.forms = { urlPlantilla: props.urlPlantilla.trim() };
  }
  if (typeof props.matriculaRegex === 'string' && props.matriculaRegex.trim() !== '') {
    explicit.matriculaRegex = props.matriculaRegex;
  }
  if (props.ppp !== undefined && (props.ppp as unknown) !== null) {
    explicit.sortida = { ppp: props.ppp };
  }
  fusionada = fusioProfunda(fusionada, explicit);

  const neta = esObjecte(fusionada)
    ? validaContraDefecte(CONFIG_PER_DEFECTE as unknown as Objecte, fusionada, '', avisos)
    : clona(CONFIG_PER_DEFECTE);
  const config = aplicaRestriccions(clona(neta) as unknown as IConfig, avisos);
  return { config, avisos };
}

/**
 * Configuració efectiva = per defecte <- JSON avançat <- camps explícits del panell
 * (URL, regex, ppp), validada contra la forma de la configuració per defecte.
 * Mai llança excepcions: davant qualsevol error inesperat retorna la configuració per defecte.
 */
export function resolConfig(props: IPropietatsConfig | undefined): IConfigResolta {
  try {
    return resolConfigIntern(props ?? {});
  } catch {
    return { config: clona(CONFIG_PER_DEFECTE), avisos: [{ codi: 'configInvalida' }] };
  }
}
