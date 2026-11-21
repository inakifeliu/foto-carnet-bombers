/**
 * Avaluació d'un valor contra un llindar amb marge àmbar (RF-05).
 *  - verd (`ok`): compleix el llindar tal com diu la spec;
 *  - àmbar (`avis`): no el compleix però és a prop (fins a `marge` × el llindar més enllà);
 *  - vermell (`error`): més lluny.
 * `excesRel` = com de lluny del llindar, en fracció del llindar (0 si compleix).
 * `marge01` = 0..1, com de còmode és el valor dins el llindar (1 = ideal); per a la puntuació.
 */
export interface IAvaluacioLlindar {
  estat: 'ok' | 'avis' | 'error';
  excesRel: number;
  marge01: number;
  /** Per als intervals: per quin costat falla. */
  costat?: 'baix' | 'alt';
}

const EPS = 1e-9;
const limita01 = (x: number): number => Math.max(0, Math.min(1, x));

function classifica(excesRel: number, marge: number): 'ok' | 'avis' | 'error' {
  if (excesRel <= 0) {
    return 'ok';
  }
  return excesRel <= marge + EPS ? 'avis' : 'error';
}

/** `valor ≤ limit` és correcte. */
export function avaluaMaxim(valor: number, limit: number, marge: number): IAvaluacioLlindar {
  const base = Math.max(Math.abs(limit), EPS);
  const excesRel = Math.max(0, (valor - limit) / base);
  return { estat: classifica(excesRel, marge), excesRel, marge01: limita01(1 - valor / base), costat: 'alt' };
}

/** `valor ≥ limit` és correcte; `ideal` és el valor que dona marge 1. */
export function avaluaMinim(valor: number, limit: number, marge: number, ideal: number): IAvaluacioLlindar {
  const base = Math.max(Math.abs(limit), EPS);
  const excesRel = Math.max(0, (limit - valor) / base);
  const span = Math.max(ideal - limit, EPS);
  return { estat: classifica(excesRel, marge), excesRel, marge01: limita01((valor - limit) / span), costat: 'baix' };
}

/** `min ≤ valor ≤ max` és correcte; l'excés es mesura respecte del límit incomplert. */
export function avaluaInterval(valor: number, min: number, max: number, marge: number): IAvaluacioLlindar {
  if (valor < min) {
    const excesRel = (min - valor) / Math.max(Math.abs(min), EPS);
    return { estat: classifica(excesRel, marge), excesRel, marge01: 0, costat: 'baix' };
  }
  if (valor > max) {
    const excesRel = (valor - max) / Math.max(Math.abs(max), EPS);
    return { estat: classifica(excesRel, marge), excesRel, marge01: 0, costat: 'alt' };
  }
  const meitat = Math.max((max - min) / 2, EPS);
  return { estat: 'ok', excesRel: 0, marge01: limita01(1 - Math.abs(valor - (min + max) / 2) / meitat) };
}

/**
 * Contribució d'un control a la puntuació (0..1): «distància al llindar».
 * Dins el llindar: 0,85 + 0,15 × marge01. Fora: 0,85 × (1 − excesRel), mínim 0 (un 100% més enllà = 0).
 */
export function puntuacioControl(a: Pick<IAvaluacioLlindar, 'estat' | 'excesRel' | 'marge01'>): number {
  if (a.estat === 'ok') {
    return 0.85 + 0.15 * a.marge01;
  }
  return 0.85 * Math.max(0, 1 - a.excesRel);
}
