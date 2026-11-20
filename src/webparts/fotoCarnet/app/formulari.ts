/** Marcador de la matrícula dins l'URL plantilla del Forms (RF-12). */
export const MARCADOR_MATRICULA = '{MATRICULA}';

export interface IResultatMatricula {
  valida: boolean;
  /** Matrícula sense espais als extrems (el que serà el nom del fitxer). */
  matricula: string;
  /** true si l'expressió regular configurada no és vàlida. */
  regexInvalida: boolean;
}

/** Valida la matrícula amb l'expressió regular configurada (RF-10, P2). */
export function validaMatricula(valor: string, regexFont: string): IResultatMatricula {
  const matricula = valor.trim();
  let regex: RegExp;
  try {
    // La regex és configurable per disseny (config.matriculaRegex).
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp
    regex = new RegExp(regexFont);
  } catch {
    return { valida: false, matricula, regexInvalida: true };
  }
  return { valida: matricula !== '' && regex.test(matricula), matricula, regexInvalida: false };
}

/** Nom del fitxer final: `{matricula}.jpg` (RF-10). */
export function nomFitxer(matricula: string): string {
  return matricula + '.jpg';
}

/**
 * Construeix l'URL del Forms substituint `{MATRICULA}` per `encodeURIComponent(matricula)` (RF-12).
 * Retorna undefined si la plantilla és buida o no conté el marcador.
 */
export function construeixUrlForms(plantilla: string, matricula: string): string | undefined {
  if (!plantilla || plantilla.indexOf(MARCADOR_MATRICULA) === -1) {
    return undefined;
  }
  return plantilla.split(MARCADOR_MATRICULA).join(encodeURIComponent(matricula));
}
