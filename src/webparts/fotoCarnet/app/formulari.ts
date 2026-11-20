/** Marcador de la matrícula dins l'URL plantilla del Forms (RF-12). */
export const MARCADOR_MATRICULA = '{MATRICULA}';

export interface IResultatMatricula {
  valida: boolean;
  /** Matrícula sense espais als extrems (el que serà el nom del fitxer). */
  matricula: string;
  /** true si l'expressió regular configurada no és vàlida. */
  regexInvalida: boolean;
}

/** Caràcters prohibits en un nom de fitxer (Windows, el més restrictiu) i caràcters de control. */
// eslint-disable-next-line no-control-regex
const CARACTERS_PROHIBITS = /[/\\:*?"<>|\u0000-\u001f]/;
const NOMS_RESERVATS_WINDOWS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Indica si la matrícula és segura com a nom de fitxer (`{matricula}.jpg`): sense separadors
 * de ruta ni caràcters prohibits, sense `..`, ni punts o espais als extrems, ni noms reservats.
 */
export function esNomFitxerSegur(matricula: string): boolean {
  return (
    matricula !== '' &&
    !CARACTERS_PROHIBITS.test(matricula) &&
    matricula.indexOf('..') === -1 &&
    !/^[. ]|[. ]$/.test(matricula) &&
    !NOMS_RESERVATS_WINDOWS.test(matricula)
  );
}

/**
 * Valida la matrícula (RF-10, P2): ha de coincidir COMPLETAMENT amb l'expressió regular
 * configurada (s'embolcalla com a `^(?:…)$`) i ha de ser segura com a nom de fitxer.
 */
export function validaMatricula(valor: string, regexFont: string): IResultatMatricula {
  const matricula = valor.trim();
  let regex: RegExp;
  try {
    // La regex és configurable per disseny (config.matriculaRegex).
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
    regex = new RegExp('^(?:' + regexFont + ')$');
  } catch {
    return { valida: false, matricula, regexInvalida: true };
  }
  return {
    valida: esNomFitxerSegur(matricula) && regex.test(matricula),
    matricula,
    regexInvalida: false
  };
}

/** Nom del fitxer final: `{matricula}.jpg` (RF-10). */
export function nomFitxer(matricula: string): string {
  return matricula + '.jpg';
}

export type DiagnosticPlantilla = 'ok' | 'sensePlantilla' | 'noHttps';

/**
 * Comprova la plantilla de l'URL del Forms: ha de contenir el marcador i, un cop substituït,
 * ser una URL absoluta amb l'esquema `https:`.
 */
export function diagnosticaPlantilla(plantilla: string): DiagnosticPlantilla {
  if (typeof plantilla !== 'string' || plantilla.indexOf(MARCADOR_MATRICULA) === -1) {
    return 'sensePlantilla';
  }
  try {
    const url = new URL(plantilla.split(MARCADOR_MATRICULA).join('0'));
    return url.protocol === 'https:' ? 'ok' : 'noHttps';
  } catch {
    return 'noHttps';
  }
}

/**
 * Construeix l'URL del Forms substituint `{MATRICULA}` per `encodeURIComponent(matricula)` (RF-12).
 * Retorna undefined si la plantilla és buida, no conté el marcador o no és `https:`.
 */
export function construeixUrlForms(plantilla: string, matricula: string): string | undefined {
  if (diagnosticaPlantilla(plantilla) !== 'ok') {
    return undefined;
  }
  return plantilla.split(MARCADOR_MATRICULA).join(encodeURIComponent(matricula));
}
