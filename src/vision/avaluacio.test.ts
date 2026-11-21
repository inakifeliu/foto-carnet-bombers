import { LLINDARS, PESOS, mesuresBones, mesuresDolentes, mesuresPerfectes } from '../test/escena';
import { avalua, calculaPuntuacio, missatgesAvis } from './avaluacio';
import type { ClauControl, IMesures } from './tipus';

const av = (m: Partial<IMesures>): ReturnType<typeof avalua> => avalua({ ...mesuresBones(), ...m }, LLINDARS);
const avP = (m: Partial<IMesures>): ReturnType<typeof avalua> => avalua({ ...mesuresPerfectes(), ...m }, LLINDARS);

describe('avalua: tot correcte', () => {
  it('amb mesures bones, tots verds, sense missatge', () => {
    const r = av({});
    expect(r.totOk).toBe(true);
    expect(r.missatge).toBeUndefined();
    Object.values(r.controls).forEach((c) => expect(c.estat).toBe('ok'));
  });
});

describe('avalua: cada control (verd / àmbar / vermell i límits)', () => {
  const estat = (m: Partial<IMesures>, c: ClauControl): string => av(m).controls[c].estat;
  const missatge = (m: Partial<IMesures>, c: ClauControl): string | undefined => av(m).controls[c].missatge;

  it('5.1 una sola cara', () => {
    expect(avalua({ nCares: 0 }, LLINDARS).controls.cara.estat).toBe('error');
    expect(avalua({ nCares: 0 }, LLINDARS).missatge).toBe('p3.msg.capCara');
    expect(avalua({ nCares: 2 }, LLINDARS).missatge).toBe('p3.msg.moltesCares');
    expect(av({}).controls.cara.estat).toBe('ok');
  });

  it('sense exactament una cara, la resta de controls són «cap»', () => {
    const r = avalua({ nCares: 0 }, LLINDARS);
    expect(r.controls.distancia.estat).toBe('cap');
    expect(r.controls.nitidesa.estat).toBe('cap');
    expect(r.totOk).toBe(false);
  });

  it('5.2 centrat (≤ 8% de l’amplada) i direcció amb el mirall', () => {
    expect(estat({ desviacio: 0.08 }, 'centrat')).toBe('ok');
    expect(estat({ desviacio: -0.08 }, 'centrat')).toBe('ok');
    expect(estat({ desviacio: 0.09 }, 'centrat')).toBe('avis');
    expect(estat({ desviacio: 0.15 }, 'centrat')).toBe('error');
    // Cara a l’esquerra del fotograma sense mirall (negatiu) → a la dreta de la pantalla → «Mou-te a l’esquerra».
    expect(missatge({ desviacio: -0.15 }, 'centrat')).toBe('p3.msg.movEsq');
    expect(missatge({ desviacio: 0.15 }, 'centrat')).toBe('p3.msg.movDre');
  });

  it('5.3 distància (0,22–0,30 de l’alçada del visor)', () => {
    expect(estat({ alcadaCara: 0.22 }, 'distancia')).toBe('ok');
    expect(estat({ alcadaCara: 0.3 }, 'distancia')).toBe('ok');
    expect(estat({ alcadaCara: 0.21 }, 'distancia')).toBe('avis');
    expect(estat({ alcadaCara: 0.12 }, 'distancia')).toBe('error');
    expect(missatge({ alcadaCara: 0.12 }, 'distancia')).toBe('p3.msg.apropa');
    expect(estat({ alcadaCara: 0.35 }, 'distancia')).toBe('avis');
    expect(missatge({ alcadaCara: 0.5 }, 'distancia')).toBe('p3.msg.allunya');
  });

  it('5.4 orientació: yaw/pitch ≤ 8°, roll ≤ 5° i missatges direccionals', () => {
    expect(estat({ yaw: 8, pitch: -8, roll: 5 }, 'orientacio')).toBe('ok');
    expect(estat({ yaw: 9.5 }, 'orientacio')).toBe('avis');
    expect(estat({ yaw: 20 }, 'orientacio')).toBe('error');
    expect(estat({ roll: 6 }, 'orientacio')).toBe('avis');
    expect(estat({ roll: 9 }, 'orientacio')).toBe('error');
    // yaw > 0: el nas apunta a la dreta de la imatge sense mirall (esquerra de la persona) → «Gira el cap a la dreta».
    expect(missatge({ yaw: 20 }, 'orientacio')).toBe('p3.msg.giraDre');
    expect(missatge({ yaw: -20 }, 'orientacio')).toBe('p3.msg.giraEsq');
    expect(missatge({ pitch: 20 }, 'orientacio')).toBe('p3.msg.aixeca');
    expect(missatge({ pitch: -20 }, 'orientacio')).toBe('p3.msg.abaixa');
    expect(missatge({ roll: 20 }, 'orientacio')).toBe('p3.msg.recte');
  });

  it('5.4 amb diverses mètriques fallant mostra la d’excés relatiu més gran', () => {
    expect(missatge({ yaw: 9, roll: 15 }, 'orientacio')).toBe('p3.msg.recte');
    expect(missatge({ yaw: 30, roll: 6 }, 'orientacio')).toBe('p3.msg.giraDre');
  });

  it('5.5 ulls oberts i boca tancada', () => {
    expect(estat({ parpelleig: 0.4, bocaOberta: 0.15 }, 'ullsBoca')).toBe('ok');
    expect(estat({ parpelleig: 0.45 }, 'ullsBoca')).toBe('avis');
    expect(missatge({ parpelleig: 0.9 }, 'ullsBoca')).toBe('p3.msg.ulls');
    expect(estat({ bocaOberta: 0.18 }, 'ullsBoca')).toBe('avis');
    expect(missatge({ bocaOberta: 0.6 }, 'ullsBoca')).toBe('p3.msg.boca');
  });

  it('5.6 fons blanc (≥ 85%); sense dades de fons és «cap»', () => {
    expect(estat({ fons: 0.85 }, 'fons')).toBe('ok');
    expect(estat({ fons: 0.8 }, 'fons')).toBe('avis');
    expect(estat({ fons: 0.5 }, 'fons')).toBe('error');
    expect(missatge({ fons: 0.5 }, 'fons')).toBe('p3.msg.fonsNoBlanc');
    expect(estat({ fons: undefined }, 'fons')).toBe('cap');
  });

  it('5.7 il·luminació (100–210)', () => {
    expect(estat({ llum: 100 }, 'llum')).toBe('ok');
    expect(estat({ llum: 210 }, 'llum')).toBe('ok');
    expect(estat({ llum: 90 }, 'llum')).toBe('avis');
    expect(estat({ llum: 40 }, 'llum')).toBe('error');
    expect(missatge({ llum: 40 }, 'llum')).toBe('p3.msg.massaFosc');
    expect(estat({ llum: 230 }, 'llum')).toBe('avis');
    expect(missatge({ llum: 250 }, 'llum')).toBe('p3.msg.massaLlum');
  });

  it('5.8 ombres (≤ 25%)', () => {
    expect(estat({ ombra: 0.25 }, 'ombra')).toBe('ok');
    expect(estat({ ombra: 0.3 }, 'ombra')).toBe('avis');
    expect(estat({ ombra: 0.6 }, 'ombra')).toBe('error');
    expect(missatge({ ombra: 0.6 }, 'ombra')).toBe('p3.msg.ombra');
  });

  it('5.9 nitidesa (variància del Laplacià > 100)', () => {
    expect(estat({ nitidesa: 100 }, 'nitidesa')).toBe('ok');
    expect(estat({ nitidesa: 90 }, 'nitidesa')).toBe('avis');
    expect(estat({ nitidesa: 10 }, 'nitidesa')).toBe('error');
    expect(missatge({ nitidesa: 10 }, 'nitidesa')).toBe('p3.msg.nitidesa');
  });

  it('5.10 polo blau (≥ 50%); sense zona de tors és «cap»', () => {
    expect(estat({ polo: 0.5 }, 'polo')).toBe('ok');
    expect(estat({ polo: 0.45 }, 'polo')).toBe('avis');
    expect(estat({ polo: 0.1 }, 'polo')).toBe('error');
    expect(missatge({ polo: 0.1 }, 'polo')).toBe('p3.msg.polo');
    expect(estat({ polo: undefined }, 'polo')).toBe('cap');
  });

  it('5.11 espatlles dins el fotograma', () => {
    expect(estat({ torsVisible: 1 }, 'espatlles')).toBe('ok');
    expect(estat({ torsVisible: 0.85 }, 'espatlles')).toBe('ok');
    expect(estat({ torsVisible: 0.8 }, 'espatlles')).toBe('avis');
    expect(estat({ torsVisible: 0.3 }, 'espatlles')).toBe('error');
    expect(missatge({ torsVisible: 0.3 }, 'espatlles')).toBe('p3.msg.espatlles');
  });

  it('un llindar canviat a la configuració canvia el resultat', () => {
    const estricte = avalua({ ...mesuresBones(), yaw: 5 }, { ...LLINDARS, yawMax: 3 });
    expect(estricte.controls.orientacio.estat).toBe('error');
    const sensePrudencia = avalua({ ...mesuresBones(), yaw: 9.5 }, { ...LLINDARS, margeAmbar: 0 });
    expect(sensePrudencia.controls.orientacio.estat).toBe('error');
  });
});

describe('avalua: prioritat dels missatges (5.1 → 5.3 → 5.2 → 5.4 → 5.7 → 5.6 → 5.8 → 5.10 → 5.11 → 5.5 → 5.9)', () => {
  it('amb tot malament, a mesura que es corregeix cada control surt el següent de la llista', () => {
    const esperats: [Partial<IMesures>, string][] = [
      [{}, 'p3.msg.apropa'], // 5.3 distància
      [{ alcadaCara: 0.26 }, 'p3.msg.movDre'], // 5.2 centrat
      [{ desviacio: 0 }, 'p3.msg.recte'], // 5.4 orientació (la inclinació és la que més s’allunya del llindar)
      [{ yaw: 0, pitch: 0, roll: 0 }, 'p3.msg.massaFosc'], // 5.7 llum
      [{ llum: 155 }, 'p3.msg.fonsNoBlanc'], // 5.6 fons
      [{ fons: 0.97 }, 'p3.msg.ombra'], // 5.8 ombres
      [{ ombra: 0.05 }, 'p3.msg.polo'], // 5.10 polo
      [{ polo: 0.9 }, 'p3.msg.espatlles'], // 5.11 espatlles
      [{ torsVisible: 1 }, 'p3.msg.boca'], // 5.5 ulls/boca (la boca s’allunya més del llindar)
      [{ parpelleig: 0.05, bocaOberta: 0.02 }, 'p3.msg.nitidesa'] // 5.9 nitidesa
    ];
    let m: IMesures = mesuresDolentes();
    esperats.forEach(([canvi, missatge]) => {
      m = { ...m, ...canvi };
      expect(avalua(m, LLINDARS).missatge).toBe(missatge);
    });
    m = { ...m, nitidesa: 500 };
    expect(avalua(m, LLINDARS).missatge).toBeUndefined();
  });

  it('5.1 té prioritat sobre qualsevol altre', () => {
    expect(avalua({ ...mesuresDolentes(), nCares: 2 }, LLINDARS).missatge).toBe('p3.msg.moltesCares');
    expect(avalua({ ...mesuresDolentes(), nCares: 0 }, LLINDARS).missatge).toBe('p3.msg.capCara');
  });

  it('missatgesAvis llista tots els controls no verds en ordre de prioritat', () => {
    const r = avalua({ ...mesuresBones(), nitidesa: 5, alcadaCara: 0.1, llum: 20 }, LLINDARS);
    expect(missatgesAvis(r)).toEqual(['p3.msg.apropa', 'p3.msg.massaFosc', 'p3.msg.nitidesa']);
  });
});

describe('calculaPuntuacio', () => {
  it('mesures perfectes: 100', () => {
    expect(calculaPuntuacio(avP({}), PESOS)).toBe(100);
  });

  it('tot just al llindar: 85', () => {
    const limit: Partial<IMesures> = {
      desviacio: 0.08,
      alcadaCara: 0.3,
      yaw: 8,
      pitch: 8,
      roll: 5,
      parpelleig: 0.4,
      bocaOberta: 0.15,
      llum: 100,
      ombra: 0.25,
      nitidesa: 100,
      fons: 0.85,
      polo: 0.5,
      torsVisible: 0.85
    };
    expect(calculaPuntuacio(av(limit), PESOS)).toBe(85);
  });

  it('un sol control molt fora de llindar resta segons el seu pes', () => {
    // orientació (pes 2 de 14) a 0 → (14 − 2) / 14 = 85,7 → 86
    expect(calculaPuntuacio(avP({ yaw: 40 }), PESOS)).toBe(86);
    // ombra (pes 1) a 0 → 13/14 = 92,9 → 93
    expect(calculaPuntuacio(avP({ ombra: 0.9 }), PESOS)).toBe(93);
  });

  it('una foto pitjor puntua menys que una de millor', () => {
    const bona = calculaPuntuacio(avP({}), PESOS);
    const regular = calculaPuntuacio(av({ llum: 90, fons: 0.8 }), PESOS);
    const dolenta = calculaPuntuacio(avalua(mesuresDolentes(), LLINDARS), PESOS);
    expect(bona).toBeGreaterThan(regular);
    expect(regular).toBeGreaterThan(dolenta);
    expect(dolenta).toBeLessThan(20);
  });

  it('la penalització es resta i el resultat es limita a 0–100', () => {
    expect(calculaPuntuacio(avP({}), PESOS, 20)).toBe(80);
    expect(calculaPuntuacio(avP({}), PESOS, 500)).toBe(0);
  });

  it('sense exactament una cara, 0', () => {
    expect(calculaPuntuacio(avalua({ nCares: 0 }, LLINDARS), PESOS)).toBe(0);
    expect(calculaPuntuacio(avalua({ ...mesuresBones(), nCares: 2 }, LLINDARS), PESOS)).toBe(0);
  });

  it('els pesos de la configuració compten', () => {
    const nomesOrientacio = {
      ...PESOS,
      fons: 0,
      llum: 0,
      ombra: 0,
      nitidesa: 0,
      polo: 0,
      centrat: 0,
      distancia: 0,
      espatlles: 0,
      ullsBoca: 0
    };
    expect(calculaPuntuacio(avP({ yaw: 40 }), nomesOrientacio)).toBe(0);
    expect(calculaPuntuacio(avP({ ombra: 0.9 }), nomesOrientacio)).toBe(100);
  });
});

describe('avalua: «no disponible» sense segmentació', () => {
  const sense = (m: Partial<IMesures> = {}): ReturnType<typeof avalua> =>
    avalua({ ...mesuresBones(), ...m }, LLINDARS, { segmentacio: false });

  it('fons, polo i espatlles passen a noDisp; els altres no', () => {
    const r = sense();
    (['fons', 'polo', 'espatlles'] as ClauControl[]).forEach((c) => expect(r.controls[c].estat).toBe('noDisp'));
    (['cara', 'distancia', 'centrat', 'orientacio', 'llum', 'ombra', 'ullsBoca', 'nitidesa'] as ClauControl[]).forEach(
      (c) => expect(r.controls[c].estat).toBe('ok')
    );
  });

  it('no compten per a totOk: la resta en verd és «Perfecte», encara que les mesures del fons siguin dolentes', () => {
    const r = sense({ fons: 0.1, polo: 0, torsVisible: 0 });
    expect(r.totOk).toBe(true);
    expect(r.missatge).toBeUndefined();
  });

  it('un control real en vermell continua impedint totOk i dona el seu missatge', () => {
    const r = sense({ llum: 20 });
    expect(r.totOk).toBe(false);
    expect(r.missatge).toBe('p3.msg.massaFosc');
  });

  it('un noDisp no genera cap avís de foto', () => {
    expect(missatgesAvis(sense({ fons: 0.1, polo: 0 }))).toEqual([]);
  });

  it('sense cara també es veu «no disponible» (i la cara en error)', () => {
    const r = avalua({ nCares: 0 }, LLINDARS, { segmentacio: false });
    expect(r.controls.cara.estat).toBe('error');
    expect(r.controls.fons.estat).toBe('noDisp');
    expect(r.controls.distancia.estat).toBe('cap');
    expect(r.totOk).toBe(false);
  });

  it('amb segmentació (per defecte o explícita) els controls són els de sempre', () => {
    expect(avalua(mesuresBones(), LLINDARS, { segmentacio: true }).controls.fons.estat).toBe('ok');
    expect(avalua({ ...mesuresBones(), fons: 0.2 }, LLINDARS).controls.fons.estat).toBe('error');
  });

  it('la puntuació exclou els noDisp i repondera els altres pesos', () => {
    // Tot perfecte tret de les mesures de màscara, que serien dolentes: sense màscara no han de penalitzar.
    const dolentesMascara = { ...mesuresPerfectes(), fons: 0, polo: 0, torsVisible: 0 };
    expect(calculaPuntuacio(avalua(dolentesMascara, LLINDARS, { segmentacio: false }), PESOS)).toBe(100);
    expect(calculaPuntuacio(avalua(dolentesMascara, LLINDARS), PESOS)).toBeLessThan(90);
  });

  it('amb un control real dolent, la puntuació es calcula només amb els pesos que queden', () => {
    // L’orientació (pes 2) a 0 pesa més quan hi ha menys controls en joc: el resultat és pitjor.
    const amb = calculaPuntuacio(avalua({ ...mesuresPerfectes(), yaw: 40 }, LLINDARS), PESOS);
    const sense = calculaPuntuacio(avalua({ ...mesuresPerfectes(), yaw: 40 }, LLINDARS, { segmentacio: false }), PESOS);
    expect(sense).toBeLessThan(amb);
  });
});
