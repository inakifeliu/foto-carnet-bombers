import ca from './ca.json';

export type ClauI18n = keyof typeof ca;
export type VarsI18n = Record<string, string | number>;

/** Substitueix `{var}` pel valor de `vars`; els marcadors sense valor es deixen tal qual. */
export function interpola(text: string, vars?: VarsI18n): string {
  if (!vars) {
    return text;
  }
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (marcador: string, nom: string) =>
    Object.prototype.hasOwnProperty.call(vars, nom) ? String(vars[nom]) : marcador
  );
}

/** Text de la interfície (català) per clau, amb interpolació `{var}`. */
export function t(clau: ClauI18n, vars?: VarsI18n): string {
  const text = (ca as Record<string, string>)[clau];
  return interpola(text === undefined ? clau : text, vars);
}
