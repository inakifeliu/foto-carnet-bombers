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

export type CodiAvis = 'jsonInvalid' | 'jsonNoObjecte' | 'regexInvalida' | 'pppInvalid';

export interface IConfigResolta {
  config: IConfig;
  /** Avisos no bloquejants: els valors invàlids s'ignoren i s'usen els per defecte. */
  avisos: CodiAvis[];
}

export const CONFIG_PER_DEFECTE: IConfig = defaultConfigJson as IConfig;

type Objecte = Record<string, unknown>;

function esObjecte(v: unknown): v is Objecte {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
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
 * Configuració efectiva = per defecte <- JSON avançat <- camps explícits del panell
 * (URL, regex, ppp). Els valors buits o invàlids s'ignoren i generen un avís.
 */
export function resolConfig(props: IPropietatsConfig): IConfigResolta {
  const avisos: CodiAvis[] = [];
  let config = CONFIG_PER_DEFECTE;

  const avisJson = validaJsonAvancat(props.configAvancada);
  if (avisJson) {
    avisos.push(avisJson);
  } else if (props.configAvancada && props.configAvancada.trim() !== '') {
    config = fusioProfunda(config, JSON.parse(props.configAvancada));
  }

  const explicit: Objecte = {};
  if (props.urlPlantilla && props.urlPlantilla.trim() !== '') {
    explicit.forms = { urlPlantilla: props.urlPlantilla.trim() };
  }
  if (props.matriculaRegex && props.matriculaRegex.trim() !== '') {
    explicit.matriculaRegex = props.matriculaRegex;
  }
  if (props.ppp !== undefined) {
    if (props.ppp === 300 || props.ppp === 600) {
      explicit.sortida = { ppp: props.ppp };
    } else {
      avisos.push('pppInvalid');
    }
  }
  config = fusioProfunda(config, explicit);

  // La regex efectiva (del panell o del JSON avançat) ha de ser vàlida.
  if (!validaRegex(config.matriculaRegex)) {
    avisos.push('regexInvalida');
    config = fusioProfunda(config, { matriculaRegex: CONFIG_PER_DEFECTE.matriculaRegex });
  }
  return { config, avisos };
}
