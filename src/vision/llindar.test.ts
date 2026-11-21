import { avaluaInterval, avaluaMaxim, avaluaMinim, puntuacioControl } from './llindar';

describe('avaluaMaxim', () => {
  it('verd al límit exacte, àmbar fins al marge, vermell més enllà', () => {
    expect(avaluaMaxim(8, 8, 0.25).estat).toBe('ok');
    expect(avaluaMaxim(8.01, 8, 0.25).estat).toBe('avis');
    expect(avaluaMaxim(10, 8, 0.25).estat).toBe('avis'); // 25% exacte
    expect(avaluaMaxim(10.01, 8, 0.25).estat).toBe('error');
  });
  it('excés relatiu i marge', () => {
    expect(avaluaMaxim(12, 8, 0.25).excesRel).toBeCloseTo(0.5, 9);
    expect(avaluaMaxim(0, 8, 0.25).marge01).toBe(1);
    expect(avaluaMaxim(8, 8, 0.25).marge01).toBe(0);
  });
});

describe('avaluaMinim', () => {
  it('verd al límit, àmbar a prop, vermell lluny', () => {
    expect(avaluaMinim(0.85, 0.85, 0.25, 1).estat).toBe('ok');
    expect(avaluaMinim(0.84, 0.85, 0.25, 1).estat).toBe('avis');
    expect(avaluaMinim(0.85 * 0.75, 0.85, 0.25, 1).estat).toBe('avis');
    expect(avaluaMinim(0.6, 0.85, 0.25, 1).estat).toBe('error');
  });
  it('el marge arriba a 1 en el valor ideal', () => {
    expect(avaluaMinim(1, 0.85, 0.25, 1).marge01).toBe(1);
  });
});

describe('avaluaInterval', () => {
  it('verd als dos extrems, àmbar a prop per cada costat, vermell lluny', () => {
    expect(avaluaInterval(0.3, 0.3, 0.45, 0.25).estat).toBe('ok');
    expect(avaluaInterval(0.45, 0.3, 0.45, 0.25).estat).toBe('ok');
    const baix = avaluaInterval(0.27, 0.3, 0.45, 0.25);
    expect(baix.estat).toBe('avis');
    expect(baix.costat).toBe('baix');
    const alt = avaluaInterval(0.5, 0.3, 0.45, 0.25);
    expect(alt.estat).toBe('avis');
    expect(alt.costat).toBe('alt');
    expect(avaluaInterval(0.1, 0.3, 0.45, 0.25).estat).toBe('error');
    expect(avaluaInterval(0.9, 0.3, 0.45, 0.25).estat).toBe('error');
  });
  it('el marge és 1 al centre de l’interval', () => {
    expect(avaluaInterval(0.375, 0.3, 0.45, 0.25).marge01).toBeCloseTo(1, 9);
  });
});

describe('puntuacioControl', () => {
  it('dins el llindar entre 0,85 i 1; fora, per sota de 0,85 i fins a 0', () => {
    expect(puntuacioControl({ estat: 'ok', excesRel: 0, marge01: 0 })).toBeCloseTo(0.85, 9);
    expect(puntuacioControl({ estat: 'ok', excesRel: 0, marge01: 1 })).toBeCloseTo(1, 9);
    expect(puntuacioControl({ estat: 'avis', excesRel: 0.25, marge01: 0 })).toBeCloseTo(0.6375, 9);
    expect(puntuacioControl({ estat: 'error', excesRel: 1, marge01: 0 })).toBe(0);
    expect(puntuacioControl({ estat: 'error', excesRel: 5, marge01: 0 })).toBe(0);
  });
});
