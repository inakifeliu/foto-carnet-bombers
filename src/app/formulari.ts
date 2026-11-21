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
    regex = compilaRegexMatricula(regexFont);
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

/**
 * Hosts de Microsoft Forms acceptats per a l'URL del Forms (comparació EXACTA del host, mai per sufix:
 * així `forms.office.com.exemple.cat` o `exemple.forms.office.com` no passen). Si Microsoft en
 * canvia o n'afegeix, cal ampliar aquesta llista i tornar a compilar.
 */
export const HOSTS_FORMS: readonly string[] = ['forms.office.com', 'forms.microsoft.com', 'forms.cloud.microsoft'];

/** Marcador de l'URL d'exemple (config.json) que encara no és el Forms real (Fase 5). */
export const MARCADOR_FORMS_PROVISIONAL = 'XXXX';

/** Embolcalla la regex de la matrícula exactament com la fa servir `validaMatricula`. */
export function compilaRegexMatricula(regexFont: string): RegExp {
  return new RegExp('^(?:' + regexFont + ')$');
}

export type DiagnosticPlantilla = 'ok' | 'sensePlantilla' | 'noHttps' | 'hostNoPermes';

/**
 * Comprova la plantilla de l'URL del Forms: ha de contenir el marcador i, un cop substituït,
 * ser una URL absoluta amb l'esquema `https:` i amb un host de Microsoft Forms (`HOSTS_FORMS`).
 */
export function diagnosticaPlantilla(plantilla: string): DiagnosticPlantilla {
  if (typeof plantilla !== 'string' || plantilla.indexOf(MARCADOR_MATRICULA) === -1) {
    return 'sensePlantilla';
  }
  try {
    const url = new URL(plantilla.split(MARCADOR_MATRICULA).join('0'));
    if (url.protocol !== 'https:') {
      return 'noHttps';
    }
    return HOSTS_FORMS.includes(url.hostname.toLowerCase()) ? 'ok' : 'hostNoPermes';
  } catch {
    return 'noHttps';
  }
}

export interface IAvaluacioForms {
  /** Diagnòstic de la plantilla (`ok` si és correcta). */
  diagnostic: DiagnosticPlantilla;
  /** true si encara porta el marcador provisional `XXXX` (no és el Forms real; avís, no error). */
  provisional: boolean;
}

/** Avaluació de la plantilla del Forms per al build: el mateix diagnòstic que l'app + detecció de `XXXX`. */
export function avaluaPlantillaForms(plantilla: string): IAvaluacioForms {
  return {
    diagnostic: diagnosticaPlantilla(plantilla),
    provisional: typeof plantilla === 'string' && plantilla.indexOf(MARCADOR_FORMS_PROVISIONAL) !== -1
  };
}

/**
 * Construeix l'URL del Forms substituint `{MATRICULA}` per `encodeURIComponent(matricula)` (RF-12).
 * Retorna undefined si la plantilla és buida, no conté el marcador, no és `https:` o el host no és de Forms.
 */
export function construeixUrlForms(plantilla: string, matricula: string): string | undefined {
  if (diagnosticaPlantilla(plantilla) !== 'ok') {
    return undefined;
  }
  return plantilla.split(MARCADOR_MATRICULA).join(encodeURIComponent(matricula));
}
