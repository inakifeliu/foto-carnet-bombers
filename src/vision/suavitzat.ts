import { CLAUS_MESURES, type IMesures } from './tipus';

/**
 * Suavitzat per mitjana mòbil (RF-04): finestra de ~0,5 s. Els valors numèrics es fan com a mitjana de les mostres
 * de la finestra amb exactament una cara; el nombre de cares és el més freqüent a la finestra (en cas d'empat,
 * el de la mostra més recent). Si la majoria de la finestra no té exactament una cara, no hi ha valors numèrics.
 */
export class Suavitzador {
  private mostres: { ts: number; m: IMesures }[] = [];

  public constructor(private readonly finestraMs = 500) {}

  public reinicia(): void {
    this.mostres = [];
  }

  public get mida(): number {
    return this.mostres.length;
  }

  public afegeix(ts: number, m: IMesures): IMesures {
    this.mostres.push({ ts, m });
    while (this.mostres.length > 1 && ts - this.mostres[0].ts > this.finestraMs) {
      this.mostres.shift();
    }
    const comptes = new Map<number, number>();
    this.mostres.forEach((x) => comptes.set(x.m.nCares, (comptes.get(x.m.nCares) ?? 0) + 1));
    let nCares = m.nCares;
    let max = comptes.get(nCares) ?? 0;
    comptes.forEach((n, valor) => {
      if (n > max) {
        max = n;
        nCares = valor;
      }
    });
    const sortida: IMesures = { nCares };
    if (nCares !== 1) {
      return sortida;
    }
    const ambCara = this.mostres.filter((x) => x.m.nCares === 1);
    for (const clau of CLAUS_MESURES) {
      let suma = 0;
      let n = 0;
      for (const x of ambCara) {
        const v = x.m[clau];
        if (v !== undefined && isFinite(v)) {
          suma += v;
          n++;
        }
      }
      if (n > 0) {
        sortida[clau] = suma / n;
      }
    }
    return sortida;
  }
}

/**
 * Evita l'spam de missatges: el missatge mostrat només canvia quan el candidat nou s'ha mantingut `mostresNecessaries`
 * avaluacions seguides (≈0,25 s a 12 fps). Retorna el missatge mostrat.
 */
export class EstabilitzadorMissatge<T> {
  private actual: T | undefined;
  private candidat: T | undefined;
  private repeticions = 0;

  public constructor(private readonly mostresNecessaries = 3) {}

  public reinicia(): void {
    this.actual = undefined;
    this.candidat = undefined;
    this.repeticions = 0;
  }

  public push(nou: T | undefined): T | undefined {
    if (nou === this.actual) {
      this.candidat = nou;
      this.repeticions = 0;
      return this.actual;
    }
    if (nou === this.candidat) {
      this.repeticions++;
    } else {
      this.candidat = nou;
      this.repeticions = 1;
    }
    if (this.repeticions >= this.mostresNecessaries) {
      this.actual = nou;
      this.repeticions = 0;
    }
    return this.actual;
  }
}
