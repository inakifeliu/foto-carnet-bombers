import { PARAMS_RETALL, creaLandmarks, creaMascara } from '../test/escena';
import {
  TOLERANCIA_FORA,
  calculaRetallCap,
  estimaCapSuperior,
  penalitzacioFora,
  rectangleRetallCap
} from './retallCap';

describe('rectangleRetallCap: geometria RF-07', () => {
  it('el cap ocupa 34/45 de l’alçada, el marge superior 4/45 i el cap queda centrat', () => {
    // Fotograma 1920×1080; cap de y=300 a y=700 (400 px), centre x = 960.
    const r = rectangleRetallCap(1920, 1080, 700, 300, 960, PARAMS_RETALL);
    expect(r).toBeDefined();
    if (!r) {
      return;
    }
    expect(r.rect.h).toBe(Math.round((400 * 45) / 34)); // 529
    expect(Math.abs(r.rect.w - (r.rect.h * 35) / 45)).toBeLessThanOrEqual(1); // ≈ 412
    expect(400 / r.rect.h).toBeCloseTo(34 / 45, 2);
    expect((300 - r.rect.y) / r.rect.h).toBeCloseTo(4 / 45, 2);
    expect(Math.abs(r.rect.x + r.rect.w / 2 - 960)).toBeLessThanOrEqual(1);
    expect(r.fraccioFora).toBe(0);
    expect(r.fora).toEqual({ esq: 0, dalt: 0, dreta: 0, baix: 0 });
  });

  it('la proporció del retall és 35:45', () => {
    const r = rectangleRetallCap(1920, 1080, 800, 250, 900, PARAMS_RETALL);
    expect(r).toBeDefined();
    expect((r?.rect.w ?? 0) / (r?.rect.h ?? 1)).toBeCloseTo(35 / 45, 2);
  });

  it('els mm configurats canvien l’enquadrament', () => {
    const a = rectangleRetallCap(1920, 1080, 700, 300, 960, { alcadaCapMm: 34, margeSuperiorMm: 4 });
    const b = rectangleRetallCap(1920, 1080, 700, 300, 960, { alcadaCapMm: 30, margeSuperiorMm: 6 });
    expect(b?.rect.h).toBeGreaterThan(a?.rect.h ?? 0);
  });

  it('fora del fotograma per dalt: avís i fracció', () => {
    const r = rectangleRetallCap(1920, 1080, 700, 20, 960, PARAMS_RETALL);
    expect(r).toBeDefined();
    // cap de 680 px → retall de 900 px; y = 20 − 4/45·900 = −60
    expect(r?.fora.dalt).toBe(60);
    expect(r?.fora.baix).toBe(0);
    expect(r?.fraccioFora).toBeCloseTo(60 / 900, 3);
    expect(r?.fraccioFora ?? 0).toBeGreaterThan(TOLERANCIA_FORA);
  });

  it('fora del fotograma per baix (la barbeta massa avall)', () => {
    const r = rectangleRetallCap(1920, 1080, 1060, 600, 960, PARAMS_RETALL);
    expect(r?.fora.baix).toBeGreaterThan(0);
    expect(r?.fraccioFora ?? 0).toBeGreaterThan(TOLERANCIA_FORA);
  });

  it('fora del fotograma pels costats (cara a la vora)', () => {
    const esq = rectangleRetallCap(1920, 1080, 700, 300, 100, PARAMS_RETALL);
    expect(esq?.fora.esq).toBeGreaterThan(0);
    const dre = rectangleRetallCap(1920, 1080, 700, 300, 1850, PARAMS_RETALL);
    expect(dre?.fora.dreta).toBeGreaterThan(0);
  });

  it('un arrodoniment d’uns pocs píxels no compta com a «fora»', () => {
    const r = rectangleRetallCap(1920, 1080, 700, 300, 205, PARAMS_RETALL); // x = 205 − 206 ≈ −1
    expect(r?.fraccioFora ?? 1).toBeLessThanOrEqual(TOLERANCIA_FORA);
  });

  it('entrades no vàlides: undefined', () => {
    expect(rectangleRetallCap(1920, 1080, 300, 700, 960, PARAMS_RETALL)).toBeUndefined(); // barbeta per sobre del cap
    expect(rectangleRetallCap(1920, 1080, NaN, 300, 960, PARAMS_RETALL)).toBeUndefined();
    expect(rectangleRetallCap(1920, 1080, 700, 300, 960, { alcadaCapMm: 0, margeSuperiorMm: 4 })).toBeUndefined();
    expect(rectangleRetallCap(1920, 1080, 700, 300, 960, { alcadaCapMm: 45, margeSuperiorMm: 4 })).toBeUndefined();
    expect(rectangleRetallCap(1920, 1080, 701, 700, 960, PARAMS_RETALL)).toBeUndefined(); // cap d'1 px → retall absurd
  });
});

describe('penalitzacioFora', () => {
  it('0 sota la tolerància; proporcional fins a un 10%; constant a partir d’aquí', () => {
    expect(penalitzacioFora(0, 20)).toBe(0);
    expect(penalitzacioFora(TOLERANCIA_FORA, 20)).toBe(0);
    expect(penalitzacioFora(0.05, 20)).toBeCloseTo(10, 6);
    expect(penalitzacioFora(0.1, 20)).toBeCloseTo(20, 6);
    expect(penalitzacioFora(0.6, 20)).toBe(20);
  });
});

describe('estimaCapSuperior', () => {
  // Cara: centre 0,5; front a 0,30; barbeta a 0,62 (alçada 0,32); amplada 0,2.
  const lm = creaLandmarks({ centreX: 0.5, yFront: 0.3, yBarbeta: 0.62, ample: 0.2 });

  it('amb màscara: puja per la columna central fins al primer píxel que ja no és persona', () => {
    const m = creaMascara(100, 100, (x, y) => x >= 40 && x <= 60 && y >= 20);
    const e = estimaCapSuperior(lm, m);
    expect(e?.origen).toBe('mascara');
    expect(e?.y).toBeCloseTo(0.2, 6);
  });

  it('retrocés: sense màscara, landmark 10 + 0,25 × alçada front–barbeta (cap amunt)', () => {
    const e = estimaCapSuperior(lm, undefined);
    expect(e?.origen).toBe('landmarks');
    expect(e?.y).toBeCloseTo(0.3 - 0.25 * 0.32, 9);
  });

  it('retrocés si el punt de partida no és persona (màscara inservible)', () => {
    const m = creaMascara(100, 100, () => false);
    expect(estimaCapSuperior(lm, m)?.origen).toBe('landmarks');
  });

  it('retrocés si la màscara no va més amunt del front (cap al front)', () => {
    const m = creaMascara(100, 100, (x, y) => x >= 40 && x <= 60 && y >= 30);
    expect(estimaCapSuperior(lm, m)?.origen).toBe('landmarks');
  });

  it('retrocés si el resultat és inversemblant (cap de mida irreal)', () => {
    const m = creaMascara(100, 100, (x, y) => x >= 40 && x <= 60 && y >= 1);
    expect(estimaCapSuperior(lm, m)?.origen).toBe('landmarks');
  });

  it('cap que toca la vora superior del fotograma: y = 0 amb màscara', () => {
    const m = creaMascara(100, 100, (x) => x >= 40 && x <= 60);
    const e = estimaCapSuperior(lm, m);
    expect(e).toEqual({ y: 0, origen: 'mascara' });
  });

  it('ignora una columna aïllada (una mediana de diverses columnes)', () => {
    // Només la columna central arriba molt amunt (un objecte darrere): la mediana ho ignora.
    const m = creaMascara(100, 100, (x, y) => (x >= 40 && x <= 60 && y >= 20) || (x === 50 && y >= 5));
    const e = estimaCapSuperior(lm, m);
    expect(e?.y).toBeCloseTo(0.2, 6);
  });

  it('landmarks incomplets: undefined', () => {
    expect(estimaCapSuperior([], undefined)).toBeUndefined();
  });
});

describe('calculaRetallCap', () => {
  it('retall complet a partir dels landmarks i la màscara, en píxels del fotograma', () => {
    const lm = creaLandmarks({ centreX: 0.5, yFront: 0.3, yBarbeta: 0.62, ample: 0.2 });
    const m = creaMascara(100, 100, (x, y) => x >= 40 && x <= 60 && y >= 20);
    const r = calculaRetallCap(lm, m, 1920, 1080, PARAMS_RETALL);
    expect(r).toBeDefined();
    if (!r) {
      return;
    }
    expect(r.origenCap).toBe('mascara');
    expect(r.barbetaY).toBeCloseTo(0.62 * 1080, 6);
    expect(r.capY).toBeCloseTo(0.2 * 1080, 6);
    const cap = r.barbetaY - r.capY;
    expect(cap / r.rect.h).toBeCloseTo(34 / 45, 2);
    expect(Math.abs(r.rect.x + r.rect.w / 2 - 960)).toBeLessThanOrEqual(1);
    expect(r.fraccioFora).toBe(0);
  });

  it('cara massa a prop: surt del fotograma i es marca', () => {
    const lm = creaLandmarks({ centreX: 0.5, yFront: 0.05, yBarbeta: 0.95, ample: 0.5 });
    const r = calculaRetallCap(lm, undefined, 1920, 1080, PARAMS_RETALL);
    expect(r?.fraccioFora ?? 0).toBeGreaterThan(TOLERANCIA_FORA);
  });

  it('sense landmarks o amb una geometria no vàlida: undefined (retall centrat de la Fase 1)', () => {
    expect(calculaRetallCap(undefined, undefined, 1920, 1080, PARAMS_RETALL)).toBeUndefined();
    expect(calculaRetallCap([], undefined, 1920, 1080, PARAMS_RETALL)).toBeUndefined();
  });
});
